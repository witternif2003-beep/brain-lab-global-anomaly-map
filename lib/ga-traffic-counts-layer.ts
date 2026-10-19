import { Marker, Popup } from 'maplibre-gl';
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { insideRing, loadGaWallRing, type LngLat } from './ga-patrol-3d';
import { reportGaFeed } from './ga-live-status';
import { hitsGaDeck } from './ga-deck-overlay';
import { carSpacingM, carsAlong, roadPathFor, type RoadLine } from './ga-traffic-counts/cars';
import { flowStyle, LEVELS, TADA_PAGE, type CountsPayload, type StationDirection, type StationProps } from './ga-traffic-counts/normalize';

const API = '/api/ga-traffic-counts';
const REFRESH_MS = 5 * 60_000;
const SRC = 'ga-traffic-counts';
const DOT = `${SRC}-dot`;
const LABEL = `${SRC}-label`;
const CARS_SRC = 'ga-traffic-cars';
const CARS = `${SRC}-cars`;
export const GA_TRAFFIC_COUNT_LAYERS = [CARS, DOT, LABEL] as const;
/** Cars are drawn only when the camera is at or below 1,000 ft (304.8 m) above the ground at the map centre. */
export const CARS_MAX_AGL_M = 304.8;
const CAR_ROAD_CLASSES = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']);
const CAR_STATIONS_MAX = 8;
const CAR_FRAME_MS = 33;
/** Road tiles keep arriving after a move, so the road match is redone on this cadence while cars are shown. */
const CAR_REMATCH_MS = 2_000;
const ATTRIBUTION = 'GA live counts: Georgia DOT TADA continuous count stations (15-min bins) · measured at stations only';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const STYLE_ID = 'ga-traffic-flow-css';
const FLOW_CLASS = 'ga-traffic-flow';

const LEVEL_COLOR = ['match', ['get', 'level'], ...LEVELS.flatMap((l) => [l.id, l.color]), '#81d8d0'] as unknown as ExpressionSpecification;
const VPH_RADIUS = (lo: number, hi: number) => ['interpolate', ['linear'], ['get', 'vph'], 0, lo, 1000, lo + (hi - lo) * 0.35, 6000, hi, 14000, hi * 1.2];

function ensureFlowCss(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = [
    `@keyframes ga-traffic-flow{from{transform:translateY(0)}to{transform:translateY(calc(-1 * var(--p)))}}`,
    `.${FLOW_CLASS}{pointer-events:none}`,
    `.${FLOW_CLASS}>u{display:block;position:relative;width:26px;height:var(--len);transform:scale(var(--ga-flow-scale,1));transform-origin:50% 100%}`,
    `.${FLOW_CLASS}>u>i{position:absolute;left:15px;top:6px;width:7px;bottom:0;overflow:hidden;border-radius:4px;background:rgba(11,14,20,.72);box-shadow:0 0 0 1px rgba(11,14,20,.9)}`,
    `.${FLOW_CLASS}>u>i>b{position:absolute;left:1px;right:1px;top:0;height:calc(100% + var(--p));background:repeating-linear-gradient(to top,var(--c) 0 var(--d),transparent var(--d) var(--p));animation:ga-traffic-flow var(--t) linear infinite;will-change:transform}`,
    `.${FLOW_CLASS}>u>s{position:absolute;left:12.5px;top:0;width:0;height:0;border-left:6px solid transparent;border-right:6px solid transparent;border-bottom:8px solid var(--c);filter:drop-shadow(0 0 2px #0b0e14)}`,
    `@media (prefers-reduced-motion:reduce){.${FLOW_CLASS}>u>i>b{animation-duration:calc(var(--t) * 4)}}`,
  ].join('');
  document.head.append(style);
}

function flowMarker(d: StationDirection, color: string, lngLat: LngLat): Marker {
  const f = flowStyle(d);
  const el = document.createElement('div');
  el.className = FLOW_CLASS;
  el.style.setProperty('--len', `${f.len}px`);
  el.style.setProperty('--p', `${f.period}px`);
  el.style.setProperty('--d', `${f.dash}px`);
  el.style.setProperty('--c', color);
  el.style.setProperty('--t', f.durationS ? `${f.durationS.toFixed(2)}s` : '0s');
  const track = document.createElement('i');
  const dashes = document.createElement('b');
  if (!f.durationS) dashes.style.animation = 'none';
  track.append(dashes);
  const box = document.createElement('u');
  box.append(track, document.createElement('s'));
  el.append(box);
  el.title = `${d.direction} · ${d.vph.toLocaleString()} veh/h${d.avgMph ? ` · ${d.avgMph} mph` : ''}`;
  return new Marker({ element: el, anchor: 'bottom', rotationAlignment: 'map', pitchAlignment: 'map', rotation: d.bearing ?? 0 }).setLngLat(lngLat);
}

function flowScale(zoom: number): number {
  return Math.max(0.45, Math.min(1.6, 0.45 + (zoom - 6) * 0.115));
}

function popup(map: MapLibreMap, lngLat: LngLat, p: StationProps) {
  const box = document.createElement('div');
  box.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45';
  const h = document.createElement('div');
  h.textContent = `GDOT LIVE COUNT · ${p.road} · ${LEVELS.find((l) => l.id === p.level)?.label.toUpperCase() ?? ''}`;
  h.style.cssText = `font-weight:800;margin-bottom:4px;border-left:6px solid ${p.color};padding-left:5px`;
  box.append(h);
  const t = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const rows: [string, string][] = [
    ['Station', `${p.name} · ${p.description}`],
    ['County', p.county],
    ['Measured', `${t(p.binStart)}–${t(p.binEnd)} (${p.intervalMin} min)${p.status === 'stale' ? ' · STALE' : ''}`],
    ['Vehicles', `${p.count.toLocaleString()} in ${p.intervalMin} min = ${p.vph.toLocaleString()} veh/h`],
    ['GDOT normal', p.normalCount === null ? 'not published' : `${p.normalCount.toLocaleString()}${p.pctOfNormal === null ? '' : ` (${p.pctOfNormal}% of normal)`}`],
    ['Avg speed', p.avgMph === null ? 'not measured' : `${p.avgMph} mph${p.limitMph ? ` · limit ${p.limitMph} mph` : ''}${p.slowed ? ' · SLOWED' : ''}`],
  ];
  for (const d of p.directions) rows.push([`Dir ${d.direction}`, `${d.count.toLocaleString()} veh · ${d.vph.toLocaleString()} veh/h${d.avgMph ? ` · ${d.avgMph} mph` : ''}`]);
  for (const [k, v] of rows) {
    if (!v) continue;
    const row = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = `${k}: `;
    row.append(b, v);
    box.append(row);
  }
  const note = document.createElement('div');
  note.textContent = 'Measured at this station only; moving dashes show measured flow, not individual vehicles.';
  note.style.cssText = 'margin-top:3px;color:#475569';
  const a = document.createElement('a');
  a.href = TADA_PAGE;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.textContent = 'Source: GDOT TADA ↗';
  box.append(note, a);
  new Popup({ closeButton: true, maxWidth: 'min(320px, 92vw)' }).setLngLat(lngLat).setDOMContent(box).addTo(map);
}

const bound = new WeakSet<MapLibreMap>();

/** Top-down car icon (nose up) in a traffic-level colour, with headlights, windscreen and tail lights so travel direction reads at a glance. */
function carImage(color: string): ImageData {
  const c = document.createElement('canvas');
  c.width = 36;
  c.height = 72;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const rr = (x: number, y: number, w: number, h: number, r: number) => { g.beginPath(); g.roundRect(x, y, w, h, r); };
  g.fillStyle = '#0b0e14';
  rr(2, 2, 32, 68, 10); g.fill();
  g.fillStyle = color;
  rr(5, 5, 26, 62, 8); g.fill();
  g.fillStyle = '#0b0e14';
  rr(8, 18, 20, 11, 3); g.fill();
  rr(9, 50, 18, 7, 2); g.fill();
  g.fillStyle = '#fffbe6';
  g.fillRect(7, 5, 6, 4); g.fillRect(23, 5, 6, 4);
  g.fillStyle = '#ff2a2a';
  g.fillRect(7, 63, 6, 4); g.fillRect(23, 63, 6, 4);
  return g.getImageData(0, 0, c.width, c.height);
}

/** Camera height above the ground at the map centre, in metres (camera-to-centre distance × cos pitch, Web Mercator scale at the centre latitude). */
const EARTH_CIRCUMFERENCE_M = 40_075_016.686;
const cameraAglM = (map: MapLibreMap) => {
  const fov = (map.getVerticalFieldOfView() * Math.PI) / 180;
  const mpp = (EARTH_CIRCUMFERENCE_M * Math.cos((map.getCenter().lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
  return (0.5 / Math.tan(fov / 2)) * map.getContainer().clientHeight * mpp * Math.cos((map.getPitch() * Math.PI) / 180);
};

interface CarPath { path: LngLat[]; spacingM: number; mph: number | null; level: string; vehiclesPerIcon: number }

/** Road lines rendered around a screen point by the GA road overlay, as lng/lat line strings. */
function roadLinesNear(map: MapLibreMap, at: LngLat, px: number): RoadLine[] {
  const p = map.project(at);
  return map
    .queryRenderedFeatures([[p.x - px, p.y - px], [p.x + px, p.y + px]], { layers: ['ga-roads-line'] })
    .filter((f) => CAR_ROAD_CLASSES.has(String(f.properties?.class)))
    .flatMap((f) => {
      const oneway = Number(f.properties?.oneway) || null;
      const parts = f.geometry.type === 'LineString' ? [f.geometry.coordinates as LngLat[]] : f.geometry.type === 'MultiLineString' ? (f.geometry.coordinates as LngLat[][]) : [];
      const cls = String(f.properties?.class);
      return parts.map((coords) => ({ coords, oneway, cls }));
    });
}

/**
 * Cars along the mapped road at each GDOT station in view, one stream per measured direction:
 * spacing from measured veh/h ÷ mph, speed from measured mph. Shown only at or below CARS_MAX_AGL_M.
 */
function addTrafficCars(map: MapLibreMap, getStations: () => GeoJSON.Feature<GeoJSON.Point, StationProps>[]): () => void {
  for (const l of LEVELS) if (!map.hasImage(`ga-car-${l.id}`)) map.addImage(`ga-car-${l.id}`, carImage(l.color), { pixelRatio: 2 });
  if (!map.getSource(CARS_SRC)) map.addSource(CARS_SRC, { type: 'geojson', data: EMPTY });
  if (!map.getLayer(CARS)) {
    map.addLayer({
      id: CARS,
      type: 'symbol',
      source: CARS_SRC,
      minzoom: 15,
      layout: {
        'icon-image': ['concat', 'ga-car-', ['get', 'level']] as unknown as ExpressionSpecification,
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': ['interpolate', ['exponential', 2], ['zoom'], 16, 0.16, 18, 0.64, 20, 2.56, 22, 10.24] as unknown as ExpressionSpecification,
      },
    }, map.getLayer(DOT) ? DOT : undefined);
  }
  const reduced = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let paths: CarPath[] = [];
  let active = false;
  let raf = 0;
  let last = 0;
  const draw = (tS: number) => {
    const features: GeoJSON.Feature[] = paths.flatMap((p) => carsAlong(p.path, p.spacingM, p.mph, tS).map((c) => ({
      type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: c.at }, properties: { heading: c.heading, level: p.level },
    })));
    (map.getSource(CARS_SRC) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
  };
  const frame = (ts: number) => {
    raf = 0;
    if (!active) return;
    if (ts - last >= CAR_FRAME_MS) {
      last = ts;
      draw(ts / 1000);
    }
    raf = requestAnimationFrame(frame);
  };
  const rebuild = () => {
    if (!active) return;
    const b = map.getBounds();
    const c = map.getCenter();
    const px = Math.max(60, 200 * 2 ** (map.getZoom() - 17));
    paths = getStations()
      .filter((f) => b.contains(f.geometry.coordinates as LngLat))
      .sort((a, d) => Math.hypot(a.geometry.coordinates[0] - c.lng, a.geometry.coordinates[1] - c.lat) - Math.hypot(d.geometry.coordinates[0] - c.lng, d.geometry.coordinates[1] - c.lat))
      .slice(0, CAR_STATIONS_MAX)
      .flatMap((f) => {
        const at = f.geometry.coordinates as LngLat;
        const lines = roadLinesNear(map, at, px);
        return f.properties.directions.flatMap((d) => {
          const sp = d.bearing === null || d.count <= 0 ? null : carSpacingM(d.vph, d.avgMph);
          const path = sp && d.bearing !== null ? roadPathFor(at, d.bearing, lines) : null;
          return sp && path ? [{ path, spacingM: sp.spacingM, mph: d.avgMph, level: f.properties.level, vehiclesPerIcon: sp.vehiclesPerIcon }] : [];
        });
      });
    window.__gaTrafficCars = { active, paths: paths.length, aglM: Math.round(cameraAglM(map)), vehiclesPerIcon: paths.map((p) => Math.round(p.vehiclesPerIcon * 10) / 10), pathPoints: paths.map((p) => p.path.length) };
    draw(reduced ? 0 : performance.now() / 1000);
    if (!reduced && !raf) raf = requestAnimationFrame(frame);
  };
  const update = () => {
    const on = map.getZoom() >= 15 && cameraAglM(map) <= CARS_MAX_AGL_M;
    if (on && !active) active = true;
    else if (!on && active) {
      active = false;
      paths = [];
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      (map.getSource(CARS_SRC) as GeoJSONSource | undefined)?.setData(EMPTY);
    }
    window.__gaTrafficCars = { active, paths: paths.length, aglM: Math.round(cameraAglM(map)), vehiclesPerIcon: [] };
    if (active) rebuild();
  };
  map.on('moveend', update);
  update();
  const rematch = setInterval(() => active && rebuild(), CAR_REMATCH_MS);
  return () => {
    active = false;
    clearInterval(rematch);
    if (raf) cancelAnimationFrame(raf);
    map.off('moveend', update);
  };
}

declare global {
  interface Window { __gaTrafficCars?: { active: boolean; paths: number; aglM: number; vehiclesPerIcon: number[]; pathPoints?: number[] } }
}

/** Raises the count-station dots and labels above layers added later (roads, LiDAR after a context restore). */
export function raiseGaTrafficCountLayers(map: MapLibreMap): void {
  for (const id of GA_TRAFFIC_COUNT_LAYERS) if (map.getLayer(id)) map.moveLayer(id);
}

/** Live GDOT continuous-count-station traffic (15-min counts, average speed) inside the GA wall, with moving flow indicators (idempotent). */
export function addGaTrafficCountLayers(map: MapLibreMap): void {
  if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: EMPTY, attribution: ATTRIBUTION });
  if (!map.getLayer(DOT)) {
    map.addLayer({
      id: DOT,
      type: 'circle',
      source: SRC,
      paint: {
        'circle-color': LEVEL_COLOR,
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, VPH_RADIUS(3, 7), 10, VPH_RADIUS(5, 12), 16, VPH_RADIUS(9, 22)] as unknown as ExpressionSpecification,
        'circle-stroke-color': ['case', ['get', 'slowed'], '#ff3b3b', '#0b0e14'],
        'circle-stroke-width': ['case', ['get', 'slowed'], 3, 2],
        'circle-opacity': ['case', ['==', ['get', 'status'], 'stale'], 0.45, 1],
        'circle-pitch-alignment': 'map',
      },
    });
  }
  if (!map.getLayer(LABEL)) {
    map.addLayer({
      id: LABEL,
      type: 'symbol',
      source: SRC,
      minzoom: 6.5,
      layout: {
        'text-field': ['step', ['zoom'],
          ['concat', ['to-string', ['round', ['/', ['get', 'vph'], 100]]], '00/h'],
          10, ['concat', ['get', 'road'], ' · ', ['to-string', ['get', 'vph']], ' veh/h', ['case', ['>', ['coalesce', ['get', 'avgMph'], 0], 0], ['concat', ' · ', ['to-string', ['get', 'avgMph']], ' mph'], '']],
        ] as unknown as ExpressionSpecification,
        'text-size': ['interpolate', ['linear'], ['zoom'], 6.5, 10, 10, 12, 14, 14, 18, 17],
        'text-offset': [0, 1.3],
        'text-anchor': 'top',
        'text-max-width': 18,
        'symbol-sort-key': ['-', 0, ['get', 'vph']],
      },
      paint: { 'text-color': LEVEL_COLOR, 'text-halo-color': '#0b0e14', 'text-halo-width': 2.2, 'text-halo-blur': 0.3 },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);
  ensureFlowCss();

  let markers: Marker[] = [];
  let stations: GeoJSON.Feature<GeoJSON.Point, StationProps>[] = [];
  const stopCars = addTrafficCars(map, () => stations);
  const container = map.getContainer();
  const rescale = () => container.style.setProperty('--ga-flow-scale', flowScale(map.getZoom()).toFixed(2));
  rescale();
  map.on('zoom', rescale);

  const refresh = async () => {
    try {
      const [r, ring] = await Promise.all([fetch(API), loadGaWallRing().catch(() => [] as LngLat[])]);
      const d = (await r.json()) as CountsPayload & { error?: string };
      if (!r.ok || d.error) throw new Error(d.error ?? `HTTP ${r.status}`);
      const features = d.stations.features.filter((f) => !ring.length || insideRing(ring, f.geometry.coordinates as LngLat));
      (map.getSource(SRC) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
      stations = features as GeoJSON.Feature<GeoJSON.Point, StationProps>[];
      map.fire('moveend');
      for (const m of markers) m.remove();
      markers = features.flatMap((f) => f.properties.directions.filter((x) => x.count > 0).map((x) => flowMarker(x, f.properties.color, f.geometry.coordinates as LngLat).addTo(map)));
      const s = d.summary;
      reportGaFeed(map, {
        id: 'traffic-counts', label: 'GDOT live traffic counts (15 min)', color: '#ff2bd6', count: features.length,
        detail: `${features.reduce((a, f) => a + f.properties.count, 0).toLocaleString()} vehicles counted in the latest 15 min · ${s.slowed} slowed · ${s.noCurrentCount} stations with no current count`,
        updatedAt: s.latestBinEnd, sourceUrl: TADA_PAGE,
        swatches: LEVELS.map((l) => ({ label: `${l.label} ≥${l.min.toLocaleString()}/h`, color: l.color, count: features.filter((f) => f.properties.level === l.id).length })),
      });
    } catch (err) {
      console.warn('[GaTrafficCounts] refresh failed:', err);
      reportGaFeed(map, { id: 'traffic-counts', label: 'GDOT live traffic counts (15 min)', color: '#ff2bd6', count: null, updatedAt: null, sourceUrl: TADA_PAGE, error: err instanceof Error ? err.message : String(err) });
    }
  };
  void refresh();
  const timer = setInterval(() => void refresh(), REFRESH_MS);
  map.once('remove', () => {
    clearInterval(timer);
    stopCars();
    for (const m of markers) m.remove();
    markers = [];
    bound.delete(map);
  });

  map.on('click', DOT, (e) => {
    if (hitsGaDeck(map, e.point)) return;
    const f = e.features?.[0];
    if (!f) return;
    const raw = f.properties as Record<string, unknown>;
    const p = { ...raw, directions: typeof raw.directions === 'string' ? JSON.parse(raw.directions) : raw.directions } as StationProps;
    popup(map, [e.lngLat.lng, e.lngLat.lat], p);
  });
  map.on('mouseenter', DOT, () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', DOT, () => (map.getCanvas().style.cursor = ''));
}

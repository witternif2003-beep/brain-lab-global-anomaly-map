import { Popup } from 'maplibre-gl';
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { insideRing, loadGaWallRing, type LngLat } from './ga-patrol-3d';
import { reportGaFeed } from './ga-live-status';
import { hitsGaDeck } from './ga-deck-overlay';
import { carSpacingM, carsAlong, roadHeadingAt, roadPathFor, type RoadLine } from './ga-traffic-counts/cars';
import { LEVELS, TADA_PAGE, type CountsPayload, type StationProps } from './ga-traffic-counts/normalize';

const API = '/api/ga-traffic-counts';
const REFRESH_MS = 5 * 60_000;
const SRC = 'ga-traffic-counts';
const DOT = `${SRC}-dot`;
const LABEL = `${SRC}-label`;
const CARS_SRC = 'ga-traffic-cars';
const CARS = `${SRC}-cars`;
const ARROW_SRC = 'ga-traffic-arrows';
const ARROW = `${SRC}-arrow`;
export const GA_TRAFFIC_COUNT_LAYERS = [CARS, DOT, ARROW, LABEL] as const;
/** From this zoom the arrow takes its direction from the mapped road at the station instead of GDOT's lane bearing. */
const ARROW_ROAD_MIN_ZOOM = 14;
const ARROW_ROAD_MAX = 40;
/** Road search radius around a station when matching the arrow direction (the matcher accepts lines within 80 m). */
const ARROW_ROAD_SEARCH_M = 100;
/** Cars are drawn only when the camera is at or below 1,000 ft (304.8 m) above the ground at the map centre. */
export const CARS_MAX_AGL_M = 304.8;
const CAR_ROAD_CLASSES = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor']);
const CAR_STATIONS_MAX = 8;
const CAR_FRAME_MS = 33;
/** Road tiles keep arriving after a move, so the road match is redone on this cadence while cars are shown. */
const CAR_REMATCH_MS = 2_000;
const ATTRIBUTION = 'GA live counts: Georgia DOT TADA continuous count stations (15-min bins) · measured at stations only';
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };
const CAR_IMAGE = 'ga-car';
const CAR_GREY = '#9ca3af';

const LEVEL_COLOR = ['match', ['get', 'level'], ...LEVELS.flatMap((l) => [l.id, l.color]), '#81d8d0'] as unknown as ExpressionSpecification;
const VPH_RADIUS = (lo: number, hi: number) => ['interpolate', ['linear'], ['get', 'vph'], 0, lo, 1000, lo + (hi - lo) * 0.35, 6000, hi, 14000, hi * 1.2];

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
  note.textContent = 'Measured at this station only. Arrows sit on the station\'s published coordinate and point along the mapped road from zoom 14; at 1,000 ft and below, grey cars on the road show the measured flow, not individual vehicles.';
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

/** Top-down car icon (nose up) with headlights, windscreen and tail lights so travel direction reads at a glance. */
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
const metresPerPx = (map: MapLibreMap) => (EARTH_CIRCUMFERENCE_M * Math.cos((map.getCenter().lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
const cameraAglM = (map: MapLibreMap) => {
  const fov = (map.getVerticalFieldOfView() * Math.PI) / 180;
  const mpp = metresPerPx(map);
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
  if (!map.hasImage(CAR_IMAGE)) map.addImage(CAR_IMAGE, carImage(CAR_GREY), { pixelRatio: 2 });
  if (!map.getSource(CARS_SRC)) map.addSource(CARS_SRC, { type: 'geojson', data: EMPTY });
  if (!map.getLayer(CARS)) {
    map.addLayer({
      id: CARS,
      type: 'symbol',
      source: CARS_SRC,
      minzoom: 15,
      layout: {
        'icon-image': CAR_IMAGE,
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

/** Arrow (point up, centred) in a traffic-level colour with a dark outline. */
function arrowImage(color: string): ImageData {
  const c = document.createElement('canvas');
  c.width = 48;
  c.height = 48;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.beginPath();
  g.moveTo(24, 3); g.lineTo(42, 27); g.lineTo(30, 27); g.lineTo(30, 45); g.lineTo(18, 45); g.lineTo(18, 27); g.lineTo(6, 27);
  g.closePath();
  g.lineJoin = 'round';
  g.lineWidth = 5;
  g.strokeStyle = '#0b0e14';
  g.stroke();
  g.fillStyle = color;
  g.fill();
  return g.getImageData(0, 0, c.width, c.height);
}

/**
 * One arrow per measured direction, anchored at its centre on the station's published coordinate at every zoom.
 * From ARROW_ROAD_MIN_ZOOM it points along the matched mapped road (one-way carriageways with traffic); otherwise along GDOT's lane bearing.
 */
function addStationArrows(map: MapLibreMap, getStations: () => GeoJSON.Feature<GeoJSON.Point, StationProps>[]): { refresh: () => void; stop: () => void } {
  for (const l of LEVELS) if (!map.hasImage(`ga-arrow-${l.id}`)) map.addImage(`ga-arrow-${l.id}`, arrowImage(l.color), { pixelRatio: 2 });
  if (!map.getSource(ARROW_SRC)) map.addSource(ARROW_SRC, { type: 'geojson', data: EMPTY });
  if (!map.getLayer(ARROW)) {
    map.addLayer({
      id: ARROW,
      type: 'symbol',
      source: ARROW_SRC,
      layout: {
        'icon-image': ['concat', 'ga-arrow-', ['get', 'level']] as unknown as ExpressionSpecification,
        'icon-anchor': 'center',
        'icon-rotate': ['get', 'heading'],
        'icon-rotation-alignment': 'map',
        'icon-pitch-alignment': 'map',
        'icon-allow-overlap': true,
        'icon-ignore-placement': true,
        'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.45, 10, 0.75, 15, 1, 20, 1.4] as unknown as ExpressionSpecification,
      },
    }, map.getLayer(LABEL) ? LABEL : undefined);
  }
  let timers: number[] = [];
  const build = () => {
    const zoom = map.getZoom();
    const b = map.getBounds();
    const c = map.getCenter();
    const near = new Set(zoom < ARROW_ROAD_MIN_ZOOM ? [] : getStations()
      .filter((f) => b.contains(f.geometry.coordinates as LngLat))
      .sort((x, y) => Math.hypot(x.geometry.coordinates[0] - c.lng, x.geometry.coordinates[1] - c.lat) - Math.hypot(y.geometry.coordinates[0] - c.lng, y.geometry.coordinates[1] - c.lat))
      .slice(0, ARROW_ROAD_MAX));
    let matched = 0;
    const px = Math.min(1500, Math.max(120, ARROW_ROAD_SEARCH_M / metresPerPx(map)));
    const features: GeoJSON.Feature[] = getStations().flatMap((f) => {
      const at = f.geometry.coordinates as LngLat;
      const lines = near.has(f) ? roadLinesNear(map, at, px) : [];
      return f.properties.directions.filter((d) => d.bearing !== null && d.count > 0).map((d) => {
        const road = lines.length ? roadHeadingAt(at, d.bearing as number, lines) : null;
        if (road !== null) matched++;
        return { type: 'Feature' as const, geometry: { type: 'Point' as const, coordinates: at }, properties: { heading: road ?? d.bearing, level: f.properties.level, direction: d.direction, onRoad: road !== null } };
      });
    });
    (map.getSource(ARROW_SRC) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
    window.__gaTrafficArrows = { arrows: features.length, roadMatched: matched };
  };
  const refresh = () => {
    timers.forEach(clearTimeout);
    build();
    timers = [1_500, 4_000].map((ms) => window.setTimeout(build, ms));
  };
  map.on('moveend', refresh);
  return { refresh, stop: () => { timers.forEach(clearTimeout); map.off('moveend', refresh); } };
}

declare global {
  interface Window { __gaTrafficArrows?: { arrows: number; roadMatched: number } }
  interface Window { __gaTrafficCars?: { active: boolean; paths: number; aglM: number; vehiclesPerIcon: number[]; pathPoints?: number[] } }
}

/** Raises the count-station dots and labels above layers added later (roads, LiDAR after a context restore). */
export function raiseGaTrafficCountLayers(map: MapLibreMap): void {
  for (const id of GA_TRAFFIC_COUNT_LAYERS) if (map.getLayer(id)) map.moveLayer(id);
}

/** Live GDOT continuous-count-station traffic (15-min counts, average speed) inside the GA wall, with direction arrows on each station coordinate and grey road-pinned cars at 1,000 ft and below (idempotent). */
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

  let stations: GeoJSON.Feature<GeoJSON.Point, StationProps>[] = [];
  const stopCars = addTrafficCars(map, () => stations);
  const arrows = addStationArrows(map, () => stations);

  const refresh = async () => {
    try {
      const [r, ring] = await Promise.all([fetch(API), loadGaWallRing().catch(() => [] as LngLat[])]);
      const d = (await r.json()) as CountsPayload & { error?: string };
      if (!r.ok || d.error) throw new Error(d.error ?? `HTTP ${r.status}`);
      const features = d.stations.features.filter((f) => !ring.length || insideRing(ring, f.geometry.coordinates as LngLat));
      (map.getSource(SRC) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
      stations = features as GeoJSON.Feature<GeoJSON.Point, StationProps>[];
      map.fire('moveend');
      arrows.refresh();
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
    arrows.stop();
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

import { Marker, Popup } from 'maplibre-gl';
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { insideRing, loadGaWallRing, type LngLat } from './ga-patrol-3d';
import { reportGaFeed } from './ga-live-status';
import { hitsGaDeck } from './ga-deck-overlay';
import { flowStyle, LEVELS, TADA_PAGE, type CountsPayload, type StationDirection, type StationProps } from './ga-traffic-counts/normalize';

const API = '/api/ga-traffic-counts';
const REFRESH_MS = 5 * 60_000;
const SRC = 'ga-traffic-counts';
const DOT = `${SRC}-dot`;
const LABEL = `${SRC}-label`;
export const GA_TRAFFIC_COUNT_LAYERS = [DOT, LABEL] as const;
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

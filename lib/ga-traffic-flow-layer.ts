import type { ExpressionSpecification, GeoJSONSourceSpecification, Map as MapLibreMap, VectorSourceSpecification, VectorTileSource } from 'maplibre-gl';
import { FLOW_COLOR_EXPRESSION, FLOW_COLORS, FLOW_MIN_ZOOM, FLOW_SOURCE_LAYER, FLOW_TILE_MAX_ZOOM, TOMTOM_FLOW_DOCS_URL, type FlowMode } from './ga-traffic-flow/flow';
import { reportGaFeed } from './ga-live-status';
import type { SegmentSummary } from './ga-traffic-flow/segment';

export const GA_TRAFFIC_FLOW_SOURCE = 'ga-traffic-flow';
export const GA_TRAFFIC_FLOW_LAYER = 'ga-traffic-flow-line';

export interface FlowStatus {
  mode: FlowMode;
  provider: string;
  sourceUrl: string;
  attribution: string;
  tiles: string | null;
  mock: GeoJSON.FeatureCollection | null;
  generatedAt: string;
}

const statusByMap = new WeakMap<MapLibreMap, Promise<FlowStatus>>();
const LABEL = 'Traffic flow (TomTom)';
const swatches = [
  { label: 'jamFactor 0–3 free', color: FLOW_COLORS.free },
  { label: 'jamFactor 4–6 slow', color: FLOW_COLORS.slow },
  { label: 'jamFactor 7–8 jam', color: FLOW_COLORS.jam },
  { label: 'jamFactor 9–10 or closed', color: FLOW_COLORS.closed },
];

/** Shared /api/traffic-flow status per map (also tells the incident layer whether a TomTom key is set). */
export function gaTrafficFlowStatus(map: MapLibreMap): Promise<FlowStatus> {
  let p = statusByMap.get(map);
  if (!p) {
    p = fetch('/api/traffic-flow').then((r) => (r.ok ? (r.json() as Promise<FlowStatus>) : Promise.reject(new Error(`HTTP ${r.status}`))));
    statusByMap.set(map, p);
    p.catch(() => statusByMap.delete(map));
  }
  return p;
}

const WIDTH = ['interpolate', ['linear'], ['zoom'], 8, 1.5, 12, 3, 16, 6, 18, 8, 22, 12] as ExpressionSpecification;
const OPACITY = 0.85;
/** Live flow tiles are re-fetched this often; the minute stamp lets every visitor share one CDN copy per minute. */
export const FLOW_REFRESH_MS = 60_000;

export const flowTilesUrl = (origin: string, path: string, now = Date.now()): string =>
  `${origin}${path}${path.includes('?') ? '&' : '?'}t=${Math.floor(now / FLOW_REFRESH_MS)}`;
const polling = new WeakSet<MapLibreMap>();
const clickable = new WeakSet<MapLibreMap>();

type SegmentReply = SegmentSummary & { error?: string; source?: string; retrievedAt?: string };

function segmentRows(j: SegmentReply): [string, string][] {
  const v = (n: number | null, u = '') => (n === null ? 'not reported' : `${n}${u}`);
  return [
    ['Current speed', v(j.currentSpeedMph, ' mph')],
    ['Free-flow speed', v(j.freeFlowSpeedMph, ' mph')],
    ['Current / free-flow', j.ratio === null ? 'not reported' : `${j.ratio}${j.condition ? ` · ${j.condition}` : ''}`],
    ['TomTom confidence', v(j.confidence)],
    ['Travel time now / free', `${v(j.currentTravelTimeS, ' s')} / ${v(j.freeFlowTravelTimeS, ' s')}`],
    ['Road class', j.frc ?? 'not reported'],
  ];
}

/** Tap a flow line: TomTom's measured speeds for the nearest road segment, fetched through the server proxy. */
function enableSegmentReadout(map: MapLibreMap): void {
  if (clickable.has(map)) return;
  clickable.add(map);
  map.on('click', GA_TRAFFIC_FLOW_LAYER, async (e) => {
    const { Popup } = await import('maplibre-gl');
    const { lat, lng } = e.lngLat;
    const el = document.createElement('div');
    el.style.cssText = 'font:13px ui-monospace,monospace;color:#e5e7eb;min-width:240px';
    el.textContent = 'TomTom segment: loading…';
    const popup = new Popup({ closeButton: true, maxWidth: '320px' }).setLngLat(e.lngLat).setDOMContent(el).addTo(map);
    fetch(`/api/traffic-flow/segment?point=${lat.toFixed(6)},${lng.toFixed(6)}`, { cache: 'no-store' })
      .then(async (r) => ({ ok: r.ok, j: (await r.json()) as SegmentReply }))
      .then(({ ok, j }) => {
        el.textContent = '';
        const head = document.createElement('div');
        head.style.cssText = 'color:#67e8f9;font-weight:600;margin-bottom:4px';
        head.textContent = ok ? 'TOMTOM FLOW SEGMENT' : `TomTom segment error: ${j.error ?? 'unknown'}`;
        el.append(head);
        if (!ok) return;
        for (const [k, val] of segmentRows(j)) {
          const row = document.createElement('div');
          row.textContent = `${k}: ${val}`;
          el.append(row);
        }
        const foot = document.createElement('div');
        foot.style.cssText = 'color:#9ca3af;font-size:11px;margin-top:4px';
        foot.textContent = `${j.source ?? 'TomTom'} · road speeds, not vehicle positions · ${j.retrievedAt ?? ''}`;
        el.append(foot);
      })
      .catch((err) => { if (popup.isOpen()) el.textContent = `TomTom segment error: ${String(err)}`; });
  });
  map.on('mouseenter', GA_TRAFFIC_FLOW_LAYER, () => { map.getCanvas().style.cursor = 'pointer'; });
  map.on('mouseleave', GA_TRAFFIC_FLOW_LAYER, () => { map.getCanvas().style.cursor = ''; });
}

/** Congestion polylines (not vehicles): live TomTom tiles via the server proxy when a key is set, labelled mock data only when TRAFFIC_FLOW_MOCK=1, otherwise nothing. Thin (1.5–6 px by zoom), 85% opaque and re-fetched every 60 s, drawn under 3D buildings and LiDAR, so the road and satellite stay visible underneath. */
export async function addGaTrafficFlowLayer(map: MapLibreMap): Promise<void> {
  let s: FlowStatus;
  try {
    s = await gaTrafficFlowStatus(map);
  } catch (err) {
    reportGaFeed(map, { id: 'traffic-flow', label: LABEL, color: FLOW_COLORS.free, count: null, updatedAt: null, sourceUrl: TOMTOM_FLOW_DOCS_URL, error: String(err) });
    return;
  }
  if (s.mode === 'off') {
    reportGaFeed(map, { id: 'traffic-flow', label: LABEL, color: FLOW_COLORS.free, count: null, updatedAt: null, sourceUrl: s.sourceUrl, error: 'off: no TomTom key (set TOMTOM_API_KEY)' });
    return;
  }
  if (!map.getSource(GA_TRAFFIC_FLOW_SOURCE)) {
    const src: VectorSourceSpecification | GeoJSONSourceSpecification = s.mode === 'live'
      ? { type: 'vector', tiles: [flowTilesUrl(location.origin, s.tiles ?? '')], minzoom: 0, maxzoom: FLOW_TILE_MAX_ZOOM, attribution: s.attribution }
      : { type: 'geojson', data: s.mock ?? { type: 'FeatureCollection', features: [] }, attribution: s.attribution };
    map.addSource(GA_TRAFFIC_FLOW_SOURCE, src);
  }
  const sourceLayer = s.mode === 'live' ? { 'source-layer': FLOW_SOURCE_LAYER } : {};
  if (!map.getLayer(GA_TRAFFIC_FLOW_LAYER)) {
    const below = map.getLayersOrder().find((id) => ['fill-extrusion', 'custom'].includes(map.getLayer(id)?.type ?? ''));
    map.addLayer({
      id: GA_TRAFFIC_FLOW_LAYER,
      type: 'line',
      source: GA_TRAFFIC_FLOW_SOURCE,
      ...sourceLayer,
      minzoom: FLOW_MIN_ZOOM,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': FLOW_COLOR_EXPRESSION, 'line-opacity': OPACITY, 'line-width': WIDTH },
    }, below);
  }
  if (s.mode === 'live') enableSegmentReadout(map);
  if (s.mode === 'live' && s.tiles && !polling.has(map)) {
    polling.add(map);
    const path = s.tiles;
    const timer = setInterval(() => {
      (map.getSource(GA_TRAFFIC_FLOW_SOURCE) as VectorTileSource | undefined)?.setTiles?.([flowTilesUrl(location.origin, path)]);
    }, FLOW_REFRESH_MS);
    map.once('remove', () => clearInterval(timer));
  }
  reportGaFeed(map, {
    id: 'traffic-flow',
    label: s.mode === 'mock' ? `${LABEL}: MOCK` : LABEL,
    color: FLOW_COLORS.free,
    count: s.mode === 'mock' ? s.mock?.features.length ?? 0 : null,
    detail: s.mode === 'mock' ? 'MOCK segments for local testing, not real traffic' : `jamFactor = round(10 × (1 − speed / free-flow speed)), tiles cached ${60} s`,
    updatedAt: s.generatedAt,
    sourceUrl: s.sourceUrl,
    swatches,
  });
}

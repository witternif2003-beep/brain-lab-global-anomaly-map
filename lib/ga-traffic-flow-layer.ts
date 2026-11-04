import type { ExpressionSpecification, GeoJSONSourceSpecification, Map as MapLibreMap, VectorSourceSpecification } from 'maplibre-gl';
import { FLOW_COLOR_EXPRESSION, FLOW_COLORS, FLOW_MIN_ZOOM, FLOW_SOURCE_LAYER, FLOW_TILE_MAX_ZOOM, TOMTOM_FLOW_DOCS_URL, type FlowMode } from './ga-traffic-flow/flow';
import { reportGaFeed } from './ga-live-status';

export const GA_TRAFFIC_FLOW_SOURCE = 'ga-traffic-flow';
export const GA_TRAFFIC_FLOW_LAYER = 'ga-traffic-flow-line';
export const GA_TRAFFIC_FLOW_CASING = 'ga-traffic-flow-casing';

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

const WIDTH = ['interpolate', ['exponential', 1.5], ['zoom'], 6, 1.5, 10, 3, 12, 4, 16, 8, 20, 16] as ExpressionSpecification;
const CASING_WIDTH = ['interpolate', ['exponential', 1.5], ['zoom'], 6, 2.5, 10, 5, 12, 6.5, 16, 12, 20, 22] as ExpressionSpecification;

/** Congestion polylines (not vehicles): live TomTom tiles via the server proxy when a key is set, labelled mock data only when TRAFFIC_FLOW_MOCK=1, otherwise nothing. Drawn above the road overlay, with a dark casing so it reads on satellite imagery. */
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
      ? { type: 'vector', tiles: [`${location.origin}${s.tiles}`], minzoom: 0, maxzoom: FLOW_TILE_MAX_ZOOM, attribution: s.attribution }
      : { type: 'geojson', data: s.mock ?? { type: 'FeatureCollection', features: [] }, attribution: s.attribution };
    map.addSource(GA_TRAFFIC_FLOW_SOURCE, src);
  }
  const sourceLayer = s.mode === 'live' ? { 'source-layer': FLOW_SOURCE_LAYER } : {};
  if (!map.getLayer(GA_TRAFFIC_FLOW_CASING)) {
    map.addLayer({
      id: GA_TRAFFIC_FLOW_CASING,
      type: 'line',
      source: GA_TRAFFIC_FLOW_SOURCE,
      ...sourceLayer,
      minzoom: FLOW_MIN_ZOOM,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': '#05070c', 'line-opacity': 0.75, 'line-width': CASING_WIDTH },
    });
  }
  if (!map.getLayer(GA_TRAFFIC_FLOW_LAYER)) {
    map.addLayer({
      id: GA_TRAFFIC_FLOW_LAYER,
      type: 'line',
      source: GA_TRAFFIC_FLOW_SOURCE,
      ...sourceLayer,
      minzoom: FLOW_MIN_ZOOM,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-color': FLOW_COLOR_EXPRESSION, 'line-opacity': 0.9, 'line-width': WIDTH },
    });
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

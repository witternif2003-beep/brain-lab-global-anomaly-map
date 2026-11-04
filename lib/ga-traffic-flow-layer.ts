import type { GeoJSONSourceSpecification, Map as MapLibreMap, VectorSourceSpecification } from 'maplibre-gl';
import { FLOW_COLOR_EXPRESSION, FLOW_COLORS, FLOW_MIN_ZOOM, FLOW_SOURCE_LAYER, FLOW_TILE_MAX_ZOOM, TOMTOM_FLOW_DOCS_URL, type FlowMode } from './ga-traffic-flow/flow';
import { reportGaFeed } from './ga-live-status';

export const GA_TRAFFIC_FLOW_SOURCE = 'ga-traffic-flow';
export const GA_TRAFFIC_FLOW_LAYER = 'ga-traffic-flow-line';

interface FlowStatus {
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
  { label: 'free ≥ 75% of free-flow speed', color: FLOW_COLORS.free },
  { label: 'slow 40–75%', color: FLOW_COLORS.slow },
  { label: 'jam < 40%', color: FLOW_COLORS.jam },
  { label: 'closed', color: FLOW_COLORS.closed },
];

/** Congestion polylines (not vehicles): live TomTom tiles via the server proxy when a key is set, labelled mock data only when TRAFFIC_FLOW_MOCK=1, otherwise nothing. Drawn above the road overlay. */
export async function addGaTrafficFlowLayer(map: MapLibreMap): Promise<void> {
  let p = statusByMap.get(map);
  if (!p) {
    p = fetch('/api/traffic-flow').then((r) => (r.ok ? (r.json() as Promise<FlowStatus>) : Promise.reject(new Error(`HTTP ${r.status}`))));
    statusByMap.set(map, p);
    p.catch(() => statusByMap.delete(map));
  }
  let s: FlowStatus;
  try {
    s = await p;
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
  if (!map.getLayer(GA_TRAFFIC_FLOW_LAYER)) {
    map.addLayer({
      id: GA_TRAFFIC_FLOW_LAYER,
      type: 'line',
      source: GA_TRAFFIC_FLOW_SOURCE,
      ...(s.mode === 'live' ? { 'source-layer': FLOW_SOURCE_LAYER } : {}),
      minzoom: FLOW_MIN_ZOOM,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': FLOW_COLOR_EXPRESSION,
        'line-opacity': 0.9,
        'line-width': ['interpolate', ['exponential', 1.6], ['zoom'], 6, 1, 12, 2.5, 16, 6, 20, 14],
      },
    });
  }
  reportGaFeed(map, {
    id: 'traffic-flow',
    label: s.mode === 'mock' ? `${LABEL}: MOCK` : LABEL,
    color: FLOW_COLORS.free,
    count: s.mode === 'mock' ? s.mock?.features.length ?? 0 : null,
    detail: s.mode === 'mock' ? 'MOCK segments for local testing, not real traffic' : `speed vs free-flow, tiles cached ${60} s`,
    updatedAt: s.generatedAt,
    sourceUrl: s.sourceUrl,
    swatches,
  });
}

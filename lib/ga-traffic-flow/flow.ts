import type { ExpressionSpecification } from 'maplibre-gl';

/** TomTom Traffic Vector Flow Tiles (relative = current speed / free-flow speed, 0..1). */
export const TOMTOM_FLOW_DOCS_URL = 'https://developer.tomtom.com/traffic-api/documentation/traffic-flow/vector-flow-tiles';
export const FLOW_SOURCE_LAYER = 'Traffic flow';
export const FLOW_TILE_PATH = '/api/traffic-flow/{z}/{x}/{y}';
export const FLOW_MIN_ZOOM = 6;
export const FLOW_TILE_MAX_ZOOM = 22;
export const FLOW_TILE_CACHE_S = 60;

export type FlowMode = 'live' | 'mock' | 'off';
export type FlowBand = 'free' | 'slow' | 'jam' | 'closed';

/** jamFactor bands (0 free … 10 standstill): green 0–3, yellow 4–6, orange 7–8, red 9–10 or closed. */
export const JAM_BANDS: Record<Exclude<FlowBand, 'closed'>, readonly number[]> = { free: [0, 1, 2, 3], slow: [4, 5, 6], jam: [7, 8] };
export const FLOW_COLORS: Record<FlowBand, string> = { free: '#00e676', slow: '#ffeb3b', jam: '#ff9800', closed: '#f44336' };

export interface FlowEnv {
  TOMTOM_API_KEY?: string;
  TRAFFIC_FLOW_MOCK?: string;
}

/** A TomTom key switches on live tiles; mock only when explicitly requested; otherwise off (no invented congestion). */
export function flowMode(env: FlowEnv): FlowMode {
  if (env.TOMTOM_API_KEY?.trim()) return 'live';
  if (env.TRAFFIC_FLOW_MOCK === '1') return 'mock';
  return 'off';
}

export function validTile(z: number, x: number, y: number): boolean {
  if (![z, x, y].every(Number.isInteger)) return false;
  if (z < 0 || z > 22) return false;
  const n = 2 ** z;
  return x >= 0 && y >= 0 && x < n && y < n;
}

export function tomtomFlowTileUrl(z: number, x: number, y: number, key: string): string {
  return `https://api.tomtom.com/traffic/map/4/tile/flow/relative/${z}/${x}/${y}.pbf?key=${encodeURIComponent(key)}`;
}

/** TomTom flow tiles carry `traffic_level` (current / free-flow speed, 0..1), not a jamFactor, so it is derived: round(10 × (1 − level)). */
export function jamFactor(level: number | null | undefined): number {
  const v = typeof level === 'number' && Number.isFinite(level) ? Math.min(1, Math.max(0, level)) : 1;
  return Math.round(10 * (1 - v));
}

export function flowBand(level: number | null | undefined, closed = false): FlowBand {
  if (closed) return 'closed';
  const j = jamFactor(level);
  if (JAM_BANDS.free.includes(j)) return 'free';
  if (JAM_BANDS.slow.includes(j)) return 'slow';
  if (JAM_BANDS.jam.includes(j)) return 'jam';
  return 'closed';
}

const JAM_FACTOR = ['round', ['*', 10, ['-', 1, ['min', 1, ['max', 0, ['to-number', ['get', 'traffic_level'], 1]]]]]] as ExpressionSpecification;

export const FLOW_COLOR_EXPRESSION: ExpressionSpecification = [
  'case',
  ['has', 'road_closure'], FLOW_COLORS.closed,
  ['match', JAM_FACTOR,
    [...JAM_BANDS.free], FLOW_COLORS.free,
    [...JAM_BANDS.slow], FLOW_COLORS.slow,
    [...JAM_BANDS.jam], FLOW_COLORS.jam,
    FLOW_COLORS.closed],
] as ExpressionSpecification;

export interface FlowFeature {
  type: 'Feature';
  properties: { traffic_level: number; road_closure?: true; road: string; mock: true };
  geometry: { type: 'LineString'; coordinates: [number, number][] };
}

/** Clearly-labelled mock segments around Atlanta for local development (TRAFFIC_FLOW_MOCK=1). Not real traffic. */
export function mockFlowCollection(): { type: 'FeatureCollection'; features: FlowFeature[] } {
  const seg = (road: string, traffic_level: number, coordinates: [number, number][], closed = false): FlowFeature => ({
    type: 'Feature',
    properties: { traffic_level, road, mock: true, ...(closed ? { road_closure: true as const } : {}) },
    geometry: { type: 'LineString', coordinates },
  });
  return {
    type: 'FeatureCollection',
    features: [
      seg('MOCK I-75/85 Downtown Connector', 0.3, [[-84.3870, 33.7900], [-84.3880, 33.7700], [-84.3890, 33.7550]]),
      seg('MOCK I-75/85 Downtown Connector', 0.55, [[-84.3890, 33.7550], [-84.3920, 33.7400], [-84.4000, 33.7250]]),
      seg('MOCK I-20', 0.9, [[-84.4600, 33.7380], [-84.4200, 33.7400], [-84.3890, 33.7480], [-84.3400, 33.7420]]),
      seg('MOCK GA-400', 0.65, [[-84.3700, 33.8200], [-84.3650, 33.8500], [-84.3620, 33.8800]]),
      seg('MOCK I-285 (closure)', 0.0, [[-84.3700, 33.9100], [-84.3300, 33.9180]], true),
    ],
  };
}

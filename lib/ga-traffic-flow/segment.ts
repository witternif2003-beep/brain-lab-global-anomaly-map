import { GA_BBOX } from '../ga-live-markers/parse';

export const TOMTOM_SEGMENT_DOCS_URL = 'https://developer.tomtom.com/traffic-api/documentation/traffic-flow/flow-segment-data';
export const SEGMENT_CACHE_S = 30;

export interface SegmentSummary {
  currentSpeedMph: number | null;
  freeFlowSpeedMph: number | null;
  /** currentSpeed / freeFlowSpeed; null when free-flow speed is missing or 0. */
  ratio: number | null;
  condition: 'closed' | 'heavy' | 'slow' | 'free' | null;
  confidence: number | null;
  currentTravelTimeS: number | null;
  freeFlowTravelTimeS: number | null;
  roadClosure: boolean;
  frc: string | null;
}

const fin = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** "lat,lon" inside Georgia, else null. */
export function parsePoint(raw: string | null): { lat: number; lon: number } | null {
  const m = raw?.trim().match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
  if (!m) return null;
  const lat = Number(m[1]), lon = Number(m[2]);
  return lat >= GA_BBOX.south && lat <= GA_BBOX.north && lon >= GA_BBOX.west && lon <= GA_BBOX.east ? { lat, lon } : null;
}

export const tomtomSegmentUrl = (lat: number, lon: number, key: string) =>
  `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/22/json?point=${lat},${lon}&unit=MPH&key=${encodeURIComponent(key)}`;

/** TomTom's measured speeds for the road segment nearest the point; nothing is estimated here. */
export function summarizeSegment(json: unknown): SegmentSummary | null {
  const f = (json as { flowSegmentData?: Record<string, unknown> } | null)?.flowSegmentData;
  if (!f) return null;
  const cur = fin(f.currentSpeed), free = fin(f.freeFlowSpeed);
  const ratio = cur !== null && free !== null && free > 0 ? Math.round((cur / free) * 100) / 100 : null;
  const roadClosure = f.roadClosure === true;
  return {
    currentSpeedMph: cur,
    freeFlowSpeedMph: free,
    ratio,
    condition: roadClosure ? 'closed' : ratio === null ? null : ratio < 0.5 ? 'heavy' : ratio < 0.8 ? 'slow' : 'free',
    confidence: fin(f.confidence),
    currentTravelTimeS: fin(f.currentTravelTime),
    freeFlowTravelTimeS: fin(f.freeFlowTravelTime),
    roadClosure,
    frc: typeof f.frc === 'string' ? f.frc : null,
  };
}

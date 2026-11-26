export const TOMTOM_ROUTING_DOCS_URL = 'https://developer.tomtom.com/routing-api/documentation/tomtom-maps/calculate-route';
export type LngLat = [lon: number, lat: number];
/** Georgia plus about one degree, so routes can start or end just over the state line. */
export const ROUTE_BOUNDS = [-86.6, 29.3, -79.8, 36.0] as const;

export function parseLngLat(q: string | null): LngLat | null {
  const v = (q ?? '').split(',').map(Number);
  if (v.length !== 2 || !v.every(Number.isFinite)) return null;
  const [lon, lat] = v;
  const [w, s, e, n] = ROUTE_BOUNDS;
  return lon >= w && lon <= e && lat >= s && lat <= n ? [lon, lat] : null;
}

export function calculateRouteUrl(a: LngLat, b: LngLat, key: string): string {
  const q = new URLSearchParams({ key, traffic: 'true', routeType: 'fastest', travelMode: 'car', computeTravelTimeFor: 'all', routeRepresentation: 'polyline' });
  return `https://api.tomtom.com/routing/1/calculateRoute/${a[1].toFixed(6)},${a[0].toFixed(6)}:${b[1].toFixed(6)},${b[0].toFixed(6)}/json?${q}`;
}

export interface RouteSummary {
  lengthInMeters: number;
  travelTimeInSeconds: number;
  trafficDelayInSeconds: number;
  noTrafficTravelTimeInSeconds?: number;
  departureTime: string;
  arrivalTime: string;
}

interface RawRoute { routes?: Array<{ summary: RouteSummary; legs: Array<{ points: Array<{ latitude: number; longitude: number }> }> }> }

export function routeToFeature(raw: RawRoute): GeoJSON.Feature<GeoJSON.LineString, RouteSummary> | null {
  const r = raw.routes?.[0];
  if (!r) return null;
  const coordinates = r.legs.flatMap((l) => l.points.map((p) => [p.longitude, p.latitude]));
  if (coordinates.length < 2) return null;
  const s = r.summary;
  return {
    type: 'Feature',
    geometry: { type: 'LineString', coordinates },
    properties: {
      lengthInMeters: s.lengthInMeters, travelTimeInSeconds: s.travelTimeInSeconds, trafficDelayInSeconds: s.trafficDelayInSeconds,
      noTrafficTravelTimeInSeconds: s.noTrafficTravelTimeInSeconds, departureTime: s.departureTime, arrivalTime: s.arrivalTime,
    },
  };
}

export function routeSummaryText(s: RouteSummary): string {
  const km = (s.lengthInMeters / 1000).toFixed(1);
  const min = Math.round(s.travelTimeInSeconds / 60);
  const delay = Math.round(s.trafficDelayInSeconds / 60);
  return `${km} km · ${min} min${delay > 0 ? ` (incl. ${delay} min traffic delay)` : ' · no traffic delay'}`;
}

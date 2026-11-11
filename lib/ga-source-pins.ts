/**
 * Categories for the Georgia source-pin page: every layer `/api/ga-live-markers` serves, drawn
 * as a pin at the longitude and latitude the API returns. `position` says how that point relates
 * to the original source, because a few layers are placed or coarsened before they reach the API.
 */
import type { LiveLayer, LiveMarker } from './ga-live-markers/parse';

export type LngLat = [number, number];
export type PinGroup = 'moving' | 'reports' | 'sensors' | 'fixed';

export interface PinCategory {
  layer: LiveLayer;
  label: string;
  group: PinGroup;
  /** How the drawn point relates to the source's own coordinate. */
  position: string;
  on: boolean;
}

const AS_PUBLISHED = "the source's own latitude/longitude";

export const PIN_CATEGORIES: PinCategory[] = [
  { layer: 'aircraft', label: 'Aircraft (ADS-B)', group: 'moving', position: AS_PUBLISHED, on: true },
  { layer: 'vessels', label: 'Ships and boats (AIS)', group: 'moving', position: AS_PUBLISHED, on: true },
  { layer: 'transit', label: 'Transit buses (GTFS-RT)', group: 'moving', position: AS_PUBLISHED, on: true },
  { layer: 'micromobility', label: 'Parked scooters/bikes (GBFS)', group: 'moving', position: AS_PUBLISHED, on: true },
  { layer: 'quakes', label: 'Earthquakes, 30 days (USGS)', group: 'reports', position: AS_PUBLISHED, on: false },
  { layer: 'pireps', label: 'Pilot reports, 6 h (NOAA AWC)', group: 'reports', position: AS_PUBLISHED, on: false },
  { layer: 'tfr', label: 'FAA flight restrictions', group: 'reports', position: AS_PUBLISHED, on: false },
  { layer: 'augusta911', label: 'Augusta E911 calls', group: 'reports', position: 'coordinates in the post, else the address geocoded by Augusta GIS', on: false },
  { layer: 'athens911', label: 'Athens-Clarke PD calls', group: 'reports', position: AS_PUBLISHED, on: false },
  { layer: 'policereports', label: 'Police-reported offences', group: 'reports', position: 'block-level point rounded to 3 decimals (~110 m) by this app', on: false },
  { layer: 'stations', label: 'Weather/hydro stations (IEM)', group: 'sensors', position: AS_PUBLISHED, on: false },
  { layer: 'streamgauges', label: 'USGS stream gauges', group: 'sensors', position: AS_PUBLISHED, on: false },
  { layer: 'ga511events', label: 'Road events (511GA)', group: 'reports', position: AS_PUBLISHED, on: false },
  { layer: 'gdotcams', label: 'GDOT traffic cameras', group: 'sensors', position: AS_PUBLISHED, on: false },
  { layer: 'webcams', label: 'Public webcams (GEMA)', group: 'sensors', position: AS_PUBLISHED, on: false },
  { layer: 'policetech', label: 'Police surveillance tech by agency', group: 'fixed', position: 'agency facility, else city or county centre', on: false },
  { layer: 'police', label: 'Police facilities (OSM)', group: 'fixed', position: AS_PUBLISHED, on: false },
  { layer: 'firestations', label: 'Fire stations (OSM)', group: 'fixed', position: AS_PUBLISHED, on: false },
  { layer: 'sirens', label: 'Warning sirens (OSM)', group: 'fixed', position: AS_PUBLISHED, on: false },
  { layer: 'speedcams', label: 'Speed cameras (OSM)', group: 'fixed', position: AS_PUBLISHED, on: false },
  { layer: 'alpr', label: 'Plate-reader cameras (OSM)', group: 'fixed', position: AS_PUBLISHED, on: false },
  { layer: 'celltowers', label: 'Cell towers (HIFLD / FCC)', group: 'fixed', position: AS_PUBLISHED, on: true },
  { layer: 'towers', label: 'Communication towers (OSM)', group: 'fixed', position: AS_PUBLISHED, on: false },
  { layer: 'signals', label: 'Traffic signals (OSM)', group: 'fixed', position: AS_PUBLISHED, on: false },
  { layer: 'equipment', label: 'Public equipment (OSM)', group: 'fixed', position: AS_PUBLISHED, on: false },
];

export interface LayerResponse {
  layer: LiveLayer;
  generatedAt: string;
  refreshSeconds: number;
  source: string;
  sourceUrl: string;
  feeds: { id: string; url: string; count: number | null; error: string | null }[];
  markers: LiveMarker[];
}

export interface SourcePin {
  /** Identity across refreshes (`pinId`). */
  key: string;
  layer: LiveLayer;
  position: LngLat;
  marker: LiveMarker;
}

/** One pin per marker at the API's coordinate, unchanged. */
export function toPins(layer: LiveLayer, body: Pick<LayerResponse, 'markers'>): SourcePin[] {
  return body.markers
    .filter((m) => Number.isFinite(m.lon) && Number.isFinite(m.lat))
    .map((m) => ({ key: pinId(layer, m), layer, position: [m.lon, m.lat], marker: m }));
}

/** Next poll, in ms: the API's own refresh interval, never faster than 10 s. */
export function pollMs(body: Pick<LayerResponse, 'refreshSeconds'> | null): number {
  const s = body && Number.isFinite(body.refreshSeconds) ? body.refreshSeconds : 60;
  return Math.max(10, s) * 1000;
}

/** Age label for a layer, so a feed that stops updating shows as stale instead of current. */
export function staleness(generatedAt: string, refreshSeconds: number, nowMs = Date.now()): 'fresh' | 'stale' {
  const age = (nowMs - Date.parse(generatedAt)) / 1000;
  return Number.isFinite(age) && age <= Math.max(refreshSeconds, 10) * 3 ? 'fresh' : 'stale';
}

export const GA_BOUNDARY_URL = '/geo/ga-state-boundary.geojson';
export const GA_CENTER: LngLat = [-83.441, 32.641];

/** Largest ring of the boundary FeatureCollection: Georgia's mainland outline. */
export function largestRing(fc: { features: Array<{ geometry: { type: string; coordinates: unknown } }> }): LngLat[] {
  let best: LngLat[] = [];
  for (const f of fc.features ?? []) {
    const polys = (f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates]) as LngLat[][][];
    for (const poly of polys) for (const ring of poly) if (ring.length > best.length) best = ring;
  }
  return best;
}

export async function loadGaRing(url = GA_BOUNDARY_URL): Promise<LngLat[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`boundary ${res.status}`);
  return largestRing(await res.json());
}

const ID_PROPS = ['vehicle', 'vid', 'hex', 'osm', 'site', 'cameraId', 'eventId', 'station', 'objectId', 'incident', 'url'] as const;

/** Identity that survives a refresh, so a selected pin stays selected when its source moves it. */
export function pinId(layer: LiveLayer, m: LiveMarker): string {
  for (const k of ID_PROPS) {
    const v = m.props[k];
    if (v !== null && v !== undefined && v !== '') return `${layer}:${k}:${v}:${m.props.agency ?? ''}`;
  }
  return `${layer}:label:${m.label}`;
}

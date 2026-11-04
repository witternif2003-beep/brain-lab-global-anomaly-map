import type { GeoJSONSource, LightSpecification, Map as MapLibreMap } from 'maplibre-gl';
import { sunAzimuthDeg, sunElevationDeg } from '../ga-sky';
import { DEFAULT_HEIGHT_M, FLOOR_HEIGHT_M } from './overture';

export const SHADOW_SOURCE = 'ga-building-shadows';
export const SHADOW_LAYER = 'buildings-shadow';
export const SHADOW_MIN_ZOOM = 15;
export const SHADOW_MIN_SUN_DEG = 2;
export const SHADOW_MAX_FEATURES = 4000;
/** Shadows longer than this many building heights (sun under ~7°) are clipped. */
export const SHADOW_MAX_RATIO = 8;
const SUN_REFRESH_MS = 60_000;
const RAD = Math.PI / 180;
const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LNG = 111_320;

type Pt = [number, number];

/** MapLibre light from the real sun: polar angle 0° is overhead, azimuth clockwise from north (map anchor). */
export function sunLight(azimuthDeg: number, elevationDeg: number): LightSpecification {
  const el = Math.max(-6, Math.min(90, elevationDeg));
  const up = Math.max(0, Math.sin(el * RAD));
  return {
    anchor: 'map',
    position: [1.5, ((azimuthDeg % 360) + 360) % 360, Math.max(0, Math.min(90, 90 - el))],
    color: el < 10 ? '#ffd7a8' : '#fff7ec',
    intensity: el <= 0 ? 0.15 : 0.3 + 0.35 * up,
  };
}

/** Ground offset in metres [east, north] of a roof edge's shadow, cast away from the sun; null when the sun is too low. */
export function shadowOffsetM(heightM: number, azimuthDeg: number, elevationDeg: number): Pt | null {
  if (elevationDeg < SHADOW_MIN_SUN_DEG || heightM <= 0) return null;
  const len = Math.min(heightM / Math.tan(elevationDeg * RAD), heightM * SHADOW_MAX_RATIO);
  const away = (azimuthDeg + 180) * RAD;
  return [len * Math.sin(away), len * Math.cos(away)];
}

/** Andrew's monotone-chain convex hull; returns a closed ring. */
export function convexHull(points: Pt[]): Pt[] {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Pt[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p[i]) <= 0) upper.pop();
    upper.push(p[i]);
  }
  const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
  return [...hull, hull[0]];
}

/** Flat-ground shadow of a footprint ring (lng/lat): hull of the footprint and its copy shifted by the roof shadow offset. */
export function shadowRing(ring: Pt[], heightM: number, azimuthDeg: number, elevationDeg: number): Pt[] | null {
  const off = shadowOffsetM(heightM, azimuthDeg, elevationDeg);
  if (!off || ring.length < 3) return null;
  const dLng = off[0] / (M_PER_DEG_LNG * Math.cos(ring[0][1] * RAD));
  const dLat = off[1] / M_PER_DEG_LAT;
  return convexHull([...ring, ...ring.map(([x, y]) => [x + dLng, y + dLat] as Pt)]);
}

/** Source height from Overture tile properties: recorded height, else floors × 3.2 m, else 5 m. */
export function propertyHeightM(props: Record<string, unknown> | null | undefined): number {
  const h = Number(props?.height);
  if (Number.isFinite(h) && h > 0) return h;
  const floors = Number(props?.num_floors ?? props?.['building:levels']);
  if (Number.isFinite(floors) && floors > 0) return floors * FLOOR_HEIGHT_M;
  return DEFAULT_HEIGHT_M;
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/** Sun-driven extrusion light plus flat-ground building shadows draped on the terrain; returns a detach function. */
export function attachBuildingLighting(map: MapLibreMap, now: () => Date = () => new Date(), sourceLayers: string[] = ['buildings-3d', 'buildings-3d-shell']): () => void {
  let lastKey = '';
  if (!map.getSource(SHADOW_SOURCE)) map.addSource(SHADOW_SOURCE, { type: 'geojson', data: EMPTY });
  if (!map.getLayer(SHADOW_LAYER)) {
    const before = sourceLayers.find((id) => map.getLayer(id));
    map.addLayer({ id: SHADOW_LAYER, type: 'fill', source: SHADOW_SOURCE, minzoom: SHADOW_MIN_ZOOM, paint: { 'fill-color': '#0b1020', 'fill-opacity': 0.35, 'fill-antialias': false } }, before);
  }
  const update = () => {
    const c = map.getCenter();
    const at = now();
    const az = sunAzimuthDeg(at, c.lat, c.lng);
    const el = sunElevationDeg(at, c.lat, c.lng);
    const key = `${c.lng.toFixed(4)}|${c.lat.toFixed(4)}|${map.getZoom().toFixed(2)}|${map.getBearing().toFixed(1)}|${Math.floor(at.getTime() / SUN_REFRESH_MS)}`;
    if (key === lastKey) return;
    lastKey = key;
    map.setLight(sunLight(az, el));
    const src = map.getSource(SHADOW_SOURCE) as GeoJSONSource | undefined;
    if (!src) return;
    const layers = sourceLayers.filter((id) => map.getLayer(id));
    if (map.getZoom() < SHADOW_MIN_ZOOM || el < SHADOW_MIN_SUN_DEG || !layers.length) {
      src.setData(EMPTY);
      return;
    }
    map.setPaintProperty(SHADOW_LAYER, 'fill-opacity', 0.15 + 0.25 * Math.min(1, el / 30));
    const seen = new Set<string | number>();
    const features: GeoJSON.Feature[] = [];
    for (const f of map.queryRenderedFeatures({ layers })) {
      if (features.length >= SHADOW_MAX_FEATURES) break;
      if (f.id !== undefined) {
        if (seen.has(f.id)) continue;
        seen.add(f.id);
      }
      const h = propertyHeightM(f.properties) - Math.max(0, Number(f.properties?.min_height) || 0);
      const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
      for (const poly of polys) {
        const ring = shadowRing(poly[0] as Pt[], h, az, el);
        if (ring) features.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: {} });
      }
    }
    src.setData({ type: 'FeatureCollection', features });
  };
  map.on('idle', update);
  const timer = setInterval(() => map.triggerRepaint(), SUN_REFRESH_MS);
  update();
  return () => {
    map.off('idle', update);
    clearInterval(timer);
  };
}

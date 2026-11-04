import type { Map as MapLibreMap, MapMouseEvent } from 'maplibre-gl';
import { OVERTURE_BUILDINGS_SOURCE, DEFAULT_HEIGHT_M, FLOOR_HEIGHT_M } from '../ga-buildings/overture';
import { BlindspotDetector, BuildingIndex, ViewshedEngine, localFrame, type Building, type Observer } from './engine';

export const VIEWSHED_SOURCE = 'ga-viewshed';
export const BLINDSPOT_SOURCE = 'ga-blindspots';
export const VIEWSHED_LAYERS = ['ga-viewshed-fill', 'ga-viewshed-line', 'ga-blindspot-fill'] as const;
/** Default observer eye height above the roof or ground, metres. */
export const EYE_M = 1.7;

export interface ViewshedResult {
  lngLat: [number, number];
  observerHeightM: number;
  buildings: number;
  areaM2: number;
  circleAreaM2: number;
  coverage: number;
  viewshedMs: number;
  blindspotMs: number;
}

type FeatureCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, unknown>>;
const empty = (): FeatureCollection => ({ type: 'FeatureCollection', features: [] });

export function addViewshedLayers(map: MapLibreMap): void {
  if (!map.getSource(BLINDSPOT_SOURCE)) map.addSource(BLINDSPOT_SOURCE, { type: 'geojson', data: empty() });
  if (!map.getSource(VIEWSHED_SOURCE)) {
    map.addSource(VIEWSHED_SOURCE, {
      type: 'geojson',
      data: empty(),
      attribution: 'Line of sight computed from Overture/OpenStreetMap building heights and MapLibre terrain — public data only',
    });
  }
  if (!map.getLayer('ga-blindspot-fill')) {
    map.addLayer({ id: 'ga-blindspot-fill', type: 'fill', source: BLINDSPOT_SOURCE, paint: { 'fill-color': '#f43f5e', 'fill-opacity': 0.35 } });
  }
  if (!map.getLayer('ga-viewshed-fill')) {
    map.addLayer({ id: 'ga-viewshed-fill', type: 'fill', source: VIEWSHED_SOURCE, paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.22 } });
  }
  if (!map.getLayer('ga-viewshed-line')) {
    map.addLayer({ id: 'ga-viewshed-line', type: 'line', source: VIEWSHED_SOURCE, paint: { 'line-color': '#22d3ee', 'line-width': 1.5, 'line-opacity': 0.9 } });
  }
}

export function clearViewshed(map: MapLibreMap): void {
  (map.getSource(VIEWSHED_SOURCE) as { setData?: (d: FeatureCollection) => void } | undefined)?.setData?.(empty());
  (map.getSource(BLINDSPOT_SOURCE) as { setData?: (d: FeatureCollection) => void } | undefined)?.setData?.(empty());
}

function heightOf(p: Record<string, unknown>): number {
  const h = Number(p.height);
  if (Number.isFinite(h) && h > 0) return h;
  const f = Number(p.num_floors);
  return Number.isFinite(f) && f > 0 ? f * FLOOR_HEIGHT_M : DEFAULT_HEIGHT_M;
}

/** Buildings in view as local-metre rings with roof heights above sea level. */
export function collectBuildings(map: MapLibreMap, toLocal: (lng: number, lat: number) => [number, number], ground: (x: number, y: number) => number): Building[] {
  let features: GeoJSON.Feature[];
  try {
    features = map.querySourceFeatures(OVERTURE_BUILDINGS_SOURCE, { sourceLayer: 'building' }) as unknown as GeoJSON.Feature[];
  } catch {
    return [];
  }
  const seen = new Set<string>();
  const out: Building[] = [];
  for (const f of features) {
    const g = f.geometry;
    const coords = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null;
    if (!coords || coords.length < 4) continue;
    const key = String(f.id ?? `${coords[0][0]},${coords[0][1]}`);
    if (seen.has(key)) continue;
    seen.add(key);
    const ring = new Float64Array(coords.length * 2);
    let sx = 0, sy = 0;
    for (let i = 0; i < coords.length; i++) {
      const [x, y] = toLocal(coords[i][0], coords[i][1]);
      ring[i * 2] = x;
      ring[i * 2 + 1] = y;
      sx += x;
      sy += y;
    }
    const state = (f as { state?: Record<string, unknown> }).state ?? {};
    const lidar = Number(state.lidarHeight);
    const h = Number.isFinite(lidar) && lidar > 0 ? lidar : heightOf((f.properties ?? {}) as Record<string, unknown>);
    out.push({ ring, topM: ground(sx / coords.length, sy / coords.length) + h });
  }
  return out;
}

export interface ViewshedRunOptions {
  radiusM?: number;
  azimuths?: number;
  aoiM?: number;
  cellM?: number;
}

/**
 * Runs one viewshed and one blind-spot pass for an observer at `lngLat`, standing on the roof if the
 * click lands on a building, and draws both on the map.
 */
export function runViewshedAt(map: MapLibreMap, lngLat: [number, number], opts: ViewshedRunOptions = {}): ViewshedResult {
  const radiusM = opts.radiusM ?? 500;
  const frame = localFrame(lngLat[0], lngLat[1]);
  const ground = (x: number, y: number) => {
    const [lng, lat] = frame.toLngLat(x, y);
    return map.queryTerrainElevation([lng, lat]) ?? 0;
  };
  const index = new BuildingIndex(collectBuildings(map, frame.toLocal, ground));
  const under = index.buildingAt(0, 0);
  const observer: Observer = { x: 0, y: 0, z: (under ? under.topM : ground(0, 0)) + EYE_M };
  const engine = new ViewshedEngine(index, ground);
  const vs = engine.analyze(observer, { radiusM, azimuths: opts.azimuths ?? 360 });
  const aoi = (opts.aoiM ?? 200) / 2;
  const grid = new BlindspotDetector(engine, index).detect({ x0: -aoi, y0: -aoi, x1: aoi, y1: aoi }, [observer], { cellM: opts.cellM ?? 5 });

  const ring = vs.ring.map(([x, y]) => frame.toLngLat(x, y));
  (map.getSource(VIEWSHED_SOURCE) as { setData?: (d: FeatureCollection) => void } | undefined)?.setData?.({
    type: 'FeatureCollection',
    features: [{ type: 'Feature', properties: { areaM2: Math.round(vs.areaM2) }, geometry: { type: 'Polygon', coordinates: [ring] } }],
  });
  const blind: GeoJSON.Feature<GeoJSON.Geometry, Record<string, unknown>>[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (grid.cells[r * grid.cols + c] !== 0) continue;
      const x = -aoi + c * grid.cellM, y = -aoi + r * grid.cellM;
      const p = [frame.toLngLat(x, y), frame.toLngLat(x + grid.cellM, y), frame.toLngLat(x + grid.cellM, y + grid.cellM), frame.toLngLat(x, y + grid.cellM)];
      blind.push({ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[...p, p[0]]] } });
    }
  }
  (map.getSource(BLINDSPOT_SOURCE) as { setData?: (d: FeatureCollection) => void } | undefined)?.setData?.({ type: 'FeatureCollection', features: blind });

  return {
    lngLat,
    observerHeightM: observer.z - ground(0, 0),
    buildings: index.size,
    areaM2: vs.areaM2,
    circleAreaM2: vs.circleAreaM2,
    coverage: grid.coverage,
    viewshedMs: vs.ms,
    blindspotMs: grid.ms,
  };
}

/** Click-to-analyse mode: the next map click becomes the observer. */
export function onceOnMapClick(map: MapLibreMap, handler: (lngLat: [number, number]) => void): () => void {
  const fn = (e: MapMouseEvent) => handler([e.lngLat.lng, e.lngLat.lat]);
  map.once('click', fn);
  return () => map.off('click', fn);
}

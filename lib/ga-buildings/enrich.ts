import type { Map as MapLibreMap } from 'maplibre-gl';
import { gaLidarNodes } from '../ga-lidar-layer';
import { lngLatTo3857 } from '../ga-lidar/ept';
import { gpuLedgerPressure } from '../map/gpu-ledger-controller';
import { applyLidarHeights, indexRoofReturns, ringFromCoordinates, type HeightStats, type ReturnIndex } from './lidar-heights';
import { buildRoofModel, roofPoints } from './lidar-roofs';
import { lidarRoofLayer, ROOF_MESH_MIN_ZOOM } from './lidar-roof-layer';
import { applyRoofImagery, ROOF_MIN_ZOOM, type RoofStats } from './roof-imagery';
import { OVERTURE_BUILDINGS_SOURCE, OVERTURE_FULL_ZOOM } from './overture';

export interface RoofFitStats {
  /** Roofs reconstructed from LiDAR planes and drawn. */
  roofsFitted: number;
  /** Footprints whose returns did not support a fit (too few, too scattered, or RMS too high); kept flat. */
  roofsRejected: number;
  /** Median RMS of drawn roofs against their own returns, metres. */
  roofRmsMedianM: number | null;
  roofKinds: Record<string, number>;
}

export interface BuildingEnrichStats extends HeightStats, RoofStats, RoofFitStats {
  /** Buildings whose height is LiDAR-measured rather than Overture-recorded. */
  lidarNodes: number;
}

/** While LiDAR nodes stream in, the return grid is rebuilt at most this often. */
export const INDEX_REBUILD_MS = 10_000;

/** Enrichment pass interval while the camera is still. */
export const ENRICH_TICK_MS = 2500;

/** Roofs fitted per idle so one pan never stalls a frame for long. */
export const ROOF_FITS_PER_IDLE = 12;

/** Footprint centroids of the buildings in view, EPSG:3857 metres. */
export function visibleCentroids(map: MapLibreMap): { id: string | number; x: number; y: number }[] {
  let features: GeoJSON.Feature[];
  try {
    features = map.querySourceFeatures(OVERTURE_BUILDINGS_SOURCE, { sourceLayer: 'building' }) as unknown as GeoJSON.Feature[];
  } catch {
    return [];
  }
  const out: { id: string | number; x: number; y: number }[] = [];
  for (const f of features) {
    const id = f.id;
    if (typeof id !== 'string' && typeof id !== 'number') continue;
    const g = f.geometry;
    const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null;
    if (!ring?.length) continue;
    let lng = 0, lat = 0;
    for (const c of ring) {
      lng += c[0];
      lat += c[1];
    }
    const [x, y] = lngLatTo3857(lng / ring.length, lat / ring.length);
    out.push({ id, x, y });
  }
  return out;
}

const median = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

/** Fits LiDAR roofs for buildings in view, hands meshes to the roof layer and cuts their walls at the measured eave. */
/** `done`: drawn roofs; `tried`: footprints rejected against the current return grid (reset when more LiDAR arrives). */
export function applyLidarRoofs(map: MapLibreMap, done: Set<string>, rms: number[], stats: RoofFitStats, index: ReturnIndex, tried = new Set<string>()): void {
  const layer = lidarRoofLayer(map);
  if (!layer || !index.x.length) return;
  let features: GeoJSON.Feature[];
  try {
    features = map.querySourceFeatures(OVERTURE_BUILDINGS_SOURCE, { sourceLayer: 'building', filter: ['!=', ['get', 'has_parts'], true] }) as unknown as GeoJSON.Feature[];
  } catch {
    return;
  }
  const [cx, cy] = lngLatTo3857(map.getCenter().lng, map.getCenter().lat);
  for (const id of layer.farthest(cx, cy, Math.floor(layer.limits.roofs * 0.8))) {
    layer.remove(id);
    done.delete(id);
    map.removeFeatureState({ source: OVERTURE_BUILDINGS_SOURCE, sourceLayer: 'building', id }, 'lidarEave');
  }
  let budget = ROOF_FITS_PER_IDLE;
  for (const f of features) {
    if (budget <= 0 || layer.size >= layer.limits.roofs) break;
    const id = f.id;
    if (typeof id !== 'string' && typeof id !== 'number') continue;
    const key = String(id);
    if (done.has(key) || tried.has(key) || layer.has(key)) continue;
    const g = f.geometry;
    const outer = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null;
    if (!outer || outer.length < 4) continue;
    budget--;
    const ring = ringFromCoordinates(outer);
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let i = 0; i < ring.xy.length; i += 2) {
      minX = Math.min(minX, ring.xy[i]);
      maxX = Math.max(maxX, ring.xy[i]);
      minY = Math.min(minY, ring.xy[i + 1]);
      maxY = Math.max(maxY, ring.xy[i + 1]);
    }
    const ox = (minX + maxX) / 2, oy = (minY + maxY) / 2;
    const local = new Float64Array(ring.xy.length);
    for (let i = 0; i < ring.xy.length; i += 2) {
      local[i] = ring.xy[i] - ox;
      local[i + 1] = ring.xy[i + 1] - oy;
    }
    const model = buildRoofModel(local, roofPoints(ring, [], ox, oy, undefined, index));
    if (!model) {
      tried.add(key);
      stats.roofsRejected++;
      continue;
    }
    const target = { source: OVERTURE_BUILDINGS_SOURCE, sourceLayer: 'building', id };
    const state = map.getFeatureState(target) as { roofColor?: string };
    const color = state.roofColor ?? String((f.properties ?? {}).roof_color ?? '#9aa3ad');
    if (!layer.add(key, model, ox, oy, [minX, minY, maxX, maxY], color)) continue;
    done.add(key);
    map.setFeatureState(target, { lidarEave: model.eaveM });
    stats.roofsFitted++;
    stats.roofKinds[model.kind] = (stats.roofKinds[model.kind] ?? 0) + 1;
    rms.push(model.rmsM);
  }
  stats.roofRmsMedianM = median(rms);
}

/**
 * On every idle at street zoom, measures roof heights from the 3DEP points already drawn, reconstructs roof shapes
 * from them, and paints roof colours from NAIP. Each building is handled once; nothing is recomputed while panning.
 */
export function attachBuildingEnrichment(map: MapLibreMap, onStats?: (s: BuildingEnrichStats) => void): () => void {
  const heightsDone = new Set<string>();
  const roofsDone = new Set<string>();
  const meshDone = new Set<string>();
  const rms: number[] = [];
  const stats: BuildingEnrichStats = { measured: 0, skipped: 0, painted: 0, failed: 0, lidarNodes: 0, roofsFitted: 0, roofsRejected: 0, roofRmsMedianM: null, roofKinds: {} };
  let busy = false;
  let indexKey = '';
  let index: ReturnIndex | null = null;
  let indexAt = 0;
  const heightsTried = new Set<string>();
  const roofsTried = new Set<string>();
  let imageryBusy = false;
  /** The return grid is rebuilt only when the drawn LiDAR nodes change. */
  const returnIndex = (nodes: ReturnType<typeof gaLidarNodes>): ReturnIndex => {
    let total = 0;
    for (const n of nodes) total += n.count;
    const key = `${nodes.length}:${total}:${nodes[0]?.minX ?? 0}:${nodes[nodes.length - 1]?.minY ?? 0}`;
    const now = Date.now();
    if (!index || (key !== indexKey && now - indexAt >= INDEX_REBUILD_MS)) {
      index = indexRoofReturns(nodes);
      indexKey = key;
      indexAt = now;
      heightsTried.clear();
      roofsTried.clear();
    }
    return index;
  };
  const publish = () => {
    if (typeof window !== 'undefined') (window as unknown as { __gaRoofs?: unknown }).__gaRoofs = { ...stats, layer: lidarRoofLayer(map)?.stats() ?? null };
  };
  const onIdle = async () => {
    lidarRoofLayer(map)?.refreshElevation();
    if (busy || map.getZoom() < OVERTURE_FULL_ZOOM || !map.getLayer('buildings-3d')) return;
    busy = true;
    try {
      const nodes = gaLidarNodes(map);
      stats.lidarNodes = nodes.length;
      if (nodes.length) {
        const idx = returnIndex(nodes);
        const h = applyLidarHeights(map, nodes, heightsDone, idx, heightsTried);
        stats.measured += h.measured;
        stats.skipped += h.skipped;
      }
      // Roof shapes first (local CPU work), then roof photos (network), publishing stats after each.
      if (map.getZoom() >= ROOF_MESH_MIN_ZOOM && nodes.length && !gpuLedgerPressure()) applyLidarRoofs(map, meshDone, rms, stats, returnIndex(nodes), roofsTried);
      publish();
      if (map.getZoom() >= ROOF_MIN_ZOOM && !imageryBusy) {
        imageryBusy = true;
        void applyRoofImagery(map, visibleCentroids(map), roofsDone)
          .then((r) => {
            stats.painted += r.painted;
            stats.failed += r.failed;
            publish();
            onStats?.({ ...stats });
          })
          .finally(() => {
            imageryBusy = false;
          });
      }
      onStats?.({ ...stats });
    } finally {
      busy = false;
    }
  };
  // God's Eye repaints every frame for its animated layers, so 'idle' may never fire; a slow timer and
  // 'moveend' run the same once-per-building pass whenever the camera is still.
  const tick = () => {
    if (!map.isMoving()) void onIdle();
  };
  const timer = setInterval(tick, ENRICH_TICK_MS);
  map.on('idle', onIdle);
  map.on('moveend', tick);
  return () => {
    clearInterval(timer);
    map.off('idle', onIdle);
    map.off('moveend', tick);
  };
}

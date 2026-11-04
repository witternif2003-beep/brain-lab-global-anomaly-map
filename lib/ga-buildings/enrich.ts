import type { Map as MapLibreMap } from 'maplibre-gl';
import { gaLidarNodes } from '../ga-lidar-layer';
import { lngLatTo3857 } from '../ga-lidar/ept';
import { applyLidarHeights, type HeightStats } from './lidar-heights';
import { applyRoofImagery, ROOF_MIN_ZOOM, type RoofStats } from './roof-imagery';
import { OVERTURE_BUILDINGS_SOURCE, OVERTURE_FULL_ZOOM } from './overture';

export interface BuildingEnrichStats extends HeightStats, RoofStats {
  /** Buildings whose height is LiDAR-measured rather than Overture-recorded. */
  lidarNodes: number;
}

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

/**
 * On every idle at street zoom, measures roof heights from the 3DEP points already drawn and paints
 * roof colours from NAIP. Each building is handled once; nothing is recomputed while panning.
 */
export function attachBuildingEnrichment(map: MapLibreMap, onStats?: (s: BuildingEnrichStats) => void): () => void {
  const heightsDone = new Set<string>();
  const roofsDone = new Set<string>();
  const stats: BuildingEnrichStats = { measured: 0, skipped: 0, painted: 0, failed: 0, lidarNodes: 0 };
  let busy = false;
  const onIdle = async () => {
    if (busy || map.getZoom() < OVERTURE_FULL_ZOOM || !map.getLayer('buildings-3d')) return;
    busy = true;
    try {
      const nodes = gaLidarNodes(map);
      stats.lidarNodes = nodes.length;
      if (nodes.length) {
        const h = applyLidarHeights(map, nodes, heightsDone);
        stats.measured += h.measured;
        stats.skipped += h.skipped;
      }
      if (map.getZoom() >= ROOF_MIN_ZOOM) {
        const r = await applyRoofImagery(map, visibleCentroids(map), roofsDone);
        stats.painted += r.painted;
        stats.failed += r.failed;
      }
      onStats?.({ ...stats });
    } finally {
      busy = false;
    }
  };
  map.on('idle', onIdle);
  return () => map.off('idle', onIdle);
}

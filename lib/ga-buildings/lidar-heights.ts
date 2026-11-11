import type { Map as MapLibreMap } from 'maplibre-gl';
import type { LidarNodeData } from '../ga-lidar/ept';
import { lngLatTo3857 } from '../ga-lidar/ept';
import { OVERTURE_BUILDINGS_SOURCE } from './overture';

/** Roof height percentile: the top few returns are birds, antennas and overhanging branches. */
export const ROOF_PERCENTILE = 0.95;
/** Returns below this height above ground are street furniture, not roof. */
export const MIN_ROOF_M = 2;
/** Fewest LiDAR returns inside a footprint before a measured height is trusted. */
export const MIN_POINTS = 8;
/** ASPRS classes kept: 1 unclassified and 6 building. Vegetation (3-5) is excluded so trees do not raise roofs. */
export const ROOF_CLASSES = new Set([1, 6]);

export interface Ring {
  /** Footprint outer ring, EPSG:3857 metres, closed or open. */
  xy: Float64Array;
}

/** Even-odd ray cast against one ring in EPSG:3857 metres. */
export function pointInRing(ring: Ring, x: number, y: number): boolean {
  const p = ring.xy;
  let inside = false;
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const yi = p[i + 1];
    const yj = p[j + 1];
    if (yi > y !== yj > y && x < ((p[j] - p[i]) * (y - yi)) / (yj - yi) + p[i]) inside = !inside;
  }
  return inside;
}

export function percentile(sorted: Float64Array | number[], q: number): number {
  const n = sorted.length;
  if (!n) return NaN;
  const i = Math.min(n - 1, Math.max(0, Math.round(q * (n - 1))));
  return sorted[i];
}

export interface MeasuredHeight {
  heightM: number;
  points: number;
}

/**
 * Height of one footprint from 3DEP returns: the 95th-percentile height above ground of the
 * building/unclassified returns inside the ring. Returns null when too few returns fall inside.
 */
export function measureRing(ring: Ring, nodes: readonly LidarNodeData[]): MeasuredHeight | null {
  const hits: number[] = [];
  for (const n of nodes) {
    for (let i = 0; i < n.count; i++) {
      const h = n.hag[i];
      if (h < MIN_ROOF_M || !ROOF_CLASSES.has(n.cls[i])) continue;
      if (pointInRing(ring, n.minX + n.x[i], n.minY + n.y[i])) hits.push(h);
    }
  }
  if (hits.length < MIN_POINTS) return null;
  hits.sort((a, b) => a - b);
  return { heightM: percentile(hits, ROOF_PERCENTILE), points: hits.length };
}

export function ringFromCoordinates(coords: readonly (readonly number[])[]): Ring {
  const xy = new Float64Array(coords.length * 2);
  for (let i = 0; i < coords.length; i++) {
    const [x, y] = lngLatTo3857(coords[i][0], coords[i][1]);
    xy[i * 2] = x;
    xy[i * 2 + 1] = y;
  }
  return { xy };
}

export interface HeightStats {
  measured: number;
  skipped: number;
}

/**
 * Writes measured roof heights onto the Overture buildings in view as feature-state `lidarHeight`,
 * which the extrusion height expression prefers over Overture's recorded height.
 */
export function applyLidarHeights(map: MapLibreMap, nodes: readonly LidarNodeData[], done = new Set<string>()): HeightStats {
  const stats: HeightStats = { measured: 0, skipped: 0 };
  if (!map.getLayer('buildings-3d') || !nodes.length) return stats;
  let features: GeoJSON.Feature[];
  try {
    features = map.querySourceFeatures(OVERTURE_BUILDINGS_SOURCE, { sourceLayer: 'building' }) as unknown as GeoJSON.Feature[];
  } catch {
    return stats;
  }
  for (const f of features) {
    const id = f.id;
    if (typeof id !== 'string' && typeof id !== 'number') continue;
    const key = String(id);
    if (done.has(key)) continue;
    const g = f.geometry;
    const outer = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null;
    if (!outer || outer.length < 4) continue;
    const m = measureRing(ringFromCoordinates(outer), nodes);
    done.add(key);
    if (!m) {
      stats.skipped++;
      continue;
    }
    map.setFeatureState({ source: OVERTURE_BUILDINGS_SOURCE, sourceLayer: 'building', id }, { lidarHeight: m.heightM, lidarPoints: m.points });
    stats.measured++;
  }
  return stats;
}

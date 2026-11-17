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
export function measureRing(ring: Ring, nodes: readonly LidarNodeData[], index?: ReturnIndex): MeasuredHeight | null {
  const idx = index ?? indexRoofReturns(nodes);
  const hits: number[] = [];
  const [minX, minY, maxX, maxY] = ringBbox(ring);
  forReturnsInBox(idx, minX, minY, maxX, maxY, (x, y, h) => {
    if (pointInRing(ring, x, y)) hits.push(h);
  });
  if (hits.length < MIN_POINTS) return null;
  hits.sort((a, b) => a - b);
  return { heightM: percentile(hits, ROOF_PERCENTILE), points: hits.length };
}

export function ringBbox(ring: Ring): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let i = 0; i < ring.xy.length; i += 2) {
    minX = Math.min(minX, ring.xy[i]);
    maxX = Math.max(maxX, ring.xy[i]);
    minY = Math.min(minY, ring.xy[i + 1]);
    maxY = Math.max(maxY, ring.xy[i + 1]);
  }
  return [minX, minY, maxX, maxY];
}

/**
 * Grid of the roof-candidate returns (building/unclassified, ≥ MIN_ROOF_M), so each footprint reads only nearby points.
 * Compact on purpose (phones share one memory pool): points are stored cell-sorted as Float32 offsets from (ox, oy),
 * 12 bytes per return plus two Map entries per occupied cell.
 */
export interface ReturnIndex {
  cellM: number;
  ox: number;
  oy: number;
  start: Map<number, number>;
  count: Map<number, number>;
  x: Float32Array;
  y: Float32Array;
  h: Float32Array;
}

export const RETURN_CELL_M = 4;
const cellKey = (gx: number, gy: number) => (gx + 8388608) * 16777216 + (gy + 8388608);
const keep = (n: LidarNodeData, i: number) => n.hag[i] >= MIN_ROOF_M && ROOF_CLASSES.has(n.cls[i]);

export function indexRoofReturns(nodes: readonly LidarNodeData[], cellM = RETURN_CELL_M): ReturnIndex {
  const ox = nodes[0]?.minX ?? 0;
  const oy = nodes[0]?.minY ?? 0;
  const count = new Map<number, number>();
  let n = 0;
  for (const nd of nodes) {
    for (let i = 0; i < nd.count; i++) {
      if (!keep(nd, i)) continue;
      const key = cellKey(Math.floor((nd.minX + nd.x[i]) / cellM), Math.floor((nd.minY + nd.y[i]) / cellM));
      count.set(key, (count.get(key) ?? 0) + 1);
      n++;
    }
  }
  const start = new Map<number, number>();
  let off = 0;
  for (const [key, c] of count) {
    start.set(key, off);
    off += c;
  }
  const fill = new Map(start);
  const x = new Float32Array(n), y = new Float32Array(n), h = new Float32Array(n);
  for (const nd of nodes) {
    for (let i = 0; i < nd.count; i++) {
      if (!keep(nd, i)) continue;
      const px = nd.minX + nd.x[i], py = nd.minY + nd.y[i];
      const key = cellKey(Math.floor(px / cellM), Math.floor(py / cellM));
      const k = fill.get(key)!;
      fill.set(key, k + 1);
      x[k] = px - ox;
      y[k] = py - oy;
      h[k] = nd.hag[i];
    }
  }
  return { cellM, ox, oy, start, count, x, y, h };
}

/** Visits returns inside the EPSG:3857 box with their absolute coordinates. */
export function forReturnsInBox(idx: ReturnIndex, minX: number, minY: number, maxX: number, maxY: number, visit: (x: number, y: number, h: number) => void): void {
  const c = idx.cellM;
  for (let gx = Math.floor(minX / c); gx <= Math.floor(maxX / c); gx++) {
    for (let gy = Math.floor(minY / c); gy <= Math.floor(maxY / c); gy++) {
      const key = cellKey(gx, gy);
      const s = idx.start.get(key);
      if (s === undefined) continue;
      const e = s + idx.count.get(key)!;
      for (let i = s; i < e; i++) {
        const px = idx.x[i] + idx.ox, py = idx.y[i] + idx.oy;
        if (px >= minX && px <= maxX && py >= minY && py <= maxY) visit(px, py, idx.h[i]);
      }
    }
  }
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
export function applyLidarHeights(map: MapLibreMap, nodes: readonly LidarNodeData[], done = new Set<string>(), index?: ReturnIndex): HeightStats {
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
    const m = measureRing(ringFromCoordinates(outer), nodes, (index ??= indexRoofReturns(nodes)));
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

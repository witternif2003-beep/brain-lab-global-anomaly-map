import earcut from 'earcut';
import type { LidarNodeData } from '../ga-lidar/ept';
import { MIN_ROOF_M, forReturnsInBox, indexRoofReturns, pointInRing, ringBbox, type ReturnIndex, type Ring } from './lidar-heights';

/**
 * Roof shape reconstruction from USGS 3DEP returns (keyless, public domain): sequential RANSAC finds the roof planes
 * inside a footprint (the plane-fitting step of City3D, arXiv:2201.10276, and 3DBAG), each roof point keeps the plane
 * it fits, and the roof surface takes the plane of the nearest fitted return. Every vertex height is a measured fit.
 */
export const ROOF_FIT_MIN_POINTS = 24;
export const PLANE_TOLERANCE_M = 0.25;
export const MAX_PLANES = 6;
export const RANSAC_ITERATIONS = 80;
/** A plane must hold at least this share of the footprint's returns. */
export const MIN_PLANE_SHARE = 0.12;
/** Fits explaining less than this share of returns are rejected (trees, cranes, mixed returns). */
export const MIN_INLIER_SHARE = 0.6;
/** Fits with a larger RMS against all returns in the footprint are rejected rather than drawn. */
export const MAX_FIT_RMS_M = 0.6;
/** Steeper than ~56° is a wall or vegetation, not a roof face. */
export const MAX_SLOPE = 1.5;
/** Target triangle edge of the roof mesh, EPSG:3857 metres. */
export const MESH_CELL_M = 1.25;
export const MAX_POINTS_PER_ROOF = 4000;

export interface Plane {
  a: number;
  b: number;
  c: number;
}
export const planeZ = (p: Plane, x: number, y: number) => p.a * x + p.b * y + p.c;

export interface RoofPoints {
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
}

/** Building/unclassified returns ≥ 2 m above ground inside the ring, relative to (ox, oy), evenly thinned to a cap. */
export function roofPoints(ring: Ring, nodes: readonly LidarNodeData[], ox: number, oy: number, cap = MAX_POINTS_PER_ROOF, index?: ReturnIndex): RoofPoints {
  const idx = index ?? indexRoofReturns(nodes);
  const xs: number[] = [], ys: number[] = [], zs: number[] = [];
  const [minX, minY, maxX, maxY] = ringBbox(ring);
  forReturnsInBox(idx, minX, minY, maxX, maxY, (x, y, h) => {
    if (!pointInRing(ring, x, y)) return;
    xs.push(x - ox);
    ys.push(y - oy);
    zs.push(h);
  });
  const step = Math.max(1, xs.length / cap);
  const m = Math.floor(xs.length / step);
  const out = { x: new Float64Array(m), y: new Float64Array(m), z: new Float64Array(m) };
  for (let k = 0; k < m; k++) {
    const i = Math.floor(k * step);
    out.x[k] = xs[i];
    out.y[k] = ys[i];
    out.z[k] = zs[i];
  }
  return out;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Least-squares plane z = ax + by + c through the indexed points; null when degenerate. */
export function fitPlane(p: RoofPoints, idx: ArrayLike<number>): Plane | null {
  let sxx = 0, sxy = 0, syy = 0, sx = 0, sy = 0, sxz = 0, syz = 0, sz = 0;
  const n = idx.length;
  if (n < 3) return null;
  for (let k = 0; k < n; k++) {
    const i = idx[k];
    const x = p.x[i], y = p.y[i], z = p.z[i];
    sxx += x * x; sxy += x * y; syy += y * y; sx += x; sy += y; sxz += x * z; syz += y * z; sz += z;
  }
  const m = [sxx, sxy, sx, sxy, syy, sy, sx, sy, n];
  const det = m[0] * (m[4] * m[8] - m[5] * m[7]) - m[1] * (m[3] * m[8] - m[5] * m[6]) + m[2] * (m[3] * m[7] - m[4] * m[6]);
  if (Math.abs(det) < 1e-9) return null;
  const solve = (r: [number, number, number]) => {
    const d = (a: number[]) => a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
    return [d([r[0], m[1], m[2], r[1], m[4], m[5], r[2], m[7], m[8]]) / det, d([m[0], r[0], m[2], m[3], r[1], m[5], m[6], r[2], m[8]]) / det, d([m[0], m[1], r[0], m[3], m[4], r[1], m[6], m[7], r[2]]) / det];
  };
  const [a, b, c] = solve([sxz, syz, sz]);
  return Number.isFinite(a + b + c) ? { a, b, c } : null;
}

function planeFrom3(p: RoofPoints, i: number, j: number, k: number): Plane | null {
  return fitPlane(p, [i, j, k]);
}

export interface PlaneFit {
  planes: Plane[];
  /** Plane index per point, -1 for returns no plane explains. */
  label: Int8Array;
}

/** Sequential RANSAC: best plane on the remaining returns, refit by least squares, repeat. Deterministic per seed. */
export function fitRoofPlanes(p: RoofPoints, seed = 1): PlaneFit {
  const n = p.x.length;
  const label = new Int8Array(n).fill(-1);
  const planes: Plane[] = [];
  const minCount = Math.max(ROOF_FIT_MIN_POINTS / 2, Math.ceil(n * MIN_PLANE_SHARE));
  const rand = mulberry32(seed);
  let remaining = Array.from({ length: n }, (_, i) => i);
  while (planes.length < MAX_PLANES && remaining.length >= minCount) {
    let best: Plane | null = null;
    let bestCount = 0;
    for (let it = 0; it < RANSAC_ITERATIONS; it++) {
      const r = remaining.length;
      const pl = planeFrom3(p, remaining[Math.floor(rand() * r)], remaining[Math.floor(rand() * r)], remaining[Math.floor(rand() * r)]);
      if (!pl || Math.hypot(pl.a, pl.b) > MAX_SLOPE) continue;
      let c = 0;
      for (const i of remaining) if (Math.abs(planeZ(pl, p.x[i], p.y[i]) - p.z[i]) <= PLANE_TOLERANCE_M) c++;
      if (c > bestCount) {
        bestCount = c;
        best = pl;
      }
    }
    if (!best || bestCount < minCount) break;
    let inliers = remaining.filter((i) => Math.abs(planeZ(best!, p.x[i], p.y[i]) - p.z[i]) <= PLANE_TOLERANCE_M);
    const refit = fitPlane(p, inliers);
    if (refit && Math.hypot(refit.a, refit.b) <= MAX_SLOPE) {
      const again = remaining.filter((i) => Math.abs(planeZ(refit, p.x[i], p.y[i]) - p.z[i]) <= PLANE_TOLERANCE_M);
      if (again.length >= inliers.length) {
        best = refit;
        inliers = again;
      }
    }
    const k = planes.length;
    planes.push(best);
    for (const i of inliers) label[i] = k;
    const taken = new Set(inliers);
    remaining = remaining.filter((i) => !taken.has(i));
  }
  return { planes, label };
}

/** Height of the reconstructed roof at (x, y): the plane of the nearest fitted return, clamped to the fitted range. */
export function roofSurface(p: RoofPoints, fit: PlaneFit, cell = 2): (x: number, y: number) => number {
  const grid = new Map<string, number[]>();
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < p.x.length; i++) {
    if (fit.label[i] < 0) continue;
    lo = Math.min(lo, p.z[i]);
    hi = Math.max(hi, p.z[i]);
    const key = `${Math.floor(p.x[i] / cell)},${Math.floor(p.y[i] / cell)}`;
    const list = grid.get(key);
    if (list) list.push(i);
    else grid.set(key, [i]);
  }
  return (x, y) => {
    const gx = Math.floor(x / cell), gy = Math.floor(y / cell);
    let bestI = -1, bestD = Infinity;
    for (let r = 0; r <= 12 && bestI < 0; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dy = -r; dy <= r; dy++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          for (const i of grid.get(`${gx + dx},${gy + dy}`) ?? []) {
            const d = (p.x[i] - x) ** 2 + (p.y[i] - y) ** 2;
            if (d < bestD) {
              bestD = d;
              bestI = i;
            }
          }
        }
      }
      if (bestI >= 0 && r === 0) break;
    }
    if (bestI < 0) return lo;
    return Math.min(hi, Math.max(lo, planeZ(fit.planes[fit.label[bestI]], x, y)));
  };
}

export type RoofKind = 'flat' | 'single-slope' | 'gabled' | 'multi-plane';

export interface RoofModel {
  kind: RoofKind;
  planes: number;
  points: number;
  inlierShare: number;
  /** RMS of the reconstructed surface against every roof return in the footprint, metres. */
  rmsM: number;
  eaveM: number;
  ridgeM: number;
  /** Local EPSG:3857 metres (x, y) and height above ground (z, metres) per vertex. */
  positions: Float32Array;
  indices: Uint32Array;
}

function classify(planes: Plane[]): RoofKind {
  const sloped = planes.filter((p) => Math.hypot(p.a, p.b) > 0.08).length;
  if (!sloped) return 'flat';
  if (planes.length === 1) return 'single-slope';
  if (planes.length === 2 && sloped === 2) return 'gabled';
  return 'multi-plane';
}

/**
 * Roof mesh for one footprint (`ring`: open or closed outer ring in local EPSG:3857 metres). Returns null whenever
 * the returns do not support a fit, so no roof is drawn that the LiDAR does not measure.
 */
export function buildRoofModel(ring: Float64Array, p: RoofPoints, seed = 1): RoofModel | null {
  const n = p.x.length;
  if (n < ROOF_FIT_MIN_POINTS) return null;
  const fit = fitRoofPlanes(p, seed);
  if (!fit.planes.length) return null;
  let fitted = 0;
  for (let i = 0; i < n; i++) if (fit.label[i] >= 0) fitted++;
  const inlierShare = fitted / n;
  if (inlierShare < MIN_INLIER_SHARE) return null;
  const surf = roofSurface(p, fit);
  let se = 0;
  for (let i = 0; i < n; i++) se += (surf(p.x[i], p.y[i]) - p.z[i]) ** 2;
  const rmsM = Math.sqrt(se / n);
  if (rmsM > MAX_FIT_RMS_M) return null;

  let len = ring.length;
  if (len >= 4 && ring[0] === ring[len - 2] && ring[1] === ring[len - 1]) len -= 2;
  const flat = Array.from(ring.subarray(0, len));
  const tris = earcut(flat);
  if (!tris.length) return null;

  const pos: number[] = [];
  const idx: number[] = [];
  const keyed = new Map<string, number>();
  const vertex = (x: number, y: number, z: number) => {
    const key = `${Math.round(x * 100)},${Math.round(y * 100)},${Math.round(z * 100)}`;
    let v = keyed.get(key);
    if (v === undefined) {
      v = pos.length / 3;
      pos.push(x, y, z);
      keyed.set(key, v);
    }
    return v;
  };
  const top = (x: number, y: number) => vertex(x, y, surf(x, y));
  const subdivide = (ax: number, ay: number, bx: number, by: number, cx: number, cy: number, depth: number) => {
    const e = Math.max(Math.hypot(bx - ax, by - ay), Math.hypot(cx - bx, cy - by), Math.hypot(ax - cx, ay - cy));
    if (e <= MESH_CELL_M || depth >= 7) {
      idx.push(top(ax, ay), top(bx, by), top(cx, cy));
      return;
    }
    const abx = (ax + bx) / 2, aby = (ay + by) / 2, bcx = (bx + cx) / 2, bcy = (by + cy) / 2, cax = (cx + ax) / 2, cay = (cy + ay) / 2;
    subdivide(ax, ay, abx, aby, cax, cay, depth + 1);
    subdivide(abx, aby, bx, by, bcx, bcy, depth + 1);
    subdivide(cax, cay, bcx, bcy, cx, cy, depth + 1);
    subdivide(abx, aby, bcx, bcy, cax, cay, depth + 1);
  };
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t] * 2, tris[t + 1] * 2, tris[t + 2] * 2];
    subdivide(flat[a], flat[a + 1], flat[b], flat[b + 1], flat[c], flat[c + 1], 0);
  }

  let eaveM = Infinity, ridgeM = -Infinity;
  const edge: [number, number][] = [];
  const pts = len / 2;
  for (let i = 0; i < pts; i++) {
    const ax = flat[i * 2], ay = flat[i * 2 + 1], bx = flat[((i + 1) % pts) * 2], by = flat[((i + 1) % pts) * 2 + 1];
    const segs = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / MESH_CELL_M));
    for (let s = 0; s < segs; s++) edge.push([ax + ((bx - ax) * s) / segs, ay + ((by - ay) * s) / segs]);
  }
  for (const [x, y] of edge) eaveM = Math.min(eaveM, surf(x, y));
  for (let i = 2; i < pos.length; i += 3) ridgeM = Math.max(ridgeM, pos[i]);
  eaveM = Math.max(MIN_ROOF_M, eaveM);
  // Gable ends and steps: vertical skirt from the eave line up to the roof edge, so the walls below meet the roof.
  for (let i = 0; i < edge.length; i++) {
    const [ax, ay] = edge[i];
    const [bx, by] = edge[(i + 1) % edge.length];
    const za = surf(ax, ay), zb = surf(bx, by);
    if (za - eaveM < 0.05 && zb - eaveM < 0.05) continue;
    const a0 = vertex(ax, ay, eaveM), b0 = vertex(bx, by, eaveM), a1 = vertex(ax, ay, za), b1 = vertex(bx, by, zb);
    idx.push(a0, b0, b1, a0, b1, a1);
  }
  return {
    kind: classify(fit.planes),
    planes: fit.planes.length,
    points: n,
    inlierShare,
    rmsM,
    eaveM,
    ridgeM,
    positions: Float32Array.from(pos),
    indices: Uint32Array.from(idx),
  };
}

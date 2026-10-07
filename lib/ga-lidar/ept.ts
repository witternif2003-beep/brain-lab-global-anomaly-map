import projectsJson from './projects.json';

/** One USGS 3DEP LiDAR point-cloud project published as Entwine Point Tiles (EPT) on AWS Open Data. */
export interface EptProject {
  name: string;
  year: number;
  points: number;
  /** EPT octree cube, EPSG:3857 metres: [minX, minY, minZ, maxX, maxY, maxZ]. */
  bounds: number[];
  /** Tight bounds of the actual points, same layout as `bounds`. */
  boundsConforming: number[];
  span: number;
}

export const GA_LIDAR_PROJECTS: EptProject[] = projectsJson.projects;
export const EPT_ROOT = 'https://s3-us-west-2.amazonaws.com/usgs-lidar-public';
export const GA_LIDAR_SOURCE_URL = 'https://registry.opendata.aws/usgs-lidar/';

const R = 6378137;

export function lngLatTo3857(lng: number, lat: number): [number, number] {
  return [(lng * Math.PI * R) / 180, Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) * R];
}

export function lngLatFrom3857(x: number, y: number): [number, number] {
  return [(x / R) * (180 / Math.PI), (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI)];
}

export const IMAGERY_ZOOM = 18;
export const IMAGERY_TILE_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile';

/** Web-Mercator tile (x, y) and pixel within its 256×256 image for an EPSG:3857 location. */
export function imageryPixel(x: number, y: number, z = IMAGERY_ZOOM): { tx: number; ty: number; px: number; py: number } {
  const half = Math.PI * R;
  const tile = (2 * half) / 2 ** z;
  const fx = (x + half) / tile;
  const fy = (half - y) / tile;
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  return { tx, ty, px: Math.min(255, Math.floor((fx - tx) * 256)), py: Math.min(255, Math.floor((fy - ty) * 256)) };
}

export function findProject(name: string): EptProject | null {
  return GA_LIDAR_PROJECTS.find((p) => p.name === name) ?? null;
}

/** Newest project whose points cover the EPSG:3857 location (x, y). */
export function pickProject(x: number, y: number, projects: EptProject[] = GA_LIDAR_PROJECTS): EptProject | null {
  let best: EptProject | null = null;
  for (const p of projects) {
    const b = p.boundsConforming;
    if (x < b[0] || x > b[3] || y < b[1] || y > b[4]) continue;
    if (!best || p.year > best.year) best = p;
  }
  return best;
}

export const NODE_KEY = /^(\d{1,2})-(\d{1,7})-(\d{1,7})-(\d{1,7})$/;
export const MAX_NODE_DEPTH = 20;

export interface NodeBox {
  depth: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
}

export function nodeBox(project: EptProject, key: string): NodeBox | null {
  const m = NODE_KEY.exec(key);
  if (!m) return null;
  const [d, x, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (d > MAX_NODE_DEPTH || x >= 2 ** d || y >= 2 ** d) return null;
  const width = (project.bounds[3] - project.bounds[0]) / 2 ** d;
  const minX = project.bounds[0] + x * width;
  const minY = project.bounds[1] + y * width;
  return { depth: d, minX, minY, maxX: minX + width, maxY: minY + width, width };
}

/** EPT hierarchy: node key → point count, or -1 when the node's subtree lives in its own hierarchy file. */
export type Hierarchy = Record<string, number>;

export interface LidarView {
  /** View centre and half-size of the area to fill, EPSG:3857 metres. */
  cx: number;
  cy: number;
  half: number;
  /** Deepest octree level wanted at the centre. */
  targetDepth: number;
  pointBudget: number;
}

export interface PlannedNode {
  key: string;
  depth: number;
  count: number;
  dist: number;
}

export interface LidarPlan {
  nodes: PlannedNode[];
  points: number;
  /** Keys whose sub-hierarchy file must be fetched before the plan is complete. */
  pendingHierarchy: string[];
}

/** Octree level whose nodes are about a sixth of the view width (span² points each, so ~6×6 nodes fill it). */
export function targetDepthFor(project: EptProject, half: number, maxDepth = 14): number {
  const cube = project.bounds[3] - project.bounds[0];
  return Math.max(0, Math.min(maxDepth, Math.ceil(Math.log2(cube / ((2 * half) / 6)))));
}

/**
 * Nodes to draw for a view. EPT is additive (a child adds points to its parent), so every ancestor of a
 * drawn node is drawn too. Level of detail falls off by one octree level per doubling of distance past
 * half the view radius, and the nearest, shallowest nodes win when the point budget runs out.
 */
export function planNodes(project: EptProject, hierarchy: Hierarchy, view: LidarView): LidarPlan {
  const candidates: PlannedNode[] = [];
  const pendingHierarchy: string[] = [];
  const x0 = view.cx - view.half;
  const x1 = view.cx + view.half;
  const y0 = view.cy - view.half;
  const y1 = view.cy + view.half;
  for (const [key, count] of Object.entries(hierarchy)) {
    const box = nodeBox(project, key);
    if (!box || box.maxX < x0 || box.minX > x1 || box.maxY < y0 || box.minY > y1) continue;
    const dx = Math.max(box.minX - view.cx, 0, view.cx - box.maxX);
    const dy = Math.max(box.minY - view.cy, 0, view.cy - box.maxY);
    const dist = Math.hypot(dx, dy);
    const falloff = dist <= view.half / 2 ? 0 : Math.ceil(Math.log2(dist / (view.half / 2)));
    if (box.depth > view.targetDepth - falloff) continue;
    if (count === -1) pendingHierarchy.push(key);
    else if (count > 0) candidates.push({ key, depth: box.depth, count, dist });
  }
  candidates.sort((a, b) => a.depth - b.depth || a.dist - b.dist);
  const nodes: PlannedNode[] = [];
  let points = 0;
  for (const n of candidates) {
    if (points + n.count > view.pointBudget) continue;
    nodes.push(n);
    points += n.count;
  }
  return { nodes, points, pendingHierarchy };
}

// ── Node payload (/api/ga-lidar) ──────────────────────────────────────────
// 32-byte header, then per point: u16 x, u16 y (fraction of node width), u16 height above ground
// (centimetres + 10 m), u8 ASPRS class, u8 intensity (normalised per node).

const MAGIC = 0x314c4147; // "GAL1"
const HEADER_BYTES = 32;
const HAG_OFFSET_M = 10;
const HAG_MAX_M = 65535 / 100 - HAG_OFFSET_M;
const NOISE_CLASSES = new Set([7, 18]);

export interface LidarNodeData {
  count: number;
  /** Node south-west corner and width, EPSG:3857 metres. */
  minX: number;
  minY: number;
  width: number;
  /** Mean ground elevation in the node, metres (vertical datum of the source project). */
  groundZ: number;
  /** Offsets from (minX, minY), EPSG:3857 metres. */
  x: Float32Array;
  y: Float32Array;
  /** Height above the local ground surface, metres. */
  hag: Float32Array;
  cls: Uint8Array;
  intensity: Uint8Array;
}

export interface RawPoints {
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  cls: Uint8Array;
  intensity: Uint16Array;
}

/**
 * Height above ground per point: the lowest ground-class (ASPRS 2) return in each cell of a grid×grid
 * raster over the node, gaps filled from neighbouring cells. Nodes with no ground returns use the
 * 2nd-percentile elevation as a flat ground.
 */
export function heightAboveGround(
  pts: RawPoints,
  minX: number,
  minY: number,
  width: number,
  grid = 32,
): { hag: Float32Array; groundZ: number } {
  const n = pts.z.length;
  const cells = new Float64Array(grid * grid).fill(Infinity);
  const cellOf = (i: number) => {
    const cx = Math.min(grid - 1, Math.max(0, Math.floor(((pts.x[i] - minX) / width) * grid)));
    const cy = Math.min(grid - 1, Math.max(0, Math.floor(((pts.y[i] - minY) / width) * grid)));
    return cy * grid + cx;
  };
  let groundCount = 0;
  for (let i = 0; i < n; i++) {
    if (pts.cls[i] !== 2) continue;
    const c = cellOf(i);
    if (pts.z[i] < cells[c]) cells[c] = pts.z[i];
    groundCount++;
  }
  if (groundCount === 0) {
    const sorted = Array.from(pts.z).sort((a, b) => a - b);
    cells.fill(sorted.length ? sorted[Math.floor(sorted.length * 0.02)] : 0);
  } else {
    for (let pass = 0; pass < 2 * grid; pass++) {
      let empty = 0;
      const next = cells.slice();
      for (let cy = 0; cy < grid; cy++) {
        for (let cx = 0; cx < grid; cx++) {
          const c = cy * grid + cx;
          if (cells[c] !== Infinity) continue;
          let sum = 0;
          let k = 0;
          for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = cx + ox;
            const ny = cy + oy;
            if (nx < 0 || ny < 0 || nx >= grid || ny >= grid) continue;
            const v = cells[ny * grid + nx];
            if (v !== Infinity) {
              sum += v;
              k++;
            }
          }
          if (k) next[c] = sum / k;
          else empty++;
        }
      }
      cells.set(next);
      if (!empty) break;
    }
  }
  let groundSum = 0;
  for (const v of cells) groundSum += v;
  const hag = new Float32Array(n);
  for (let i = 0; i < n; i++) hag[i] = pts.z[i] - cells[cellOf(i)];
  return { hag, groundZ: groundSum / cells.length };
}

export function encodeNode(pts: RawPoints, box: NodeBox): Uint8Array<ArrayBuffer> {
  const keep: number[] = [];
  for (let i = 0; i < pts.z.length; i++) if (!NOISE_CLASSES.has(pts.cls[i])) keep.push(i);
  const { hag, groundZ } = heightAboveGround(pts, box.minX, box.minY, box.width);
  const sortedI = keep.map((i) => pts.intensity[i]).sort((a, b) => a - b);
  const iMax = Math.max(1, sortedI.length ? sortedI[Math.floor((sortedI.length - 1) * 0.98)] : 1);
  const n = keep.length;
  const out = new Uint8Array(HEADER_BYTES + n * 8);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, MAGIC, true);
  dv.setUint32(4, n, true);
  dv.setFloat64(8, box.minX, true);
  dv.setFloat64(16, box.minY, true);
  dv.setFloat32(24, box.width, true);
  dv.setFloat32(28, groundZ, true);
  const xs = new Uint16Array(out.buffer, HEADER_BYTES, n);
  const ys = new Uint16Array(out.buffer, HEADER_BYTES + 2 * n, n);
  const hs = new Uint16Array(out.buffer, HEADER_BYTES + 4 * n, n);
  const cs = new Uint8Array(out.buffer, HEADER_BYTES + 6 * n, n);
  const is = new Uint8Array(out.buffer, HEADER_BYTES + 7 * n, n);
  const q = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 65535);
  keep.forEach((i, j) => {
    xs[j] = q((pts.x[i] - box.minX) / box.width);
    ys[j] = q((pts.y[i] - box.minY) / box.width);
    hs[j] = Math.round((Math.min(HAG_MAX_M, Math.max(-HAG_OFFSET_M, hag[i])) + HAG_OFFSET_M) * 100);
    cs[j] = pts.cls[i];
    is[j] = Math.round(Math.min(1, pts.intensity[i] / iMax) * 255);
  });
  return out;
}

export function decodeNode(buf: ArrayBuffer): LidarNodeData {
  const dv = new DataView(buf);
  if (buf.byteLength < HEADER_BYTES || dv.getUint32(0, true) !== MAGIC) throw new Error('not a LiDAR node payload');
  const n = dv.getUint32(4, true);
  if (buf.byteLength !== HEADER_BYTES + n * 8) throw new Error('truncated LiDAR node payload');
  const width = dv.getFloat32(24, true);
  const xs = new Uint16Array(buf, HEADER_BYTES, n);
  const ys = new Uint16Array(buf, HEADER_BYTES + 2 * n, n);
  const hs = new Uint16Array(buf, HEADER_BYTES + 4 * n, n);
  const x = new Float32Array(n);
  const y = new Float32Array(n);
  const hag = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    x[i] = (xs[i] / 65535) * width;
    y[i] = (ys[i] / 65535) * width;
    hag[i] = hs[i] / 100 - HAG_OFFSET_M;
  }
  return {
    count: n,
    minX: dv.getFloat64(8, true),
    minY: dv.getFloat64(16, true),
    width,
    groundZ: dv.getFloat32(28, true),
    x,
    y,
    hag,
    cls: new Uint8Array(buf, HEADER_BYTES + 6 * n, n).slice(),
    intensity: new Uint8Array(buf, HEADER_BYTES + 7 * n, n).slice(),
  };
}

// ── Colour: ASPRS class, buildings and trees graded by height, shaded by return intensity ──

type Rgb = [number, number, number];

const mix = (a: Rgb, b: Rgb, t: number): Rgb => {
  const k = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
};

const BUILDING_LOW: Rgb = [56, 189, 248];
const BUILDING_MID: Rgb = [167, 139, 250];
const BUILDING_HIGH: Rgb = [244, 114, 182];
const TREE_LOW: Rgb = [134, 239, 172];
const TREE_HIGH: Rgb = [21, 128, 61];

export function lidarColor(cls: number, hag: number, intensity: number): Rgb {
  let base: Rgb;
  switch (cls) {
    case 2:
      base = [176, 150, 112];
      break;
    case 3:
    case 4:
    case 5:
      base = mix(TREE_LOW, TREE_HIGH, hag / 25);
      break;
    case 6:
      base = hag < 40 ? mix(BUILDING_LOW, BUILDING_MID, hag / 40) : mix(BUILDING_MID, BUILDING_HIGH, (hag - 40) / 110);
      break;
    case 9:
      base = [59, 130, 246];
      break;
    case 17:
      base = [251, 191, 36];
      break;
    default:
      base = [200, 200, 205];
  }
  const shade = 0.55 + 0.45 * (intensity / 255);
  return [Math.round(base[0] * shade), Math.round(base[1] * shade), Math.round(base[2] * shade)];
}

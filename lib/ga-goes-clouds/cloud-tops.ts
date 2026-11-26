/** GOES ABI L2 Cloud Top Height (ACHA) → Georgia vertex grid → parallax-corrected 3D cloud-top mesh (pure helpers). */

/** Box the cloud-top sheet covers: all of Georgia plus ~30 km. */
export const GA_CLOUD_TOP_BOX = { w: -86, s: 30, e: -80.5, n: 35.3 } as const;
/** Vertex spacing, degrees; finer than the 10 km product so heights interpolate smoothly. */
export const CLOUD_TOP_STEP_DEG = 0.05;

/** GOES-R fixed grid projection (goes_imager_projection attributes). */
export interface GeosProjection {
  /** perspective_point_height, m. */
  h: number;
  a: number;
  b: number;
  /** longitude_of_projection_origin, degrees. */
  lon0: number;
}

/** Scan angles (x, y, radians) of each fixed-grid column/row: angle = start + index × step. */
export interface FixedGrid {
  x0: number;
  dx: number;
  y0: number;
  dy: number;
  nx: number;
  ny: number;
}

export interface CloudTopGrid {
  box: { w: number; s: number; e: number; n: number };
  step: number;
  cols: number;
  rows: number;
  /** Row-major from the north-west vertex; metres above sea level, null where the product has no good-quality height. */
  heightsM: (number | null)[];
  /** Share (0–1) of the interpolation weight that came from good-quality cloudy pixels. */
  cover: number[];
  /** Sub-satellite longitude and perspective height, for the parallax correction. */
  satLon: number;
  satH: number;
}

const RAD = Math.PI / 180;

/** Latitude/longitude → GOES fixed-grid scan angles (GOES-R PUG L1b vol. 3 §5.1.2.8.2); null if the satellite can't see it. */
export function geosScanAngles(p: GeosProjection, lng: number, lat: number): [number, number] | null {
  const H = p.h + p.a;
  const e2 = (p.a * p.a - p.b * p.b) / (p.a * p.a);
  const phiC = Math.atan(((p.b * p.b) / (p.a * p.a)) * Math.tan(lat * RAD));
  const rc = p.b / Math.sqrt(1 - e2 * Math.cos(phiC) ** 2);
  const dl = (lng - p.lon0) * RAD;
  const sx = H - rc * Math.cos(phiC) * Math.cos(dl);
  const sy = -rc * Math.cos(phiC) * Math.sin(dl);
  const sz = rc * Math.sin(phiC);
  if (H * (H - sx) < sy * sy + ((p.a * p.a) / (p.b * p.b)) * sz * sz) return null;
  return [Math.asin(-sy / Math.hypot(sx, sy, sz)), Math.atan(sz / sx)];
}

/**
 * Samples the product's heights at every vertex of the Georgia grid by bilinear interpolation between the four
 * surrounding pixels, using only good-quality pixels (`good(i)`), so heights blend instead of stepping pixel to pixel.
 */
export function sampleCloudTops(
  heightM: (i: number) => number | null,
  grid: FixedGrid,
  proj: GeosProjection,
  box: { w: number; s: number; e: number; n: number } = GA_CLOUD_TOP_BOX,
  step = CLOUD_TOP_STEP_DEG,
): CloudTopGrid {
  const cols = Math.round((box.e - box.w) / step) + 1;
  const rows = Math.round((box.n - box.s) / step) + 1;
  const heightsM: (number | null)[] = new Array(cols * rows).fill(null);
  const cover: number[] = new Array(cols * rows).fill(0);
  for (let r = 0; r < rows; r++) {
    const lat = box.n - r * step;
    for (let c = 0; c < cols; c++) {
      const xy = geosScanAngles(proj, box.w + c * step, lat);
      if (!xy) continue;
      const fc = (xy[0] - grid.x0) / grid.dx;
      const fr = (xy[1] - grid.y0) / grid.dy;
      const c0 = Math.floor(fc);
      const r0 = Math.floor(fr);
      const tx = fc - c0;
      const ty = fr - r0;
      let sum = 0;
      let wsum = 0;
      for (const [dc, dr, w] of [[0, 0, (1 - tx) * (1 - ty)], [1, 0, tx * (1 - ty)], [0, 1, (1 - tx) * ty], [1, 1, tx * ty]] as const) {
        const cc = c0 + dc;
        const rr = r0 + dr;
        if (cc < 0 || rr < 0 || cc >= grid.nx || rr >= grid.ny || w <= 0) continue;
        const h = heightM(rr * grid.nx + cc);
        if (h === null) continue;
        sum += h * w;
        wsum += w;
      }
      const i = r * cols + c;
      cover[i] = Math.round(wsum * 100) / 100;
      if (wsum > 0) heightsM[i] = Math.round(sum / wsum);
    }
  }
  return { box: { ...box }, step, cols, rows, heightsM, cover, satLon: proj.lon0, satH: proj.h };
}

/** Fills vertices without a height from their nearest measured neighbours (they are drawn fully transparent). */
export function fillHeights(g: Pick<CloudTopGrid, 'cols' | 'rows' | 'heightsM'>): number[] | null {
  const { cols, rows } = g;
  const out = g.heightsM.slice();
  if (!out.some((h) => h !== null)) return null;
  let frontier = out.map((h, i) => (h !== null ? i : -1)).filter((i) => i >= 0);
  while (frontier.length) {
    const next: number[] = [];
    const add = new Map<number, [number, number]>();
    for (const i of frontier) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr;
        const cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const j = rr * cols + cc;
        if (out[j] !== null) continue;
        const acc = add.get(j) ?? [0, 0];
        acc[0] += out[i] as number;
        acc[1]++;
        add.set(j, acc);
      }
    }
    for (const [j, [s, n]] of add) {
      out[j] = s / n;
      next.push(j);
    }
    frontier = next;
  }
  return out as number[];
}

const R_EARTH = 6_371_008;

/**
 * Where a cloud top at `hM` really is. The satellite sees it along its line of sight and the product reports the
 * point where that line meets the ground, which lies farther from the satellite the taller the cloud; this walks
 * back up the line of sight to height `hM` (spherical Earth).
 */
export function parallaxCorrect(lng: number, lat: number, hM: number, satLon: number, satH: number): [number, number] {
  if (hM <= 0) return [lng, lat];
  const toXyz = (lo: number, la: number, r: number) => [r * Math.cos(la * RAD) * Math.cos(lo * RAD), r * Math.cos(la * RAD) * Math.sin(lo * RAD), r * Math.sin(la * RAD)];
  const S = toXyz(satLon, 0, R_EARTH + satH);
  const G = toXyz(lng, lat, R_EARTH);
  const d = [G[0] - S[0], G[1] - S[1], G[2] - S[2]];
  const A = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const B = 2 * (S[0] * d[0] + S[1] * d[1] + S[2] * d[2]);
  const r = R_EARTH + hM;
  const C = S[0] * S[0] + S[1] * S[1] + S[2] * S[2] - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < 0) return [lng, lat];
  const t = (-B - Math.sqrt(disc)) / (2 * A);
  const P = [S[0] + t * d[0], S[1] + t * d[1], S[2] + t * d[2]];
  return [Math.atan2(P[1], P[0]) / RAD, Math.asin(P[2] / Math.hypot(P[0], P[1], P[2])) / RAD];
}

export interface CloudTopMesh {
  attributes: { positions: { value: Float32Array; size: 3 }; texCoords: { value: Float32Array; size: 2 } };
  indices: { value: Uint32Array; size: 1 };
}

/**
 * One continuous triangle mesh (no seams between cells): each vertex at its measured cloud-top height, moved to its
 * parallax-corrected position, carrying the satellite image pixel it was seen at (u, v from the north-west corner).
 */
export function cloudTopMesh(g: CloudTopGrid, exaggeration = 1): CloudTopMesh | null {
  const h = fillHeights(g);
  if (!h) return null;
  const { cols, rows, box, step } = g;
  const positions = new Float32Array(cols * rows * 3);
  const texCoords = new Float32Array(cols * rows * 2);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const lng = box.w + c * step;
      const lat = box.n - r * step;
      const [x, y] = parallaxCorrect(lng, lat, h[i], g.satLon, g.satH);
      positions.set([x, y, h[i] * exaggeration], i * 3);
      texCoords.set([(lng - box.w) / (box.e - box.w), (box.n - lat) / (box.n - box.s)], i * 2);
    }
  }
  const indices = new Uint32Array((cols - 1) * (rows - 1) * 6);
  let k = 0;
  for (let r = 0; r < rows - 1; r++) {
    for (let c = 0; c < cols - 1; c++) {
      const i = r * cols + c;
      indices.set([i, i + cols, i + 1, i + 1, i + cols, i + cols + 1], k);
      k += 6;
    }
  }
  return { attributes: { positions: { value: positions, size: 3 }, texCoords: { value: texCoords, size: 2 } }, indices: { value: indices, size: 1 } };
}

/** Cloud cover (0–1) at image pixel (px, py) of a `width`×`height` image spanning the grid box, bilinear between vertices. */
export function coverAt(g: Pick<CloudTopGrid, 'cols' | 'rows' | 'cover'>, px: number, py: number, width: number, height: number): number {
  const fc = (px / Math.max(1, width - 1)) * (g.cols - 1);
  const fr = (py / Math.max(1, height - 1)) * (g.rows - 1);
  const c0 = Math.min(g.cols - 2, Math.floor(fc));
  const r0 = Math.min(g.rows - 2, Math.floor(fr));
  const tx = fc - c0;
  const ty = fr - r0;
  const v = (r: number, c: number) => g.cover[r * g.cols + c];
  return (v(r0, c0) * (1 - tx) + v(r0, c0 + 1) * tx) * (1 - ty) + (v(r0 + 1, c0) * (1 - tx) + v(r0 + 1, c0 + 1) * tx) * ty;
}

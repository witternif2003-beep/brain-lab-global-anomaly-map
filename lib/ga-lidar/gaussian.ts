/**
 * LiDAR points to 3D Gaussian primitives, initialised the way 3D Gaussian Splatting (Kerbl et al., 2023)
 * initialises from a sparse point cloud: one isotropic Gaussian per point, scale = mean distance to its
 * 3 nearest neighbours, colour as the SH degree-0 coefficient, uniform opacity. Nothing is trained or
 * optimised against photos, so this is a splat rendering of the measured points, not a radiance field.
 */

/** SH degree-0 basis constant, Y_0^0 = 1 / (2 √π). */
export const SH_C0 = 0.28209479177387814;
const NEIGHBOURS = 3;

export interface GaussianSet {
  count: number;
  /** Centres, metres, interleaved xyz. */
  position: Float32Array;
  /** Linear scale (σ) per Gaussian, metres. */
  scale: Float32Array;
  /** sRGB 0–255, interleaved rgb. */
  rgb: Uint8Array;
}

export interface GaussianOptions {
  minScale?: number;
  maxScale?: number;
  opacity?: number;
}

/** Mean distance from each point to its 3 nearest neighbours, using a uniform grid; clamped to [minScale, maxScale]. */
export function neighbourScales(position: Float32Array, minScale = 0.05, maxScale = 2): Float32Array {
  const n = position.length / 3;
  const out = new Float32Array(n);
  if (n === 0) return out;
  let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = position[i * 3], y = position[i * 3 + 1], z = position[i * 3 + 2];
    if (x < x0) x0 = x; if (x > x1) x1 = x;
    if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (z < z0) z0 = z; if (z > z1) z1 = z;
  }
  const cell = Math.max(maxScale, 1e-3);
  const nx = Math.max(1, Math.ceil((x1 - x0) / cell) + 1);
  const ny = Math.max(1, Math.ceil((y1 - y0) / cell) + 1);
  const nz = Math.max(1, Math.ceil((z1 - z0) / cell) + 1);
  const cellOf = (i: number) => {
    const cx = Math.floor((position[i * 3] - x0) / cell);
    const cy = Math.floor((position[i * 3 + 1] - y0) / cell);
    const cz = Math.floor((position[i * 3 + 2] - z0) / cell);
    return [cx, cy, cz] as const;
  };
  const buckets = new Map<number, number[]>();
  const key = (cx: number, cy: number, cz: number) => (cz * ny + cy) * nx + cx;
  for (let i = 0; i < n; i++) {
    const [cx, cy, cz] = cellOf(i);
    const k = key(cx, cy, cz);
    const b = buckets.get(k);
    if (b) b.push(i);
    else buckets.set(k, [i]);
  }
  const best = new Float64Array(NEIGHBOURS);
  for (let i = 0; i < n; i++) {
    best.fill(Infinity);
    const px = position[i * 3], py = position[i * 3 + 1], pz = position[i * 3 + 2];
    const [cx, cy, cz] = cellOf(i);
    for (let dz = -1; dz <= 1; dz++) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const gx = cx + dx, gy = cy + dy, gz = cz + dz;
      if (gx < 0 || gy < 0 || gz < 0 || gx >= nx || gy >= ny || gz >= nz) continue;
      const b = buckets.get(key(gx, gy, gz));
      if (!b) continue;
      for (const j of b) {
        if (j === i) continue;
        const d2 = (position[j * 3] - px) ** 2 + (position[j * 3 + 1] - py) ** 2 + (position[j * 3 + 2] - pz) ** 2;
        if (d2 >= best[NEIGHBOURS - 1]) continue;
        let s = NEIGHBOURS - 1;
        while (s > 0 && best[s - 1] > d2) {
          best[s] = best[s - 1];
          s--;
        }
        best[s] = d2;
      }
    }
    let sum = 0;
    for (let s = 0; s < NEIGHBOURS; s++) sum += Number.isFinite(best[s]) ? Math.sqrt(best[s]) : maxScale;
    out[i] = Math.min(maxScale, Math.max(minScale, sum / NEIGHBOURS));
  }
  return out;
}

export function gaussianize(position: Float32Array, rgb: Uint8Array, opts: GaussianOptions = {}): GaussianSet {
  return { count: position.length / 3, position, scale: neighbourScales(position, opts.minScale, opts.maxScale), rgb };
}

const logit = (p: number) => Math.log(p / (1 - p));

/** Column arrays in the 3DGS .ply layout (log scale, wxyz quaternion, SH DC colour, logit opacity). */
export function toPlyColumns(set: GaussianSet, opacity = 0.9): Record<string, Float32Array> {
  const n = set.count;
  const cols: Record<string, Float32Array> = {};
  for (const name of ['x', 'y', 'z', 'scale_0', 'scale_1', 'scale_2', 'rot_0', 'rot_1', 'rot_2', 'rot_3', 'f_dc_0', 'f_dc_1', 'f_dc_2', 'opacity']) {
    cols[name] = new Float32Array(n);
  }
  const a = logit(Math.min(0.999, Math.max(0.001, opacity)));
  for (let i = 0; i < n; i++) {
    cols.x[i] = set.position[i * 3];
    cols.y[i] = set.position[i * 3 + 1];
    cols.z[i] = set.position[i * 3 + 2];
    const ls = Math.log(set.scale[i]);
    cols.scale_0[i] = ls;
    cols.scale_1[i] = ls;
    cols.scale_2[i] = ls;
    cols.rot_0[i] = 1;
    for (let c = 0; c < 3; c++) cols[`f_dc_${c}`][i] = (set.rgb[i * 3 + c] / 255 - 0.5) / SH_C0;
    cols.opacity[i] = a;
  }
  return cols;
}

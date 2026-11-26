/**
 * Low-poly SIMULATED car for the deck.gl traffic layer: a body plus a cabin with sloped windscreens, instead of a box.
 * Metres, x = right, y = forward, z = up from the road. 4.6 × 1.8 × 1.45 m is a typical mid-size sedan footprint
 * (an estimate, not a measured vehicle).
 */
export const CAR_DIMS_M = { length: 4.6, width: 1.8, height: 1.45 } as const;

type V3 = [number, number, number];
/** Frustum between an axis-aligned bottom rectangle and top rectangle: [xHalf, y0, y1] at z0 and z1. */
interface Block { z0: number; z1: number; bottom: [number, number, number]; top: [number, number, number] }

const L = CAR_DIMS_M.length / 2, W = CAR_DIMS_M.width / 2;
export const CAR_BLOCKS: Block[] = [
  { z0: 0.18, z1: 0.82, bottom: [W, -L, L], top: [W, -L + 0.08, L - 0.15] },
  { z0: 0.82, z1: CAR_DIMS_M.height, bottom: [W - 0.08, -L + 0.75, L - 1.25], top: [W - 0.2, -L + 1.15, L - 2.0] },
];

const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const cross = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const unit = (a: V3): V3 => { const n = Math.hypot(...a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };

export interface CarMesh { [attribute: string]: { value: Float32Array; size: 3 }; positions: { value: Float32Array; size: 3 }; normals: { value: Float32Array; size: 3 } }

/** Non-indexed triangle list with flat, outward face normals (12 triangles per block). */
export function carMesh(blocks: Block[] = CAR_BLOCKS): CarMesh {
  const pos: number[] = [], nor: number[] = [];
  for (const b of blocks) {
    const c = (r: [number, number, number], z: number): V3[] => [[-r[0], r[1], z], [r[0], r[1], z], [r[0], r[2], z], [-r[0], r[2], z]];
    const lo = c(b.bottom, b.z0), hi = c(b.top, b.z1);
    const centre: V3 = [0, (b.bottom[1] + b.bottom[2] + b.top[1] + b.top[2]) / 4, (b.z0 + b.z1) / 2];
    const quads: V3[][] = [lo, hi, ...[0, 1, 2, 3].map((i) => [lo[i], lo[(i + 1) % 4], hi[(i + 1) % 4], hi[i]])];
    for (const q of quads) {
      let n = unit(cross(sub(q[1], q[0]), sub(q[2], q[0])));
      const mid: V3 = [(q[0][0] + q[2][0]) / 2, (q[0][1] + q[2][1]) / 2, (q[0][2] + q[2][2]) / 2];
      const quad = dot(n, sub(mid, centre)) < 0 ? ((n = [-n[0], -n[1], -n[2]]), [q[0], q[3], q[2], q[1]]) : q;
      for (const v of [quad[0], quad[1], quad[2], quad[0], quad[2], quad[3]]) {
        pos.push(...v);
        nor.push(...n);
      }
    }
  }
  return { positions: { value: new Float32Array(pos), size: 3 }, normals: { value: new Float32Array(nor), size: 3 } };
}

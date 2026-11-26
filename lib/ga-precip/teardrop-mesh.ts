/**
 * Unit-height 3D teardrop for the falling-rain drops: round bottom at z = 0, pointed tip at z = 1, never flat.
 * The shape is artistic (user's reference photo); real falling raindrops are near-spherical or flat-bottomed (NASA GPM).
 * Profile: z = (1 + cos θ) / 2, r = W · sin θ · sin(θ / 2)^1.5 for θ ∈ [0, π].
 */
export interface TeardropMesh {
  attributes: { positions: { value: Float32Array; size: 3 }; normals: { value: Float32Array; size: 3 } };
  indices: { value: Uint32Array; size: 1 };
}

/** On-screen teardrop height: 2 px at state zoom up to 5 px from street zoom (z15); halved from 4–10 px at the user's request. */
export const teardropPx = (zoom: number): number => 2 + 3 * Math.min(1, Math.max(0, (zoom - 8) / 7));

export const TEARDROP_HALF_WIDTH = 0.45;

export const teardropRadius = (theta: number): number => TEARDROP_HALF_WIDTH * Math.sin(theta) * Math.sin(theta / 2) ** 1.5;

export function teardropMesh(segments = 10, rings = 8): TeardropMesh {
  const nv = (rings + 1) * segments;
  const pos = new Float32Array(nv * 3);
  const nrm = new Float32Array(nv * 3);
  for (let j = 0; j <= rings; j++) {
    const th = (Math.PI * j) / rings;
    const r = teardropRadius(th), z = (1 + Math.cos(th)) / 2;
    for (let k = 0; k < segments; k++) {
      const ph = (2 * Math.PI * k) / segments, v = (j * segments + k) * 3;
      pos[v] = r * Math.cos(ph); pos[v + 1] = r * Math.sin(ph); pos[v + 2] = z;
    }
  }
  const idx: number[] = [];
  const at = (j: number, k: number) => j * segments + (k % segments);
  for (let j = 0; j < rings; j++) {
    for (let k = 0; k < segments; k++) {
      const a = at(j, k), b = at(j, k + 1), c = at(j + 1, k), d = at(j + 1, k + 1);
      if (j > 0) idx.push(a, c, b);
      if (j < rings - 1) idx.push(b, c, d);
    }
  }
  for (let t = 0; t < idx.length; t += 3) {
    const [a, b, c] = [idx[t] * 3, idx[t + 1] * 3, idx[t + 2] * 3];
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    for (const v of [a, b, c]) { nrm[v] += nx; nrm[v + 1] += ny; nrm[v + 2] += nz; }
  }
  for (let v = 0; v < nv; v++) {
    const j = Math.floor(v / segments), o = v * 3;
    if (j === 0 || j === rings) { nrm[o] = 0; nrm[o + 1] = 0; nrm[o + 2] = j === 0 ? 1 : -1; continue; }
    const l = Math.hypot(nrm[o], nrm[o + 1], nrm[o + 2]) || 1;
    nrm[o] /= l; nrm[o + 1] /= l; nrm[o + 2] /= l;
  }
  return { attributes: { positions: { value: pos, size: 3 }, normals: { value: nrm, size: 3 } }, indices: { value: Uint32Array.from(idx), size: 1 } };
}

import type { BufferAttribute } from 'three';

type Typed = BufferAttribute['array'];

/**
 * Frees the JavaScript copy of an attribute once WebGL has copied it into its own buffer, keeping `count`.
 * Before setting `needsUpdate` again, assign a full-length array (see `fullArray`).
 */
export function releaseAfterUpload<T extends BufferAttribute>(attr: T): T {
  return attr.onUpload(() => {
    attr.array = new (attr.array.constructor as new (n: number) => Typed)(0);
  });
}

/** The attribute's array if it still holds every element, else a new zeroed one of the same type. */
export function fullArray<A extends Typed>(attr: BufferAttribute): A {
  const n = attr.count * attr.itemSize;
  const a = attr.array as A;
  return a.length === n ? a : (new (a.constructor as new (n: number) => A)(n));
}

/** Packs xyz floats into 16-bit integers per axis over the node's own range; returns the expansion offset and step. */
export function quantizeUint16(xyz: Float32Array, out: Uint16Array): { offset: [number, number, number]; scale: [number, number, number] } {
  const lo = [Infinity, Infinity, Infinity];
  const hi = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < xyz.length; i++) {
    const a = i % 3;
    if (xyz[i] < lo[a]) lo[a] = xyz[i];
    if (xyz[i] > hi[a]) hi[a] = xyz[i];
  }
  const offset = lo.map((v) => (Number.isFinite(v) ? v : 0)) as [number, number, number];
  const scale = hi.map((v, a) => (Number.isFinite(v) && v > offset[a] ? (v - offset[a]) / 65535 : 1)) as [number, number, number];
  for (let i = 0; i < xyz.length; i++) {
    const a = i % 3;
    out[i] = Math.max(0, Math.min(65535, Math.round((xyz[i] - offset[a]) / scale[a])));
  }
  return { offset, scale };
}

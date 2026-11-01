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

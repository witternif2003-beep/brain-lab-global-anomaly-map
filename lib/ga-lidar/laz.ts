import { createLazPerf } from 'laz-perf';
import type { RawPoints } from './ept';

type LazPerf = Awaited<ReturnType<typeof createLazPerf>>;

let lazPerf: Promise<LazPerf> | null = null;

/** Decode a LAS/LAZ file (point formats 0–10) into coordinates, ASPRS class and intensity. */
export async function decodeLaz(file: Uint8Array): Promise<RawPoints> {
  lazPerf ??= createLazPerf();
  const L = await lazPerf;
  const header = new DataView(file.buffer, file.byteOffset, file.byteLength);
  const [sx, sy, sz] = [131, 139, 147].map((o) => header.getFloat64(o, true));
  const [ox, oy, oz] = [155, 163, 171].map((o) => header.getFloat64(o, true));

  const filePtr = L._malloc(file.byteLength);
  const laz = new L.LASZip();
  let pointPtr = 0;
  try {
    L.HEAPU8.set(file, filePtr);
    laz.open(filePtr, file.byteLength);
    const n = laz.getCount();
    const len = laz.getPointLength();
    const extended = laz.getPointFormat() >= 6;
    pointPtr = L._malloc(len);
    const pts: RawPoints = {
      x: new Float64Array(n),
      y: new Float64Array(n),
      z: new Float64Array(n),
      cls: new Uint8Array(n),
      intensity: new Uint16Array(n),
    };
    for (let i = 0; i < n; i++) {
      laz.getPoint(pointPtr);
      const p = new DataView(L.HEAPU8.buffer, pointPtr, len);
      pts.x[i] = p.getInt32(0, true) * sx + ox;
      pts.y[i] = p.getInt32(4, true) * sy + oy;
      pts.z[i] = p.getInt32(8, true) * sz + oz;
      pts.intensity[i] = p.getUint16(12, true);
      pts.cls[i] = extended ? p.getUint8(16) : p.getUint8(15) & 0x1f;
    }
    return pts;
  } finally {
    laz.delete();
    L._free(filePtr);
    if (pointPtr) L._free(pointPtr);
  }
}

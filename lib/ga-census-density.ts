/**
 * Census 2020 population by tabulation block for Georgia: one point per populated block at the
 * Census Bureau's internal point, sized by its POP20 count. Built by scripts/build-ga-census-blocks.mjs
 * from TIGER/Line 2020 TABBLOCK20. Aggregate counts only — no individual or device locations.
 */
export const CENSUS_BLOCKS_URL = '/data/ga-census-blocks-2020.bin';
export const CENSUS_BLOCKS_SOURCE = 'U.S. Census Bureau, 2020 Census (P.L. 94-171) via TIGER/Line TABBLOCK20';

export interface CensusBlocks {
  n: number;
  /** Interleaved [lon, lat] internal points. */
  positions: Float64Array;
  pops: Uint16Array;
  /** Screen radius in px per block, from blockRadiusPx. */
  radii: Float32Array;
  total: number;
}

/** Area-proportional dot: radius grows with √population, 1.5 px floor so single-resident blocks stay visible, 7 px cap. */
export const blockRadiusPx = (pop: number): number => Math.min(7, 1.5 + Math.sqrt(pop) / 8);

/** Decodes `u32 n, i32 lon×1e6 [n], i32 lat×1e6 [n], u16 pop [n]` (little-endian). */
export function decodeCensusBlocks(buf: ArrayBuffer): CensusBlocks {
  const dv = new DataView(buf);
  const n = dv.getUint32(0, true);
  if (buf.byteLength !== 4 + n * 10) throw new Error(`census blocks: expected ${4 + n * 10} bytes, got ${buf.byteLength}`);
  const positions = new Float64Array(2 * n);
  const pops = new Uint16Array(n);
  const radii = new Float32Array(n);
  let total = 0;
  for (let i = 0; i < n; i++) {
    positions[2 * i] = dv.getInt32(4 + 4 * i, true) / 1e6;
    positions[2 * i + 1] = dv.getInt32(4 + 4 * n + 4 * i, true) / 1e6;
    const p = dv.getUint16(4 + 8 * n + 2 * i, true);
    pops[i] = p;
    radii[i] = blockRadiusPx(p);
    total += p;
  }
  return { n, positions, pops, radii, total };
}

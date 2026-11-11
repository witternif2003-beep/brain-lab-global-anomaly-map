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
  /** Records dropped by the decoder for a non-finite or out-of-WGS84 position (0 for the shipped file). */
  dropped: number;
}

const validLonLat = (lon: number, lat: number): boolean =>
  Number.isFinite(lon) && Number.isFinite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90;

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
  let k = 0;
  for (let i = 0; i < n; i++) {
    const lon = dv.getInt32(4 + 4 * i, true) / 1e6;
    const lat = dv.getInt32(4 + 4 * n + 4 * i, true) / 1e6;
    if (!validLonLat(lon, lat)) continue;
    const p = dv.getUint16(4 + 8 * n + 2 * i, true);
    positions[2 * k] = lon;
    positions[2 * k + 1] = lat;
    pops[k] = p;
    radii[k] = blockRadiusPx(p);
    total += p;
    k++;
  }
  const dropped = n - k;
  if (dropped) console.warn(`[census blocks] dropped ${dropped} records with invalid positions`);
  return { n: k, positions: positions.subarray(0, 2 * k), pops: pops.subarray(0, k), radii: radii.subarray(0, k), total, dropped };
}

/** Every block draws at one fixed screen size at every zoom: half the diameter of a standard 16 px map icon (e.g. comm towers). */
export const DENSITY_REFERENCE_ICON_PX = 16;
export const densityDotRadiusPx = (markerScale: number): number => (DENSITY_REFERENCE_ICON_PX * markerScale) / 4;
/** Solid ring so a lone block reads against satellite imagery; included in the dot's radius. */
export const DENSITY_RING_PX = 1;

/** Blocks drawn on the 3D terrain from this zoom; below it they sit flat (the tilt offset is under a pixel or two). */
export const DENSITY_ANCHOR_MIN_ZOOM = 10;

export interface LngLatBox { west: number; south: number; east: number; north: number }

/** Blocks inside `box`, each lifted to `elev(lon, lat)` metres so its dot sits on the drawn terrain at its exact point. */
export function densityAnchors(b: CensusBlocks, box: LngLatBox, elev: (lon: number, lat: number) => number): { n: number; positions: Float64Array; radii: Float32Array } {
  const idx: number[] = [];
  for (let i = 0; i < b.n; i++) {
    const lon = b.positions[2 * i];
    const lat = b.positions[2 * i + 1];
    if (lon >= box.west && lon <= box.east && lat >= box.south && lat <= box.north) idx.push(i);
  }
  const positions = new Float64Array(3 * idx.length);
  const radii = new Float32Array(idx.length);
  idx.forEach((i, k) => {
    const lon = b.positions[2 * i];
    const lat = b.positions[2 * i + 1];
    positions[3 * k] = lon;
    positions[3 * k + 1] = lat;
    positions[3 * k + 2] = elev(lon, lat);
    radii[k] = b.radii[i];
  });
  return { n: idx.length, positions, radii };
}

export interface StateEstimate {
  /** Latest July 1 estimate year in the file. */
  year: number;
  estimate: number;
  /** April 1, 2020 estimates base. */
  base2020: number;
}

/** Census Population Estimates Program NST-EST<vintage>-ALLDATA.csv → the newest POPESTIMATE<year> for one state. */
export function parseStateEstimate(csv: string, stateFips = '13'): StateEstimate {
  const lines = csv.trim().split(/\r?\n/);
  const head = lines[0].split(',');
  const row = lines.slice(1).map((l) => l.split(',')).find((r) => r[head.indexOf('SUMLEV')] === '040' && r[head.indexOf('STATE')] === stateFips);
  if (!row) throw new Error(`state ${stateFips} not in estimates file`);
  const years = head.map((h) => /^POPESTIMATE(\d{4})$/.exec(h)?.[1]).filter((y): y is string => !!y).map(Number);
  if (!years.length) throw new Error('no POPESTIMATE columns');
  const year = Math.max(...years);
  const estimate = Number(row[head.indexOf(`POPESTIMATE${year}`)]);
  const base2020 = Number(row[head.indexOf('ESTIMATESBASE2020')]);
  if (!Number.isFinite(estimate) || estimate <= 0) throw new Error(`bad POPESTIMATE${year}`);
  return { year, estimate, base2020 };
}

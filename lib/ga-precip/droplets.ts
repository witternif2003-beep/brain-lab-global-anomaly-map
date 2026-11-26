/** Falling raindrops seeded from NOAA MRMS precipitation cells (pure). Sources: see /api/ga-precip and the research notes. */
import type { PrecipPhase } from './precip-cells';

/** Marshall & Palmer (1948, J. Meteor. 5:165): N(D) = N0 e^(-ΛD), N0 = 8000 m^-3 mm^-1, Λ = 4.1 R^-0.21 mm^-1 (R in mm/h). */
export const MP_N0 = 8000;
export const mpLambda = (rateMmH: number): number => 4.1 * Math.max(0.1, rateMmH) ** -0.21;
/** Drops per cubic metre of air (all sizes) for a rain rate: N0 / Λ. */
export const mpConcentration = (rateMmH: number): number => MP_N0 / mpLambda(rateMmH);
export const DROP_D_MIN_MM = 0.5;
export const DROP_D_MAX_MM = 6;
/** Diameter (mm) drawn from the Marshall–Palmer exponential, truncated to 0.5–6 mm. `u` in [0, 1). */
export function sampleDiameter(rateMmH: number, u: number): number {
  const l = mpLambda(rateMmH);
  return DROP_D_MIN_MM - Math.log(1 - u * (1 - Math.exp(-l * (DROP_D_MAX_MM - DROP_D_MIN_MM)))) / l;
}
/**
 * Terminal fall speed (m/s): rain per Atlas, Srivastava & Sekhon (1973), v = 9.65 − 10.3 e^(−0.6D), a fit to Gunn & Kinzer (1949);
 * snow ~1 m/s (order of magnitude for aggregates, Locatelli & Hobbs 1974); hail drawn at the large-drop limit.
 */
export function fallSpeed(diameterMm: number, phase: PrecipPhase): number {
  if (phase === 'snow') return 1;
  return Math.max(0.5, 9.65 - 10.3 * Math.exp(-0.6 * diameterMm));
}
/** Cloud base used when no METAR base is reported within range (m above ground). */
export const DEFAULT_BASE_M = 1500;

export interface RainCell { west: number; south: number; east: number; north: number; rateMmH: number; phase: PrecipPhase; baseM: number }
export interface Droplets { n: number; lng: Float64Array; lat: Float64Array; ground: Float32Array; top: Float32Array; speed: Float32Array; phase: Float32Array; snow: Uint8Array; realPerDrawn: number }

const M_PER_DEG = 111_320;
/** Seeds up to `budget` drops over the parts of `cells` inside `view`, in proportion to drops per column (N_T × area × base height). */
export function seedDroplets(cells: RainCell[], view: { west: number; south: number; east: number; north: number }, budget: number, groundAt: (lng: number, lat: number) => number, rand: () => number = Math.random): Droplets {
  const clipped: { c: RainCell; w: number; s: number; e: number; n: number; weight: number }[] = [];
  let total = 0;
  for (const c of cells) {
    const w = Math.max(c.west, view.west), e = Math.min(c.east, view.east), s = Math.max(c.south, view.south), n = Math.min(c.north, view.north);
    if (w >= e || s >= n || c.rateMmH < 0.1) continue;
    const area = (e - w) * M_PER_DEG * Math.cos((((s + n) / 2) * Math.PI) / 180) * (n - s) * M_PER_DEG;
    const weight = mpConcentration(c.rateMmH) * area * Math.max(50, c.baseM);
    total += weight;
    clipped.push({ c, w, s, e, n, weight });
  }
  const count = total > 0 ? Math.max(0, Math.floor(budget)) : 0;
  const d: Droplets = { n: count, lng: new Float64Array(count), lat: new Float64Array(count), ground: new Float32Array(count), top: new Float32Array(count), speed: new Float32Array(count), phase: new Float32Array(count), snow: new Uint8Array(count), realPerDrawn: count ? total / count : 0 };
  const cum: number[] = [];
  let acc = 0;
  for (const k of clipped) cum.push((acc += k.weight));
  for (let i = 0; i < count; i++) {
    const t = rand() * total;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < t) lo = mid + 1; else hi = mid; }
    const k = clipped[lo];
    d.lng[i] = k.w + rand() * (k.e - k.w);
    d.lat[i] = k.s + rand() * (k.n - k.s);
    d.ground[i] = groundAt(d.lng[i], d.lat[i]);
    d.top[i] = Math.max(50, k.c.baseM);
    d.speed[i] = fallSpeed(sampleDiameter(k.c.rateMmH, rand()), k.c.phase);
    d.phase[i] = rand();
    d.snow[i] = k.c.phase === 'snow' ? 1 : 0;
  }
  return d;
}

/** Writes each drop's streak (top end, bottom end) at time `tSec` into `src`/`dst` (xyz, z = ground + height × exaggeration). */
export function dropletPositions(d: Droplets, tSec: number, streakM: number, exaggeration: number, src: Float32Array, dst: Float32Array): void {
  for (let i = 0; i < d.n; i++) {
    const top = d.top[i];
    const fallen = (d.speed[i] * tSec + d.phase[i] * top) % top;
    const h = top - fallen;
    const z = d.ground[i] + h * exaggeration;
    const j = i * 3;
    src[j] = d.lng[i]; src[j + 1] = d.lat[i]; src[j + 2] = z + streakM * (d.snow[i] ? 0.2 : 1);
    dst[j] = d.lng[i]; dst[j + 1] = d.lat[i]; dst[j + 2] = z;
  }
}

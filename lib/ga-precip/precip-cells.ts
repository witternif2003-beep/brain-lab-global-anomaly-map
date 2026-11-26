/** NOAA MRMS surface precipitation type + rate + 1-hour accumulation → merged grid-cell rectangles over Georgia (pure). */
import type { MrmsGrid } from '../ga-clouds/mrms';

export type PrecipPhase = 'rain' | 'snow' | 'hail';

/**
 * MRMS PrecipFlag codes (NSSL MRMS operational product table, flag table; values 2, 4, 5, 8, 9 unused; -3 no coverage).
 * https://www.nssl.noaa.gov/projects/mrms/operational/tables.php (archived copy retrieved 2026-11-25).
 */
export const PRECIP_FLAGS: Record<number, { label: string; phase: PrecipPhase }> = {
  1: { label: 'warm stratiform rain', phase: 'rain' },
  3: { label: 'snow', phase: 'snow' },
  6: { label: 'convective rain', phase: 'rain' },
  7: { label: 'hail', phase: 'hail' },
  10: { label: 'cool stratiform rain', phase: 'rain' },
  91: { label: 'tropical stratiform rain', phase: 'rain' },
  96: { label: 'tropical convective rain', phase: 'rain' },
};

/** Lower bounds (mm/h) of the drawn rate bands; numeric ranges only, not named intensity classes. */
export const RATE_BANDS_MMH = [0.1, 2.5, 7.6, 16, 50] as const;
export const MIN_RATE_MMH = RATE_BANDS_MMH[0];

export const rateBand = (mmh: number): number => {
  let b = -1;
  for (let i = 0; i < RATE_BANDS_MMH.length; i++) if (mmh >= RATE_BANDS_MMH[i]) b = i;
  return b;
};

export interface PrecipSummary { cells: number; features: number; byPhase: Record<PrecipPhase, number>; peakRateMmH: number; peakQpe1hMm: number }

/**
 * Groups `factor`×`factor` native cells into blocks (dominant flag among cells with precipitation, max rate, max 1-h total),
 * then merges neighbouring blocks in a row with the same flag and rate band into one rectangle.
 */
export function precipCells(flag: MrmsGrid, rate: MrmsGrid, qpe: MrmsGrid | null, factor = 2): { geojson: GeoJSON.FeatureCollection<GeoJSON.Polygon>; summary: PrecipSummary } {
  if (flag.width !== rate.width || flag.height !== rate.height || (qpe && (qpe.width !== flag.width || qpe.height !== flag.height))) {
    throw new Error('MRMS grids differ in size');
  }
  const f = Math.max(1, Math.floor(factor));
  const { width: w, height: h, stepDeg: step, lat0, lng0 } = flag;
  const bw = Math.ceil(w / f), bh = Math.ceil(h / f);
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const summary: PrecipSummary = { cells: 0, features: 0, byPhase: { rain: 0, snow: 0, hail: 0 }, peakRateMmH: 0, peakQpe1hMm: 0 };
  const west = lng0 - step / 2, north = lat0 + step / 2, size = f * step;
  for (let by = 0; by < bh; by++) {
    let run: { code: number; band: number; x0: number; x1: number; rate: number; qpe: number; cells: number } | null = null;
    const flush = () => {
      if (!run) return;
      const meta = PRECIP_FLAGS[run.code];
      // Cell edges are whole multiples of the 0.01° grid, so 4 decimals are exact and keep the payload small.
      const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
      const x0 = r4(west + run.x0 * size), x1 = r4(west + (run.x1 + 1) * size), y0 = r4(north - by * size), y1 = r4(north - (by + 1) * size);
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]]] },
        properties: { flag: run.code, kind: meta.label, phase: meta.phase, band: run.band, rateMmH: +run.rate.toFixed(1), qpe1hMm: +run.qpe.toFixed(1), cells: run.cells },
      });
      summary.byPhase[meta.phase] += run.cells;
      run = null;
    };
    for (let bx = 0; bx < bw; bx++) {
      const counts = new Map<number, number>();
      let maxRate = 0, maxQpe = 0, wet = 0;
      for (let y = by * f; y < Math.min(h, (by + 1) * f); y++) {
        for (let x = bx * f; x < Math.min(w, (bx + 1) * f); x++) {
          const i = y * w + x;
          const r = rate.values[i];
          const c = Math.round(flag.values[i]);
          if (!(r >= MIN_RATE_MMH) || !PRECIP_FLAGS[c]) continue;
          wet++;
          counts.set(c, (counts.get(c) ?? 0) + 1);
          if (r > maxRate) maxRate = r;
          const q = qpe ? qpe.values[i] : 0;
          if (q > maxQpe) maxQpe = q;
        }
      }
      if (!wet) { flush(); continue; }
      let code = 0, best = -1;
      for (const [c, n] of counts) if (n > best || (n === best && c === 7)) { code = c; best = n; }
      const band = rateBand(maxRate);
      summary.cells += wet;
      summary.peakRateMmH = Math.max(summary.peakRateMmH, maxRate);
      summary.peakQpe1hMm = Math.max(summary.peakQpe1hMm, maxQpe);
      if (run && run.code === code && run.band === band && run.x1 === bx - 1) {
        run.x1 = bx; run.rate = Math.max(run.rate, maxRate); run.qpe = Math.max(run.qpe, maxQpe); run.cells += wet;
      } else {
        flush();
        run = { code, band, x0: bx, x1: bx, rate: maxRate, qpe: maxQpe, cells: wet };
      }
    }
    flush();
  }
  summary.features = features.length;
  summary.peakRateMmH = +summary.peakRateMmH.toFixed(1);
  summary.peakQpe1hMm = +summary.peakQpe1hMm.toFixed(1);
  return { geojson: { type: 'FeatureCollection', features }, summary };
}

const lerp = (a: number[], b: number[], t: number) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const hex = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const ramp = (stops: [number, string][], x: number): number[] => {
  if (x <= stops[0][0]) return hex(stops[0][1]);
  for (let i = 1; i < stops.length; i++) if (x <= stops[i][0]) return lerp(hex(stops[i - 1][1]), hex(stops[i][1]), (x - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
  return hex(stops[stops.length - 1][1]);
};
/** Same palette as the MapLibre fill: rain sky-blue → green → yellow → orange → red with rate; snow pale lilac; hail pink. Alpha 0.55 → 0.85 with rate. */
export const PRECIP_RAMPS: Record<PrecipPhase, [number, string][]> = {
  rain: [[0.1, '#7dd3fc'], [2.5, '#22c55e'], [7.6, '#eab308'], [16, '#f97316'], [50, '#dc2626']],
  snow: [[0.1, '#eef2ff'], [2.5, '#c7d2fe'], [7.6, '#a5b4fc']],
  hail: [[0.1, '#f9a8d4'], [16, '#ec4899'], [50, '#be185d']],
};
export function precipColor(phase: PrecipPhase, rateMmH: number): [number, number, number, number] {
  const [r, g, b] = ramp(PRECIP_RAMPS[phase] ?? PRECIP_RAMPS.rain, rateMmH);
  // Opaque enough to read over the cyan Census density dots drawn under it in the same overlay.
  const a = ramp([[0.1, '#8c8c8c'], [7.6, '#b3b3b3'], [50, '#d9d9d9']], rateMmH)[0];
  return [r, g, b, a];
}

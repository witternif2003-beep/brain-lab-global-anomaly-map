/** NOAA MRMS radar mosaic (18 dBZ echo top + composite reflectivity) → one record per native 0.01° radar cell (pure). */
import type { MrmsGrid } from './mrms';
import type { Metar } from './metar-clouds';

export const RADAR_BBOX = { latMin: 30.3, latMax: 35.1, lngMin: -85.7, lngMax: -80.8 };
/** Composite reflectivity bands (dBZ lower bounds). */
export const RADAR_BANDS: [string, number][] = [['light', 18], ['moderate', 30], ['heavy', 45], ['intense', 55]];
/** A cell gets a measured base only from a METAR station at most this far from its centre; otherwise only its top is drawn. */
export const BASE_SEARCH_KM = 25;
/** Values per cell in `RadarCells.cells`: column, row, echo top (m above sea level), peak dBZ, station index (-1 = none in range). */
export const CELL_STRIDE = 5;
const FT_TO_M = 0.3048;

export interface StationBase { id: string; lat: number; lng: number; baseM: number; observed: string | null }

/** Every native MRMS cell with an 18 dBZ echo top. */
export interface RadarCells {
  /** Centre of cell (0, 0); columns go east and rows go south by `stepDeg`. */
  lat0: number;
  lng0: number;
  stepDeg: number;
  stations: StationBase[];
  /** Flat array, CELL_STRIDE values per cell. */
  cells: number[];
  /** Cells with no measured base within BASE_SEARCH_KM (drawn as their top only). */
  noBase: number;
}

export const bandOf = (dbz: number) => {
  let b = 0;
  RADAR_BANDS.forEach(([, min], i) => {
    if (dbz >= min) b = i;
  });
  return b;
};

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(a));
}

/** Lowest reported cloud base at each METAR station (ceilometer, feet above ground → metres). */
export function stationBases(metars: Metar[]): StationBase[] {
  const out: StationBase[] = [];
  for (const m of metars) {
    if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon)) continue;
    const bases = (m.clouds ?? []).map((c) => c.base).filter((b): b is number => typeof b === 'number' && Number.isFinite(b) && b >= 0);
    if (bases.length) out.push({ id: m.icaoId ?? '', lat: m.lat as number, lng: m.lon as number, baseM: Math.round(Math.min(...bases) * FT_TO_M), observed: m.reportTime ?? null });
  }
  return out;
}

function nearest(stations: StationBase[], lat: number, lng: number): number {
  let best = -1;
  let bestKm = BASE_SEARCH_KM;
  stations.forEach((s, i) => {
    if (Math.abs(s.lat - lat) > 0.3) return;
    const d = haversineKm(lat, lng, s.lat, s.lng);
    if (d <= bestKm) {
      bestKm = d;
      best = i;
    }
  });
  return best;
}

/**
 * One record per native radar cell: no merging, no rounding beyond 1 m, no generated shape. Cells without a measured
 * METAR cloud base within BASE_SEARCH_KM get station index -1 (counted in `noBase`) instead of a guessed base.
 */
export function radarCloudCells(top: MrmsGrid, dbz: MrmsGrid, metars: Metar[]): RadarCells {
  if (top.width !== dbz.width || top.height !== dbz.height) throw new Error('echo-top and reflectivity grids differ');
  const stations = stationBases(metars);
  const cells: number[] = [];
  let noBase = 0;
  for (let y = 0; y < top.height; y++) {
    for (let x = 0; x < top.width; x++) {
      const i = y * top.width + x;
      const t = top.values[i];
      if (!(t > 0)) continue;
      const s = nearest(stations, top.lat0 - y * top.stepDeg, top.lng0 + x * top.stepDeg);
      if (s < 0) noBase++;
      cells.push(x, y, Math.round(t * 1000), Math.round(dbz.values[i]), s);
    }
  }
  return { lat0: top.lat0, lng0: top.lng0, stepDeg: top.stepDeg, stations, cells, noBase };
}

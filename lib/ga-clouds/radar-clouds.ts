/** NOAA MRMS radar mosaic (18 dBZ echo top + composite reflectivity) → 3D cloud blocks shaped by the radar echo (pure). */
import type { MrmsGrid } from './mrms';
import type { Metar } from './metar-clouds';
import { nightFactor } from '../terminator/night-mask';
import { subsolarPoint, sunAltitudeDeg } from '../terminator/solar';

export const RADAR_BBOX = { latMin: 30.3, latMax: 35.1, lngMin: -85.7, lngMax: -80.8 };
/** Composite reflectivity bands (dBZ lower bounds) drawn as separate opacity layers. */
export const RADAR_BANDS: [string, number][] = [['light', 18], ['moderate', 30], ['heavy', 45], ['intense', 55]];
export const BASE_SEARCH_KM = 100;
const FT_TO_M = 0.3048;

export interface RadarCloudOptions {
  /** Cells merged per side before shaping (1 = native 0.01° ≈ 1 km). */
  factor: number;
  /** Echo-top rounding step in metres; equal steps merge into one block. */
  topStepM: number;
  now: Date;
}

const bandOf = (dbz: number) => {
  let b = -1;
  RADAR_BANDS.forEach(([, min], i) => {
    if (dbz >= min) b = i;
  });
  return b;
};

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = Math.PI / 180;
  const a = Math.sin(((lat2 - lat1) * r) / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(((lng2 - lng1) * r) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(a));
}

interface StationBase { id: string; lat: number; lng: number; baseM: number; observed: string | null }

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

function nearestBase(stations: StationBase[], lat: number, lng: number): StationBase | null {
  let best: StationBase | null = null;
  let bestKm = BASE_SEARCH_KM;
  for (const s of stations) {
    const d = haversineKm(lat, lng, s.lat, s.lng);
    if (d <= bestKm) {
      bestKm = d;
      best = s;
    }
  }
  return best;
}

/**
 * Cells with an 18 dBZ echo top become columns from the nearest measured METAR cloud base (ground if none within
 * BASE_SEARCH_KM) up to the echo top. Neighbouring cells with the same rounded top and reflectivity band merge into
 * rectangles (row runs, then identical runs on consecutive rows), so the outline follows the radar echo cell by cell.
 */
export function radarCloudBlocks(top: MrmsGrid, dbz: MrmsGrid, metars: Metar[], opts: RadarCloudOptions): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  if (top.width !== dbz.width || top.height !== dbz.height) throw new Error('echo-top and reflectivity grids differ');
  const f = Math.max(1, Math.floor(opts.factor));
  const W = Math.floor(top.width / f);
  const H = Math.floor(top.height / f);
  const step = top.stepDeg * f;
  const topQ = new Int32Array(W * H);
  const band = new Int8Array(W * H).fill(-1);
  const peak = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let t = 0;
      let z = -Infinity;
      for (let dy = 0; dy < f; dy++) {
        for (let dx = 0; dx < f; dx++) {
          const i = (y * f + dy) * top.width + x * f + dx;
          if (top.values[i] > t) t = top.values[i];
          if (dbz.values[i] > z) z = dbz.values[i];
        }
      }
      const k = y * W + x;
      if (t <= 0) continue;
      topQ[k] = Math.max(1, Math.round((t * 1000) / opts.topStepM));
      band[k] = Math.max(0, bandOf(z));
      peak[k] = z;
    }
  }
  const stations = stationBases(metars);
  const sun = subsolarPoint(opts.now);
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const open = new Map<string, { x0: number; x1: number; y0: number; y1: number; q: number; b: number; zMax: number }>();
  const emit = (r: { x0: number; x1: number; y0: number; y1: number; q: number; b: number; zMax: number }) => {
    const west = top.lng0 - top.stepDeg / 2 + r.x0 * step;
    const east = top.lng0 - top.stepDeg / 2 + r.x1 * step;
    const north = top.lat0 + top.stepDeg / 2 - r.y0 * step;
    const south = top.lat0 + top.stepDeg / 2 - r.y1 * step;
    const lat = (north + south) / 2;
    const lng = (west + east) / 2;
    const st = nearestBase(stations, lat, lng);
    const topM = r.q * opts.topStepM;
    const baseM = st ? Math.min(st.baseM, topM - opts.topStepM) : 0;
    const rd = (v: number) => Math.round(v * 1e4) / 1e4;
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [[[rd(west), rd(north)], [rd(east), rd(north)], [rd(east), rd(south)], [rd(west), rd(south)], [rd(west), rd(north)]]] },
      properties: {
        band: RADAR_BANDS[r.b][0], topM, baseM: Math.max(0, baseM), dbz: Math.round(r.zMax), baseStation: st?.id ?? null, baseObserved: st?.observed ?? null,
        night: Math.round(nightFactor(sunAltitudeDeg(sun, lng, lat)) * 10) / 10,
      },
    });
  };
  for (let y = 0; y <= H; y++) {
    const seen = new Set<string>();
    if (y < H) {
      let x = 0;
      while (x < W) {
        const k = y * W + x;
        if (band[k] < 0) {
          x++;
          continue;
        }
        let x1 = x + 1;
        let zMax = peak[k];
        while (x1 < W && band[y * W + x1] === band[k] && topQ[y * W + x1] === topQ[k]) {
          zMax = Math.max(zMax, peak[y * W + x1]);
          x1++;
        }
        const key = `${x},${x1},${topQ[k]},${band[k]}`;
        const r = open.get(key);
        if (r) {
          r.y1 = y + 1;
          r.zMax = Math.max(r.zMax, zMax);
        } else open.set(key, { x0: x, x1, y0: y, y1: y + 1, q: topQ[k], b: band[k], zMax });
        seen.add(key);
        x = x1;
      }
    }
    for (const [key, r] of open) {
      if (!seen.has(key)) {
        emit(r);
        open.delete(key);
      }
    }
  }
  return { type: 'FeatureCollection', features };
}

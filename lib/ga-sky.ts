import type { Map as MapLibreMap, SkySpecification } from 'maplibre-gl';
import { subsolarPoint, sunAltitudeDeg } from './terminator/solar';

/** Sun elevation above the horizon in degrees (geometric, no refraction), from the map's existing Astronomical Almanac solar model. */
export const sunElevationDeg = (date: Date, lat: number, lon: number): number => sunAltitudeDeg(subsolarPoint(date), lon, lat);

/** Day, golden hour, then civil (0° to −6°), nautical (−6° to −12°) and astronomical (−12° to −18°) twilight, then night. */
export type SkyPhase = 'day' | 'golden' | 'civil' | 'nautical' | 'astronomical' | 'night';
export const skyPhase = (elev: number): SkyPhase =>
  elev >= 6 ? 'day' : elev >= 0 ? 'golden' : elev >= -6 ? 'civil' : elev >= -12 ? 'nautical' : elev >= -18 ? 'astronomical' : 'night';

type RGBA = [number, number, number, number];
/** Sun elevation (°) → sky, horizon and fog colour. Night sky is transparent so the NASA star map behind the map shows. */
const KEYS: [number, RGBA, RGBA, RGBA][] = [
  [-18, [3, 6, 18, 0], [10, 14, 34, 0.35], [8, 10, 22, 1]],
  [-12, [6, 12, 34, 0.35], [28, 30, 70, 0.6], [16, 18, 40, 1]],
  [-6, [20, 38, 92, 0.75], [120, 72, 120, 0.9], [60, 52, 88, 1]],
  [-2, [44, 76, 150, 0.9], [236, 120, 78, 1], [170, 110, 110, 1]],
  [2, [78, 128, 200, 1], [255, 170, 100, 1], [230, 180, 150, 1]],
  [6, [92, 150, 220, 1], [210, 225, 240, 1], [215, 228, 240, 1]],
  [20, [56, 132, 222, 1], [190, 222, 255, 1], [205, 225, 245, 1]],
];

const mix = (a: RGBA, b: RGBA, t: number): string => {
  const c = a.map((v, i) => v + (b[i] - v) * t);
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;
};

export function skyFor(elev: number): SkySpecification {
  const e = Math.max(KEYS[0][0], Math.min(KEYS[KEYS.length - 1][0], elev));
  let i = 0;
  while (i < KEYS.length - 2 && e > KEYS[i + 1][0]) i++;
  const [e0, s0, h0, f0] = KEYS[i];
  const [e1, s1, h1, f1] = KEYS[i + 1];
  const t = (e - e0) / (e1 - e0);
  const day = Math.max(0, Math.min(1, (elev + 12) / 18));
  return {
    'sky-color': mix(s0, s1, t),
    'horizon-color': mix(h0, h1, t),
    'fog-color': mix(f0, f1, t),
    'sky-horizon-blend': 0.5,
    'horizon-fog-blend': 0.6,
    'fog-ground-blend': ['interpolate', ['linear'], ['zoom'], 6, 1, 14, 0.35 + 0.45 * (1 - day)],
    'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.35 + 0.5 * day, 10, 0.2 + 0.6 * day, 12, 0],
  };
}

/** Keeps the map's sky on the real sun position at the map centre; re-evaluated every minute and after each move. */
export function attachSolarSky(map: MapLibreMap, now: () => Date = () => new Date()): () => void {
  let last = '';
  const apply = () => {
    const c = map.getCenter();
    const elev = sunElevationDeg(now(), c.lat, c.lng);
    const key = elev.toFixed(1);
    if (key === last) return;
    try {
      map.setSky(skyFor(elev));
    } catch {
      return; // style still parsing; style.load retries
    }
    last = key;
    (window as unknown as { __sky?: unknown }).__sky = { elevDeg: Number(key), phase: skyPhase(elev), at: now().toISOString() };
  };
  const reset = () => { last = ''; apply(); };
  map.on('style.load', reset);
  map.on('moveend', apply);
  const id = setInterval(apply, 60_000);
  apply();
  return () => { clearInterval(id); map.off('style.load', reset); map.off('moveend', apply); };
}

import type { LightSpecification, Map as MapLibreMap, SkySpecification } from 'maplibre-gl';
import { subsolarPoint, sunAltitudeDeg } from './terminator/solar';

/** Sun elevation above the horizon in degrees (geometric, no refraction), from the map's existing Astronomical Almanac solar model. */
export const sunElevationDeg = (date: Date, lat: number, lon: number): number => sunAltitudeDeg(subsolarPoint(date), lon, lat);

const RAD = Math.PI / 180;
/** Sun azimuth in degrees clockwise from true north. */
export function sunAzimuthDeg(date: Date, lat: number, lon: number): number {
  const sun = subsolarPoint(date);
  const d = sun.declinationDeg * RAD, p = lat * RAD, h = (lon - sun.longitudeDeg) * RAD;
  const az = Math.atan2(-Math.sin(h) * Math.cos(d), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(h)) / RAD;
  return (az + 360) % 360;
}

/** NOAA Solar Calculator atmospheric refraction correction (degrees) for a geometric elevation (degrees). */
export function refractionDeg(e: number): number {
  if (e > 85) return 0;
  const t = Math.tan(e * RAD);
  const arcsec = e > 5 ? 58.1 / t - 0.07 / t ** 3 + 0.000086 / t ** 5
    : e > -0.575 ? 1735 + e * (-518.2 + e * (103.4 + e * (-12.79 + e * 0.711)))
    : -20.774 / t;
  return arcsec / 3600;
}

/** Apparent (refracted) sun elevation: what an observer sees, and what drives the sky colour. */
export const apparentElevationDeg = (geometric: number): number => geometric + refractionDeg(geometric);

/** Day, golden hour, then civil (0° to −6°), nautical (−6° to −12°) and astronomical (−12° to −18°) twilight, then night. */
export type SkyPhase = 'day' | 'golden' | 'civil' | 'nautical' | 'astronomical' | 'night';
export const skyPhase = (elev: number): SkyPhase =>
  elev >= 6 ? 'day' : elev >= 0 ? 'golden' : elev >= -6 ? 'civil' : elev >= -12 ? 'nautical' : elev >= -18 ? 'astronomical' : 'night';

type RGBA = [number, number, number, number];
/** Sun elevation (°) → sky, horizon and fog colour. Night sky is transparent so the NASA star map behind the map shows. */
const KEYS: [number, RGBA, RGBA, RGBA][] = [
  [-18, [2, 4, 14, 0], [8, 12, 30, 0.3], [6, 8, 18, 1]],
  [-15, [4, 8, 24, 0.2], [14, 18, 46, 0.45], [10, 12, 28, 1]],
  [-12, [8, 14, 40, 0.4], [30, 34, 82, 0.6], [16, 18, 42, 1]],
  [-9, [14, 26, 70, 0.6], [70, 52, 110, 0.78], [36, 34, 66, 1]],
  [-6, [22, 42, 100, 0.78], [150, 78, 120, 0.9], [70, 56, 96, 1]],
  [-4, [32, 58, 128, 0.86], [214, 98, 96, 0.96], [120, 80, 106, 1]],
  [-2, [46, 80, 156, 0.92], [246, 128, 74, 1], [176, 112, 108, 1]],
  [0, [62, 104, 180, 0.97], [255, 150, 70, 1], [214, 140, 116, 1]],
  [2, [78, 128, 200, 1], [255, 176, 100, 1], [232, 178, 148, 1]],
  [4, [88, 142, 214, 1], [252, 204, 150, 1], [230, 206, 190, 1]],
  [6, [92, 150, 220, 1], [214, 226, 240, 1], [216, 228, 240, 1]],
  [12, [70, 142, 224, 1], [198, 222, 250, 1], [208, 226, 244, 1]],
  [25, [52, 128, 222, 1], [186, 218, 255, 1], [202, 224, 246, 1]],
  [50, [38, 112, 214, 1], [176, 212, 255, 1], [196, 220, 246, 1]],
];

const mix = (a: RGBA, b: RGBA, t: number): string => {
  const c = a.map((v, i) => v + (b[i] - v) * t);
  return `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;
};

/** Apparent sun elevation (°) → sky, horizon and fog colours. */
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

const hex = (c: RGBA) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const lerp = (a: RGBA, b: RGBA, t: number): RGBA => a.map((v, i) => v + (b[i] - v) * t) as RGBA;
/** Light on 3D buildings and clouds: from the sun's real azimuth and elevation by day, warm near the horizon, dim blue moonlight-like fill at night. */
export function lightFor(elev: number, azimuth: number): LightSpecification {
  const day = Math.max(0, Math.min(1, (elev + 6) / 12));
  const warm = Math.max(0, Math.min(1, 1 - Math.abs(elev - 1) / 7));
  const night: RGBA = [120, 140, 200, 1], noon: RGBA = [255, 252, 244, 1], low: RGBA = [255, 168, 96, 1];
  const color = lerp(lerp(night, noon, day), low, warm * Math.min(1, day * 2));
  return {
    anchor: 'map',
    position: [1.5, elev > -6 ? azimuth : 0, elev > -6 ? Math.max(0, Math.min(88, 90 - elev)) : 0],
    color: hex(color),
    intensity: 0.15 + 0.3 * day,
  };
}

/** Keeps the map's sky and 3D lighting on the real sun position at the map centre; re-evaluated every 15 s and after each move. */
export function attachSolarSky(map: MapLibreMap, now: () => Date = () => new Date()): () => void {
  let last = '';
  const apply = () => {
    const c = map.getCenter();
    const at = now();
    const geo = sunElevationDeg(at, c.lat, c.lng);
    const elev = apparentElevationDeg(geo);
    const az = sunAzimuthDeg(at, c.lat, c.lng);
    const key = `${elev.toFixed(2)}|${az.toFixed(0)}`;
    if (key === last) return;
    try {
      map.setSky(skyFor(elev));
      map.setLight(lightFor(elev, az));
    } catch {
      return; // style still parsing; style.load retries
    }
    last = key;
    (window as unknown as { __sky?: unknown }).__sky = { elevDeg: Number(elev.toFixed(2)), geometricDeg: Number(geo.toFixed(2)), azimuthDeg: Number(az.toFixed(1)), phase: skyPhase(geo), at: at.toISOString() };
  };
  const reset = () => { last = ''; apply(); };
  map.on('style.load', reset);
  map.on('moveend', apply);
  const id = setInterval(apply, 15_000);
  apply();
  return () => { clearInterval(id); map.off('style.load', reset); map.off('moveend', apply); };
}

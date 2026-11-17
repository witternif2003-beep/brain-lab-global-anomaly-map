import type { LightSpecification, Map as MapLibreMap, SkySpecification } from 'maplibre-gl';
import { subsolarPoint, sunAltitudeDeg } from './terminator/solar';
import { skyColours } from './ga-sky-scatter';

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

const rgba = (c: [number, number, number], a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;

/**
 * Apparent sun elevation (°) and camera bearing relative to the sun's azimuth (°) → sky,
 * horizon and fog colours from single Rayleigh/Mie/ozone scattering (lib/ga-sky-scatter.ts).
 * Looking toward the sun at sunset gives an orange horizon, looking away a dimmer blue-pink one.
 * Night sky is transparent so the NASA star map behind the map shows.
 */
export function skyFor(elev: number, relAzDeg = 90): SkySpecification {
  const c = skyColours(elev, relAzDeg);
  const day = Math.max(0, Math.min(1, (elev + 12) / 18));
  return {
    'sky-color': rgba(c.sky, c.alpha),
    'horizon-color': rgba(c.horizon, Math.min(1, c.alpha * 1.15)),
    'fog-color': rgba(c.fog, 1),
    'sky-horizon-blend': 0.5,
    'horizon-fog-blend': 0.6,
    // Fog starts at the horizon (1 = horizon) so the ground stays sharp; atmosphere glow at its maximum (1) at every zoom.
    'fog-ground-blend': 1,
    'atmosphere-blend': 1,
  };
}

const hex = (c: RGBA) => `#${c.slice(0, 3).map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
const lerp = (a: RGBA, b: RGBA, t: number): RGBA => a.map((v, i) => v + (b[i] - v) * t) as RGBA;
/** Light on 3D buildings and clouds: from the sun's real azimuth and elevation by day, warm near the horizon, dim blue moonlight-like fill at night. */
/** Fixed afternoon light for 3D buildings: sun from the south, 25° up (polar 65°), intensity 0.8. */
export const BUILDING_LIGHT: LightSpecification = { anchor: 'map', position: [1.5, 180, 65], color: '#ffffff', intensity: 0.8 };

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

/** Keeps the map's sky and 3D lighting on the real sun position at the map centre and the camera's bearing; re-evaluated every 15 s and after each move or rotation. */
export function attachSolarSky(map: MapLibreMap, now: () => Date = () => new Date()): () => void {
  let last = '';
  const apply = () => {
    const c = map.getCenter();
    const at = now();
    const geo = sunElevationDeg(at, c.lat, c.lng);
    const elev = apparentElevationDeg(geo);
    const az = sunAzimuthDeg(at, c.lat, c.lng);
    const rel = (((map.getBearing() - az) % 360) + 360) % 360;
    const key = `${elev.toFixed(2)}|${az.toFixed(0)}|${Math.round(rel / 5)}`;
    if (key === last) return;
    try {
      map.setSky(skyFor(elev, rel));
      map.setLight(BUILDING_LIGHT);
    } catch {
      return; // style still parsing; style.load retries
    }
    last = key;
    (window as unknown as { __sky?: unknown }).__sky = { elevDeg: Number(elev.toFixed(2)), geometricDeg: Number(geo.toFixed(2)), azimuthDeg: Number(az.toFixed(1)), viewFromSunDeg: Math.round(rel), phase: skyPhase(geo), at: at.toISOString() };
  };
  const reset = () => { last = ''; apply(); };
  map.on('style.load', reset);
  map.on('moveend', apply);
  const id = setInterval(apply, 15_000);
  apply();
  return () => { clearInterval(id); map.off('style.load', reset); map.off('moveend', apply); };
}

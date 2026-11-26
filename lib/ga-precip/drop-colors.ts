import type { Droplets } from './droplets';

/** Translucent water blue (matched to the user's reference photo); snow stays white. Not measured: water is nearly clear at drop size. */
export const WATER_RGBA = [60, 150, 215, 175] as const;
const GLINT_RGBA = [235, 248, 255, 245] as const;
const SNOW_RGBA = [235, 240, 250, 220] as const;

/** Sun-shower glint: each drop flashes towards white at its own rate (visual effect only, not measured). */
export function sparkle(d: Pick<Droplets, 'n' | 'speed' | 'phase' | 'snow'>, t: number, out: Uint8Array) {
  for (let i = 0; i < d.n; i++) {
    const g = Math.max(0, Math.sin(t * (2 + d.speed[i]) + d.phase[i] * 6.283)) ** 12;
    const base = d.snow[i] ? SNOW_RGBA : WATER_RGBA;
    const j = i * 4;
    for (let k = 0; k < 4; k++) out[j + k] = base[k] + (GLINT_RGBA[k] - base[k]) * g;
  }
}

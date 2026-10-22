import { SHADE_EDGES, shadeOpacity, SHADE_MAX_OPACITY, type SubsolarPoint } from './solar';

const DEG = Math.PI / 180;

/** `lights`: dark pixels become transparent so only emitted light shows; `overlay`: keep the tile's own alpha. */
export type NightMaskMode = 'lights' | 'overlay';

/** Luminance (max channel, 0-1) below which a city-lights pixel is treated as unlit background. */
export const LIGHTS_FLOOR = 0.08;
const LIGHTS_RAMP = 0.45;

/** 0 in daylight, 1 at astronomical night, following the night-shade ramp. */
export const nightFactor = (altitudeDeg: number) => shadeOpacity(altitudeDeg) / SHADE_MAX_OPACITY;

/**
 * Scales the alpha of an RGBA web-mercator tile (z/x/y, `size` px square) by how dark it is at each pixel,
 * so the tile is invisible in daylight and fully shown at night. Mutates `px` in place.
 */
export function maskTileToNight(
  px: Uint8ClampedArray,
  size: number,
  z: number,
  x: number,
  y: number,
  sun: SubsolarPoint,
  mode: NightMaskMode,
): void {
  const n = 2 ** z;
  const sd = Math.sin(sun.declinationDeg * DEG);
  const cd = Math.cos(sun.declinationDeg * DEG);
  const cosH = new Float64Array(size);
  for (let i = 0; i < size; i++) {
    const lng = ((x + (i + 0.5) / size) / n) * 360 - 180;
    cosH[i] = Math.cos((lng - sun.longitudeDeg) * DEG);
  }
  const top = Math.sin(SHADE_EDGES[0] * DEG);
  for (let j = 0; j < size; j++) {
    const lat = Math.atan(Math.sinh(Math.PI * (1 - (2 * (y + (j + 0.5) / size)) / n)));
    const a = Math.sin(lat) * sd;
    const b = Math.cos(lat) * cd;
    for (let i = 0; i < size; i++) {
      const o = (j * size + i) * 4;
      const s = a + b * cosH[i];
      if (s >= top) {
        px[o + 3] = 0;
        continue;
      }
      const night = nightFactor(Math.asin(Math.max(-1, Math.min(1, s))) / DEG);
      let alpha = px[o + 3] / 255;
      if (mode === 'lights') {
        const lum = Math.max(px[o], px[o + 1], px[o + 2]) / 255;
        alpha *= Math.max(0, Math.min(1, (lum - LIGHTS_FLOOR) / LIGHTS_RAMP));
      }
      px[o + 3] = Math.round(alpha * night * 255);
    }
  }
}

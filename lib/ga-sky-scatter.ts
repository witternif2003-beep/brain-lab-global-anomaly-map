/**
 * Single-scattering clear-sky radiance at 680, 550 and 440 nm (red, green, blue),
 * ray-marched through a spherical atmosphere. Constants are the Earth model of
 * Bruneton, "Precomputed Atmospheric Scattering" reference implementation
 * (github.com/ebruneton/precomputed_atmospheric_scattering, atmosphere/demo/demo.cc
 * and model.h): Rayleigh 1.24062e-6·λ⁻⁴ m⁻¹ (λ in µm), 8 km scale height; Mie
 * 5.328e-3/1200 m⁻¹ extinction, 0.9 albedo, 1.2 km scale height, g = 0.8;
 * 300 DU ozone in a 10–40 km tent profile. Sunlight is normalised to white, so
 * colours come from the atmosphere only. Multiple scattering is not modelled,
 * so deep twilight is darker than real.
 */

const R_BOTTOM = 6_360_000;
const R_TOP = 6_420_000;
const OBSERVER_ALT_M = 300;
const RAYLEIGH = [680, 550, 440].map((nm) => 1.24062e-6 * (nm * 1e-3) ** -4);
const MIE_EXT = 5.328e-3 / 1200;
const MIE_SCA = 0.9 * MIE_EXT;
const MIE_G = 0.8;
const OZONE_MAX = (300 * 2.687e20) / 15000;
/** O₃ cross-sections (m²) at 680, 550, 440 nm, from the same file's 10 nm table. */
const OZONE = [1.209e-25, 3.5e-25, 1.582e-26].map((s) => s * OZONE_MAX);
const H_R = 8000;
const H_M = 1200;
const VIEW_STEPS = 32;
const SUN_STEPS = 12;

export type RGB = [number, number, number];

const ozoneDensity = (h: number) => (h < 25000 ? h / 15000 - 2 / 3 : 8 / 3 - h / 15000);

/** Distance along unit ray (origin o, direction d) to the sphere of radius r, or −1 if missed/behind. */
function sphereExit(o: RGB, d: RGB, r: number): number {
  const b = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
  const c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - r * r;
  const disc = b * b - c;
  if (disc < 0) return -1;
  const s = Math.sqrt(disc);
  const far = -b + s;
  return far > 0 ? far : -1;
}

function hitsGround(o: RGB, d: RGB): boolean {
  const b = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
  const c = o[0] * o[0] + o[1] * o[1] + o[2] * o[2] - R_BOTTOM * R_BOTTOM;
  const disc = b * b - c;
  return disc >= 0 && -b - Math.sqrt(disc) > 0;
}

function opticalDepth(o: RGB, d: RGB, len: number): RGB {
  const ds = len / SUN_STEPS;
  let r = 0, m = 0, oz = 0;
  for (let i = 0; i < SUN_STEPS; i++) {
    const t = (i + 0.5) * ds;
    const h = Math.hypot(o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t) - R_BOTTOM;
    r += Math.exp(-h / H_R) * ds;
    m += Math.exp(-h / H_M) * ds;
    oz += Math.max(0, ozoneDensity(h)) * ds;
  }
  return [r, m, oz];
}

const rayleighPhase = (mu: number) => (3 / (16 * Math.PI)) * (1 + mu * mu);
const miePhase = (mu: number) =>
  ((3 / (8 * Math.PI)) * (1 - MIE_G ** 2) * (1 + mu * mu)) / ((2 + MIE_G ** 2) * (1 + MIE_G ** 2 - 2 * MIE_G * mu) ** 1.5);

/**
 * Sky radiance (per unit solar irradiance, sr⁻¹) seen at view elevation `viewElevDeg`
 * and azimuth `relAzDeg` measured from the sun's azimuth, with the sun at `sunElevDeg`.
 */
export function skyRadiance(sunElevDeg: number, viewElevDeg: number, relAzDeg: number): RGB {
  const rad = Math.PI / 180;
  const se = sunElevDeg * rad, ve = Math.max(viewElevDeg, 0) * rad, va = relAzDeg * rad;
  const sun: RGB = [Math.cos(se), 0, Math.sin(se)];
  const view: RGB = [Math.cos(ve) * Math.cos(va), Math.cos(ve) * Math.sin(va), Math.sin(ve)];
  const o: RGB = [0, 0, R_BOTTOM + OBSERVER_ALT_M];
  const len = sphereExit(o, view, R_TOP);
  const mu = view[0] * sun[0] + view[1] * sun[1] + view[2] * sun[2];
  const pr = rayleighPhase(mu), pm = miePhase(mu);
  const ds = len / VIEW_STEPS;
  const out: RGB = [0, 0, 0];
  let dr = 0, dm = 0, doz = 0;
  for (let i = 0; i < VIEW_STEPS; i++) {
    const t = (i + 0.5) * ds;
    const p: RGB = [o[0] + view[0] * t, o[1] + view[1] * t, o[2] + view[2] * t];
    const h = Math.hypot(p[0], p[1], p[2]) - R_BOTTOM;
    const rr = Math.exp(-h / H_R) * ds, rm = Math.exp(-h / H_M) * ds;
    dr += rr / 2; dm += rm / 2; doz += Math.max(0, ozoneDensity(h)) * ds / 2;
    if (!hitsGround(p, sun)) {
      const [sr, sm, so] = opticalDepth(p, sun, sphereExit(p, sun, R_TOP));
      for (let c = 0; c < 3; c++) {
        const tau = RAYLEIGH[c] * (dr + sr) + MIE_EXT * (dm + sm) + OZONE[c] * (doz + so);
        out[c] += Math.exp(-tau) * (RAYLEIGH[c] * rr * pr + MIE_SCA * rm * pm);
      }
    }
    dr += rr / 2; dm += rm / 2; doz += Math.max(0, ozoneDensity(h)) * ds / 2;
  }
  return out;
}

/** Relative luminance (Rec. 709 weights) of a linear RGB radiance. */
export const luminance = (c: RGB) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];

/** Typical sky luminance (10° up, 90° from the sun) at a sun elevation; drives exposure and opacity. */
const refLuminance = (sunElevDeg: number) => luminance(skyRadiance(sunElevDeg, 10, 90));
const L_DAY = refLuminance(2);
const L_FLOOR = 1e-6;
/** Partial eye/camera adaptation: twilight is brightened but stays darker than day. */
const ADAPT = 0.75;
const K = 1.2;
/**
 * Crude stand-in for multiple scattering: a fraction of the mid-sky radiance added to every
 * horizon sample, so the Earth's-shadow side keeps a dim blue-grey instead of going black.
 */
const MULTI = 0.4;
const add = (a: RGB, b: RGB, k: number): RGB => [a[0] + k * b[0], a[1] + k * b[1], a[2] + k * b[2]];

const srgb = (v: number) => Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055));

/** Exposure, hue-preserving tone map and sRGB encode of a radiance. */
function display(c: RGB, exposure: number): [number, number, number] {
  const y = luminance(c);
  if (y <= 0) return [0, 0, 0];
  const s = (1 - Math.exp(-exposure * y)) / y;
  let out = c.map((v) => v * s);
  const peak = Math.max(...out);
  if (peak > 1) out = out.map((v) => v / peak);
  return out.map(srgb) as [number, number, number];
}

export interface SkyColours {
  sky: [number, number, number];
  horizon: [number, number, number];
  fog: [number, number, number];
  /** Sky opacity: 1 in daylight, falling with log sky luminance so the star map shows through at night. */
  alpha: number;
}

/**
 * Display colours for MapLibre's sky gradient with the sun at `sunElevDeg` and the camera
 * looking `relAzDeg` away from the sun's azimuth. From −6° down, single scattering
 * underestimates the sky, so the −6° colours are kept and opacity falls linearly to 0
 * at −18° (end of astronomical twilight).
 */
export function skyColours(sunElevDeg: number, relAzDeg: number): SkyColours {
  const e = Math.max(sunElevDeg, -6);
  const lref = Math.max(refLuminance(e), L_FLOOR);
  const mid = skyRadiance(e, 35, 90);
  const horizonAt = (elevDeg: number, rel: number) => add(skyRadiance(e, elevDeg, rel), mid, MULTI);
  // Exposure follows the brightest horizon (toward the sun), so turning away from the sun darkens the view.
  const exposure = K / Math.max(luminance(horizonAt(2, 0)), L_FLOOR) ** ADAPT;
  const logA = (Math.log10(lref) - Math.log10(L_FLOOR)) / (Math.log10(L_DAY) - Math.log10(L_FLOOR));
  let alpha = Math.max(0, Math.min(1, logA));
  if (sunElevDeg < -6) alpha *= Math.max(0, (sunElevDeg + 18) / 12);
  return {
    sky: display(mid, exposure),
    horizon: display(horizonAt(2, relAzDeg), exposure),
    fog: display(horizonAt(0, relAzDeg), exposure),
    alpha,
  };
}

const DEG = Math.PI / 180;

export interface SubsolarPoint {
  declinationDeg: number;
  longitudeDeg: number;
}

/** Sun altitude thresholds (deg): sunset incl. refraction and solar disc, civil, nautical, astronomical twilight. */
export const TWILIGHT_BANDS = [
  { id: 'sunset', altitudeDeg: -0.833 },
  { id: 'civil', altitudeDeg: -6 },
  { id: 'nautical', altitudeDeg: -12 },
  { id: 'astronomical', altitudeDeg: -18 },
] as const;

export type TwilightBandId = (typeof TWILIGHT_BANDS)[number]['id'];

const mod360 = (x: number) => ((x % 360) + 360) % 360;
const wrap180 = (x: number) => mod360(x + 180) - 180;

/** Low-precision solar coordinates (Astronomical Almanac, ~0.01° in declination for 1950–2050). */
export function subsolarPoint(date: Date): SubsolarPoint {
  const n = date.getTime() / 86_400_000 + 2_440_587.5 - 2_451_545.0;
  const L = mod360(280.46 + 0.9856474 * n);
  const g = mod360(357.528 + 0.9856003 * n) * DEG;
  const lambda = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * DEG;
  const eps = (23.439 - 0.0000004 * n) * DEG;
  const decl = Math.asin(Math.sin(eps) * Math.sin(lambda));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lambda), Math.cos(lambda));
  const gmst = mod360(280.46061837 + 360.98564736629 * n);
  return { declinationDeg: decl / DEG, longitudeDeg: wrap180(ra / DEG - gmst) };
}

export function sunAltitudeDeg(sun: SubsolarPoint, lng: number, lat: number): number {
  const d = sun.declinationDeg * DEG;
  const p = lat * DEG;
  const h = (lng - sun.longitudeDeg) * DEG;
  return Math.asin(Math.max(-1, Math.min(1, Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(h)))) / DEG;
}

/** Latitude intervals [lo, hi] where the sun is below `altitudeDeg` along meridian `lng`. */
export function belowIntervals(sun: SubsolarPoint, lng: number, altitudeDeg: number, stepDeg = 0.1): [number, number][] {
  const out: [number, number][] = [];
  const f = (lat: number) => sunAltitudeDeg(sun, lng, lat) - altitudeDeg;
  let start: number | null = null;
  let prevLat = -90;
  let prev = f(-90);
  if (prev < 0) start = -90;
  for (let lat = -90 + stepDeg; lat <= 90 + 1e-9; lat += stepDeg) {
    const cur = f(Math.min(lat, 90));
    if ((prev < 0) !== (cur < 0)) {
      const cross = prevLat + (prev / (prev - cur)) * (Math.min(lat, 90) - prevLat);
      if (cur < 0) start = cross;
      else if (start !== null) {
        out.push([start, cross]);
        start = null;
      }
    }
    prev = cur;
    prevLat = Math.min(lat, 90);
  }
  if (start !== null) out.push([start, 90]);
  return out;
}

/**
 * Night-side polygons for each twilight band as meridian strips. Each band's region contains the deeper bands,
 * so stacking translucent fills darkens toward astronomical night.
 */
export function twilightGeoJSON(date: Date, lngStepDeg = 1): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const sun = subsolarPoint(date);
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  for (const band of TWILIGHT_BANDS) {
    let left = belowIntervals(sun, -180, band.altitudeDeg);
    for (let lng0 = -180; lng0 < 180; lng0 += lngStepDeg) {
      const lng1 = Math.min(180, lng0 + lngStepDeg);
      const right = belowIntervals(sun, lng1, band.altitudeDeg);
      const paired = left.length === right.length;
      left.forEach(([lo0, hi0], i) => {
        const [lo1, hi1] = paired ? right[i] : [lo0, hi0];
        features.push({
          type: 'Feature',
          properties: { band: band.id },
          geometry: { type: 'Polygon', coordinates: [[[lng0, lo0], [lng1, lo1], [lng1, hi1], [lng0, hi0], [lng0, lo0]]] },
        });
      });
      left = right;
    }
  }
  return { type: 'FeatureCollection', features };
}

/** Altitude edges (deg) of the night-shade slices, from just above sunset down to astronomical night. */
export const SHADE_EDGES = [0.8, ...Array.from({ length: 19 }, (_, i) => -i)];
export const SHADE_MAX_OPACITY = 0.8;

/** Smooth darkness ramp: 0 above the sunset limit, SHADE_MAX_OPACITY at astronomical night (-18°). */
export function shadeOpacity(altitudeDeg: number): number {
  const t = Math.max(0, Math.min(1, (SHADE_EDGES[0] - altitudeDeg) / (SHADE_EDGES[0] + 18)));
  return SHADE_MAX_OPACITY * t * t * (3 - 2 * t);
}

/**
 * Latitude intervals along meridian `lng` for each altitude slice [edges[i+1], edges[i]) plus a final slice below the
 * last edge. Slices share interpolated boundaries, so adjacent slices meet without gaps or overlap.
 */
export function sliceIntervals(sun: SubsolarPoint, lng: number, edges: readonly number[], stepDeg = 0.1): [number, number][][] {
  const n = Math.round(180 / stepDeg);
  const lat = (i: number) => -90 + (i * 180) / n;
  const alt = Array.from({ length: n + 1 }, (_, i) => sunAltitudeDeg(sun, lng, lat(i)));
  const sliceOf = (a: number) => {
    let s = 0;
    while (s < edges.length && a < edges[s]) s++;
    return s - 1;
  };
  const out: [number, number][][] = edges.map(() => []);
  const cross = (i: number, edge: number) => lat(i - 1) + ((alt[i - 1] - edge) / (alt[i - 1] - alt[i])) * (lat(i) - lat(i - 1));
  let cur = sliceOf(alt[0]);
  let start = -90;
  for (let i = 1; i <= n; i++) {
    const s = sliceOf(alt[i]);
    if (s === cur) continue;
    const edge = s > cur ? edges[s] : edges[cur];
    const at = cross(i, edge);
    if (cur >= 0) out[cur].push([start, at]);
    cur = s;
    start = at;
  }
  if (cur >= 0) out[cur].push([start, 90]);
  return out;
}

const SHADE_MIN_STRIP_DEG = 0.125;

/** Non-overlapping night-shade strips with an `opacity` property that ramps smoothly from day to full night. */
export function nightShadeGeoJSON(date: Date, lngStepDeg = 2): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const sun = subsolarPoint(date);
  const opacity = SHADE_EDGES.map((e, i) => Number(shadeOpacity(i + 1 < SHADE_EDGES.length ? (e + SHADE_EDGES[i + 1]) / 2 : -90).toFixed(3)));
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  const quad = (s: number, lng0: number, lng1: number, [lo0, hi0]: [number, number], [lo1, hi1]: [number, number]) =>
    features.push({
      type: 'Feature',
      properties: { slice: s, opacity: opacity[s] },
      geometry: { type: 'Polygon', coordinates: [[[lng0, lo0], [lng1, lo1], [lng1, hi1], [lng0, hi0], [lng0, lo0]]] },
    });
  const strip = (lng0: number, lng1: number, left: [number, number][][], right: [number, number][][]) => {
    const matched = left.every((ivs, s) => ivs.length === right[s].length);
    if (!matched && lng1 - lng0 > SHADE_MIN_STRIP_DEG) {
      const mid = (lng0 + lng1) / 2;
      const centre = sliceIntervals(sun, mid, SHADE_EDGES);
      strip(lng0, mid, left, centre);
      strip(mid, lng1, centre, right);
      return;
    }
    left.forEach((ivs, s) => {
      if (ivs.length === right[s].length) ivs.forEach((iv, i) => quad(s, lng0, lng1, iv, right[s][i]));
      else {
        const mid = (lng0 + lng1) / 2;
        ivs.forEach((iv) => quad(s, lng0, mid, iv, iv));
        right[s].forEach((iv) => quad(s, mid, lng1, iv, iv));
      }
    });
  };
  let left = sliceIntervals(sun, -180, SHADE_EDGES);
  for (let lng0 = -180; lng0 < 180; lng0 += lngStepDeg) {
    const lng1 = Math.min(180, lng0 + lngStepDeg);
    const right = sliceIntervals(sun, lng1, SHADE_EDGES);
    strip(lng0, lng1, left, right);
    left = right;
  }
  return { type: 'FeatureCollection', features };
}

/** Pure geometry for the 50-state border runners (no DOM/WebGL), shared by the map layer and tests. */
export type LngLat = [number, number];

// 12 km/h, an easy running pace.
export const RUN_SPEED_MPS = 12 / 3.6;
const COORD_SCALE = 100_000;
const M_PER_DEG_LAT = 111_320;
const GOLDEN = 0.6180339887498949;

/** Local equirectangular distance (m) and heading (radians, 0 = east, CCW) from a to b. */
export function vector(a: LngLat, b: LngLat): { dist: number; heading: number } {
  const x = (b[0] - a[0]) * M_PER_DEG_LAT * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  const y = (b[1] - a[1]) * M_PER_DEG_LAT;
  return { dist: Math.hypot(x, y), heading: Math.atan2(y, x) };
}

export interface BorderState {
  st: string;
  name: string;
  fips: string;
  perimeterM: number;
  d: number[];
}

/** Closed ring from the build script's 1e-5° delta encoding. */
export function decodeRing(d: number[]): LngLat[] {
  const out: LngLat[] = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i + 1 < d.length; i += 2) {
    x += d[i];
    y += d[i + 1];
    out.push([x / COORD_SCALE, y / COORD_SCALE]);
  }
  return out;
}

/** Arc-length parameterised border ring. */
export class BorderPath {
  readonly cum: Float64Array;
  readonly total: number;

  constructor(readonly pts: LngLat[]) {
    this.cum = new Float64Array(pts.length);
    for (let i = 1; i < pts.length; i++) this.cum[i] = this.cum[i - 1] + vector(pts[i - 1], pts[i]).dist;
    this.total = this.cum[pts.length - 1] ?? 0;
  }

  /** Point and heading (radians, 0 = east, CCW) `dist` metres along the ring, wrapping. */
  at(dist: number): { lngLat: LngLat; heading: number } {
    const s = ((dist % this.total) + this.total) % this.total;
    let lo = 0;
    let hi = this.cum.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (this.cum[mid] <= s) lo = mid;
      else hi = mid;
    }
    const a = this.pts[lo];
    const b = this.pts[hi];
    const seg = this.cum[hi] - this.cum[lo];
    const f = seg > 0 ? (s - this.cum[lo]) / seg : 0;
    return { lngLat: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f], heading: vector(a, b).heading };
  }
}

/** Each state's runner starts at a fixed fraction of its border and runs at RUN_SPEED_MPS on the wall clock. */
export function runnerDistance(path: BorderPath, fips: string, epochMs: number): number {
  const start = ((Number(fips) * GOLDEN) % 1) * path.total;
  return start + (RUN_SPEED_MPS * epochMs) / 1000;
}

export interface BorderRunner {
  st: string;
  name: string;
  fips: string;
  path: BorderPath;
}

export function buildRunners(states: BorderState[]): BorderRunner[] {
  return states.map((s) => ({ st: s.st, name: s.name, fips: s.fips, path: new BorderPath(decodeRing(s.d)) }));
}

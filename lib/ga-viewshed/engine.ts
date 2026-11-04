import Flatbush from 'flatbush';

/**
 * Line-of-sight analysis over public terrain and building footprints. Coordinates are local east/north
 * metres around an origin; heights are metres above the same datum as `ground`.
 */
export interface Building {
  /** Outer ring, local metres, [x0, y0, x1, y1, …]. */
  ring: Float64Array;
  /** Roof height above sea level, metres. */
  topM: number;
}

export type Ground = (x: number, y: number) => number;

export interface Observer {
  x: number;
  y: number;
  /** Eye height above sea level, metres. */
  z: number;
}

const M_PER_DEG_LAT = 111_320;

export function localFrame(lng0: number, lat0: number) {
  const k = Math.cos((lat0 * Math.PI) / 180) * M_PER_DEG_LAT;
  return {
    toLocal: (lng: number, lat: number): [number, number] => [(lng - lng0) * k, (lat - lat0) * M_PER_DEG_LAT],
    toLngLat: (x: number, y: number): [number, number] => [lng0 + x / k, lat0 + y / M_PER_DEG_LAT],
  };
}

/** Distances along the ray from (ox, oy) heading (dx, dy) where it crosses the ring's edges. */
function rayRingHits(ring: Float64Array, ox: number, oy: number, dx: number, dy: number, maxT: number, out: number[]): void {
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const ax = ring[j], ay = ring[j + 1];
    const ex = ring[i] - ax, ey = ring[i + 1] - ay;
    const den = dx * ey - dy * ex;
    if (Math.abs(den) < 1e-12) continue;
    const wx = ax - ox, wy = ay - oy;
    const t = (wx * ey - wy * ex) / den;
    const u = (wx * dy - wy * dx) / den;
    if (t >= 0 && t <= maxT && u >= 0 && u <= 1) out.push(t);
  }
}

export function pointInRing(ring: Float64Array, x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const yi = ring[i + 1], yj = ring[j + 1];
    if (yi > y !== yj > y && x < ((ring[j] - ring[i]) * (y - yi)) / (yj - yi) + ring[i]) inside = !inside;
  }
  return inside;
}

export class BuildingIndex {
  private readonly index: Flatbush | null;

  constructor(readonly buildings: readonly Building[]) {
    if (!buildings.length) {
      this.index = null;
      return;
    }
    const idx = new Flatbush(buildings.length);
    for (const b of buildings) {
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < b.ring.length; i += 2) {
        x0 = Math.min(x0, b.ring[i]); x1 = Math.max(x1, b.ring[i]);
        y0 = Math.min(y0, b.ring[i + 1]); y1 = Math.max(y1, b.ring[i + 1]);
      }
      idx.add(x0, y0, x1, y1);
    }
    idx.finish();
    this.index = idx;
  }

  get size(): number {
    return this.buildings.length;
  }

  /** Buildings whose footprint the segment crosses, with entry/exit distances along it. */
  segmentHits(ox: number, oy: number, dx: number, dy: number, maxT: number): { t0: number; t1: number; topM: number }[] {
    if (!this.index) return [];
    const ex = ox + dx * maxT, ey = oy + dy * maxT;
    const ids = this.index.search(Math.min(ox, ex), Math.min(oy, ey), Math.max(ox, ex), Math.max(oy, ey));
    const out: { t0: number; t1: number; topM: number }[] = [];
    const ts: number[] = [];
    for (const id of ids) {
      const b = this.buildings[id];
      ts.length = 0;
      rayRingHits(b.ring, ox, oy, dx, dy, maxT, ts);
      const inside = pointInRing(b.ring, ox, oy);
      if (!ts.length && !inside) continue;
      ts.sort((a, c) => a - c);
      const t0 = inside ? 0 : ts[0];
      const t1 = ts.length ? ts[ts.length - 1] : maxT;
      out.push({ t0, t1, topM: b.topM });
    }
    return out;
  }

  buildingAt(x: number, y: number): Building | null {
    if (!this.index) return null;
    for (const id of this.index.search(x, y, x, y)) if (pointInRing(this.buildings[id].ring, x, y)) return this.buildings[id];
    return null;
  }
}

export interface ViewshedOptions {
  radiusM?: number;
  azimuths?: number;
  stepM?: number;
  /** Target height above ground, metres (1.5 m ≈ standing eye/chest height). */
  targetM?: number;
}

export interface Viewshed {
  /** Unobstructed reach per azimuth, metres (clockwise from north). */
  reach: Float64Array;
  /** Closed ring of reach endpoints, local metres. */
  ring: [number, number][];
  areaM2: number;
  circleAreaM2: number;
  ms: number;
}

/** Radial sweep: along each azimuth, the first target point hidden behind terrain or a roof ends the visible reach. */
export class ViewshedEngine {
  constructor(private readonly index: BuildingIndex, private readonly ground: Ground) {}

  /** Whether a target `targetM` above ground at (x, y) is visible from the observer. */
  visible(o: Observer, x: number, y: number, targetM = 1.5, stepM = 5): boolean {
    const dx = x - o.x, dy = y - o.y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-6) return true;
    const ux = dx / d, uy = dy / d;
    const tz = this.ground(x, y) + targetM;
    const slope = (tz - o.z) / d;
    for (const h of this.index.segmentHits(o.x, o.y, ux, uy, d)) {
      if (h.t1 >= d - 0.01 && h.t0 >= d - 0.01) continue;
      const t = Math.max(h.t0, 1e-3);
      if (t >= d) continue;
      const atTarget = this.index.buildingAt(x, y);
      if (atTarget && Math.abs(atTarget.topM - h.topM) < 1e-6 && h.t1 >= d - 0.01) continue;
      if ((h.topM - o.z) / t > slope) return false;
    }
    for (let t = stepM; t < d; t += stepM) {
      if ((this.ground(o.x + ux * t, o.y + uy * t) - o.z) / t > slope) return false;
    }
    return true;
  }

  analyze(o: Observer, opts: ViewshedOptions = {}): Viewshed {
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const R = opts.radiusM ?? 500;
    const N = opts.azimuths ?? 360;
    const step = opts.stepM ?? 5;
    const targetM = opts.targetM ?? 1.5;
    const reach = new Float64Array(N);
    const ring: [number, number][] = [];
    for (let a = 0; a < N; a++) {
      const az = (a / N) * 2 * Math.PI;
      const ux = Math.sin(az), uy = Math.cos(az);
      const hits = this.index.segmentHits(o.x, o.y, ux, uy, R).filter((h) => h.t1 > 0.5).sort((p, q) => p.t0 - q.t0);
      let maxSlope = -Infinity;
      let hi = 0;
      let r = R;
      for (let t = step; t <= R; t += step) {
        while (hi < hits.length && hits[hi].t0 <= t) {
          const h = hits[hi++];
          const tt = Math.max(h.t0, 0.5);
          maxSlope = Math.max(maxSlope, (h.topM - o.z) / tt);
        }
        const g = this.ground(o.x + ux * t, o.y + uy * t);
        const targetSlope = (g + targetM - o.z) / t;
        if (targetSlope < maxSlope) {
          r = t - step;
          break;
        }
        maxSlope = Math.max(maxSlope, (g - o.z) / t);
      }
      reach[a] = Math.max(0, r);
      ring.push([o.x + ux * reach[a], o.y + uy * reach[a]]);
    }
    ring.push(ring[0]);
    let area = 0;
    for (let i = 0; i < ring.length - 1; i++) area += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
    return { reach, ring, areaM2: Math.abs(area) / 2, circleAreaM2: Math.PI * R * R, ms };
  }
}

export interface Aoi {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface BlindspotGrid {
  cellM: number;
  cols: number;
  rows: number;
  /** 1 = seen by at least one observer, 0 = blind spot, 255 = inside a building (not ground). */
  cells: Uint8Array;
  coverage: number;
  ms: number;
}

/** Ground cells of an area that no observer can see. */
export class BlindspotDetector {
  constructor(private readonly engine: ViewshedEngine, private readonly index: BuildingIndex) {}

  detect(aoi: Aoi, observers: readonly Observer[], opts: { cellM?: number; targetM?: number } = {}): BlindspotGrid {
    const started = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const cellM = opts.cellM ?? 5;
    const cols = Math.max(1, Math.ceil((aoi.x1 - aoi.x0) / cellM));
    const rows = Math.max(1, Math.ceil((aoi.y1 - aoi.y0) / cellM));
    const cells = new Uint8Array(cols * rows);
    let ground = 0, seen = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = aoi.x0 + (c + 0.5) * cellM, y = aoi.y0 + (r + 0.5) * cellM;
        if (this.index.buildingAt(x, y)) {
          cells[r * cols + c] = 255;
          continue;
        }
        ground++;
        if (observers.some((o) => this.engine.visible(o, x, y, opts.targetM ?? 1.5, cellM))) {
          cells[r * cols + c] = 1;
          seen++;
        }
      }
    }
    const ms = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - started;
    return { cellM, cols, rows, cells, coverage: ground ? seen / ground : 0, ms };
  }
}

export interface RankedVantage {
  observer: Observer;
  /** Fraction of the area's ground cells this candidate sees alone. */
  coverage: number;
  /** Added coverage when picked greedily after the better candidates. */
  marginal: number;
}

/** Ranks candidate viewpoints (e.g. rooftops) by how much of the area's ground each one adds. */
export class VantageAnalyzer {
  constructor(private readonly detector: BlindspotDetector) {}

  rank(aoi: Aoi, candidates: readonly Observer[], opts: { cellM?: number; pick?: number } = {}): RankedVantage[] {
    const grids = candidates.map((o) => this.detector.detect(aoi, [o], { cellM: opts.cellM ?? 10 }));
    const ground = grids[0] ? grids[0].cells.reduce((n, v) => n + (v === 255 ? 0 : 1), 0) : 0;
    const covered = new Uint8Array(grids[0]?.cells.length ?? 0);
    const left = candidates.map((_, i) => i);
    const out: RankedVantage[] = [];
    const pick = Math.min(opts.pick ?? candidates.length, candidates.length);
    while (out.length < pick && left.length) {
      let best = -1, bestGain = -1;
      for (const i of left) {
        let gain = 0;
        grids[i].cells.forEach((v, k) => { if (v === 1 && !covered[k]) gain++; });
        if (gain > bestGain) { bestGain = gain; best = i; }
      }
      grids[best].cells.forEach((v, k) => { if (v === 1) covered[k] = 1; });
      left.splice(left.indexOf(best), 1);
      out.push({ observer: candidates[best], coverage: grids[best].coverage, marginal: ground ? bestGain / ground : 0 });
    }
    return out;
  }
}

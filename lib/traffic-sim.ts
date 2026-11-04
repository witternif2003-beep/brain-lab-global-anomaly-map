/**
 * Agent-based traffic SIMULATION along motorway polylines (linear referencing). These are synthetic agents,
 * not observed vehicles: 30% of each line is a deterministic jam zone (80 cars/km at 15 km/h); the rest is
 * free flow (5 cars/km at 100 km/h). When a line carries a TomTom `traffic_level` (current / free-flow speed),
 * the whole line instead runs at NOMINAL_FREE_FLOW_MS × level with density interpolated by jamFactor.
 */
export type LngLat = [number, number];

export const FREE_DENSITY_PER_KM = 5;
export const JAM_DENSITY_PER_KM = 80;
export const FREE_SPEED_MS = 100 / 3.6;
export const JAM_SPEED_MS = 15 / 3.6;
export const JAM_FRACTION = 0.3;
export const MAX_AGENTS_DESKTOP = 4000;
export const MAX_AGENTS_TOUCH = 800;
export const MIN_EDGE_M = 200;
/** TomTom flow lines are tile-clipped and short; keep anything from 10 m and at most the 2,000 longest. */
export const MIN_FLOW_EDGE_M = 10;
export const MAX_FLOW_EDGES = 2000;
/** TomTom relative flow tiles give only the speed ratio, not km/h, so free-flow speed is a nominal 100 km/h. */
export const NOMINAL_FREE_FLOW_MS = FREE_SPEED_MS;
export const CRAWL_SPEED_MS = 5 / 3.6;

/** Per-line flow from TomTom: speed = nominal × level (crawl floor, 0 when closed), density 5→80 /km as jamFactor 0→10. */
export interface LineFlow {
  level: number | null;
  closed?: boolean;
}

export function flowSpeedMs(f: LineFlow): number {
  if (f.closed) return 0;
  const v = typeof f.level === 'number' && Number.isFinite(f.level) ? Math.min(1, Math.max(0, f.level)) : 1;
  return Math.max(CRAWL_SPEED_MS, NOMINAL_FREE_FLOW_MS * v);
}

export function flowDensityPerKm(f: LineFlow): number {
  if (f.closed) return JAM_DENSITY_PER_KM;
  const v = typeof f.level === 'number' && Number.isFinite(f.level) ? Math.min(1, Math.max(0, f.level)) : 1;
  const jf = Math.round(10 * (1 - v));
  return FREE_DENSITY_PER_KM + ((JAM_DENSITY_PER_KM - FREE_DENSITY_PER_KM) * jf) / 10;
}

const R_EARTH = 6_371_008.8;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineM(a: LngLat, b: LngLat): number {
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a[1])) * Math.cos(rad(b[1])) * Math.sin(dLon / 2) ** 2;
  return 2 * R_EARTH * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial great-circle bearing a→b, degrees clockwise from north in [0, 360). */
export function bearingDeg(a: LngLat, b: LngLat): number {
  const y = Math.sin(rad(b[0] - a[0])) * Math.cos(rad(b[1]));
  const x = Math.cos(rad(a[1])) * Math.sin(rad(b[1])) - Math.sin(rad(a[1])) * Math.cos(rad(b[1])) * Math.cos(rad(b[0] - a[0]));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export interface SimEdge {
  coords: LngLat[];
  /** Vertex elevations in metres (0 when unknown). */
  elev: number[];
  /** Cumulative distance to each vertex, metres. */
  cum: number[];
  length: number;
  /** Jam zone starts here and runs JAM_FRACTION × length forward, wrapping past the end. */
  jamStart: number;
  /** Set when the line comes from TomTom flow: one speed for the whole line, no synthetic jam zone. */
  flow?: { speedMs: number; densityPerKm: number };
}

/** Deterministic [0, 1) hash so jam placement is stable across reloads. */
export function unitHash(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function buildEdge(coords: LngLat[], seed: number, elev?: number[], flow?: LineFlow): SimEdge {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversineM(coords[i - 1], coords[i]));
  const length = cum[cum.length - 1] ?? 0;
  const e: SimEdge = { coords, elev: elev ?? coords.map(() => 0), cum, length, jamStart: unitHash(seed) * length };
  if (flow) e.flow = { speedMs: flowSpeedMs(flow), densityPerKm: flowDensityPerKm(flow) };
  return e;
}

function speedAt(e: SimEdge, d: number): number {
  return e.flow ? e.flow.speedMs : inJam(e, d) ? JAM_SPEED_MS : FREE_SPEED_MS;
}

export function inJam(e: SimEdge, d: number): boolean {
  const rel = (((d - e.jamStart) % e.length) + e.length) % e.length;
  return rel < JAM_FRACTION * e.length;
}

/** Position, elevation and bearing at distance `d` metres along the edge (clamped to the line). */
export function positionAt(e: SimEdge, d: number): { position: LngLat; elevM: number; bearing: number } {
  const t = Math.max(0, Math.min(e.length, d));
  let lo = 0;
  let hi = e.cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (e.cum[mid] <= t) lo = mid;
    else hi = mid;
  }
  const a = e.coords[lo];
  const b = e.coords[hi];
  const seg = e.cum[hi] - e.cum[lo];
  const f = seg > 0 ? (t - e.cum[lo]) / seg : 0;
  return {
    position: [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f],
    elevM: e.elev[lo] + (e.elev[hi] - e.elev[lo]) * f,
    bearing: bearingDeg(a, b),
  };
}

export interface CarAgent {
  id: string;
  edgeIndex: number;
  offsetDistance: number;
  speed: number;
  bearing: number;
  position: LngLat;
  elevM: number;
}

export class TrafficSim {
  readonly edges: SimEdge[];
  readonly agents: CarAgent[] = [];

  constructor(lines: LngLat[][], maxAgents = MAX_AGENTS_DESKTOP, elevations?: number[][], flows?: LineFlow[]) {
    this.edges = lines
      .map((c, i) => buildEdge(c, i, elevations?.[i], flows?.[i]))
      .filter((e) => e.coords.length >= 2 && e.length >= (e.flow ? MIN_FLOW_EDGE_M : MIN_EDGE_M));
    const counts = this.edges.map((e) => {
      const km = e.length / 1000;
      if (e.flow) return { jam: 0, free: e.flow.densityPerKm * km };
      return { jam: JAM_DENSITY_PER_KM * km * JAM_FRACTION, free: FREE_DENSITY_PER_KM * km * (1 - JAM_FRACTION) };
    });
    const total = counts.reduce((s, c) => s + c.jam + c.free, 0);
    const k = total > maxAgents ? maxAgents / total : 1;
    this.edges.forEach((e, ei) => {
      const zones: [number, number, number][] = e.flow ? [[Math.floor(counts[ei].free * k), 0, e.length]] : [
        [Math.floor(counts[ei].jam * k), e.jamStart, JAM_FRACTION * e.length],
        [Math.floor(counts[ei].free * k), e.jamStart + JAM_FRACTION * e.length, (1 - JAM_FRACTION) * e.length],
      ];
      for (const [n, start, span] of zones) {
        for (let i = 0; i < n && this.agents.length < maxAgents; i++) {
          const d = (start + ((i + 0.5) / n) * span) % e.length;
          const p = positionAt(e, d);
          this.agents.push({ id: `car-${ei}-${this.agents.length}`, edgeIndex: ei, offsetDistance: d, speed: speedAt(e, d), ...p });
        }
      }
    });
  }

  /** Advance every agent by `deltaMs`; agents wrap to the start of their line and take the speed of their line (TomTom) or zone (synthetic). */
  tick(deltaMs: number): CarAgent[] {
    const dt = Math.max(0, deltaMs) / 1000;
    for (const a of this.agents) {
      const e = this.edges[a.edgeIndex];
      let d = a.offsetDistance + a.speed * dt;
      if (d > e.length) d %= e.length;
      a.offsetDistance = d;
      a.speed = speedAt(e, d);
      const p = positionAt(e, d);
      a.position = p.position;
      a.elevM = p.elevM;
      a.bearing = p.bearing;
    }
    return this.agents;
  }
}

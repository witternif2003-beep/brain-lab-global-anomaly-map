import { Delaunay } from "d3-delaunay";
import { cellToLatLng, gridDisk, latLngToCell } from "h3-js";

const LANCZOS = [
  676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

export function lgamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * z))) - lgamma(1 - z);
  const x0 = z - 1;
  let a = 0.99999999999980993;
  const t = x0 + 7.5;
  LANCZOS.forEach((c, i) => (a += c / (x0 + i + 1)));
  return 0.5 * Math.log(2 * Math.PI) + (x0 + 0.5) * Math.log(t) - t + Math.log(a);
}

function logMarginal(sum: number, n: number, a: number, b: number) {
  return a * Math.log(b) - lgamma(a) + lgamma(a + sum) - (a + sum) * Math.log(b + n);
}

export interface ChangePoint {
  index: number;
  probability: number;
  rateBefore: number;
  rateAfter: number;
}

/** Bayesian single change-point for a Poisson series with conjugate Gamma priors per segment. */
export function bayesianChangePoint(counts: number[], minSegment = 7, priorChange = 0.5): ChangePoint | null {
  const n = counts.length;
  if (n < 2 * minSegment) return null;
  const total = counts.reduce((x, y) => x + y, 0);
  const a = 1;
  const b = n / Math.max(1, total);
  const prefix = [0];
  for (const c of counts) prefix.push(prefix[prefix.length - 1] + c);
  const logNo = logMarginal(total, n, a, b);
  const logs: { i: number; l: number }[] = [];
  for (let i = minSegment; i <= n - minSegment; i++) {
    const s1 = prefix[i];
    logs.push({ i, l: logMarginal(s1, i, a, b) + logMarginal(total - s1, n - i, a, b) });
  }
  const m = Math.max(...logs.map((x) => x.l));
  const z = logs.reduce((acc, x) => acc + Math.exp(x.l - m), 0);
  const logYes = m + Math.log(z / logs.length);
  const best = logs.reduce((p, q) => (q.l > p.l ? q : p));
  const pYes = 1 / (1 + Math.exp(logNo - logYes) * ((1 - priorChange) / priorChange));
  return {
    index: best.i,
    probability: pYes * (Math.exp(best.l - m) / z),
    rateBefore: prefix[best.i] / best.i,
    rateAfter: (total - prefix[best.i]) / (n - best.i),
  };
}

function solve(A: number[][], y: number[]): number[] {
  const n = y.length;
  const M = A.map((row, i) => [...row, y[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

export interface PoissonFit {
  coefficients: number[];
  dispersion: number;
  trendPerWeek: number;
  weekdayRateRatio: number[];
  forecast: { date: string; weekday: number; mean: number; low: number; high: number }[];
}

/** Poisson GLM (log link, IRLS): count ~ intercept + linear trend + day-of-week. */
export function poissonForecast(
  days: { date: string; weekday: number; count: number }[],
  horizon = 7,
): PoissonFit | null {
  const n = days.length;
  if (n < 21) return null;
  const row = (t: number, wd: number) => [1, t / n, ...[1, 2, 3, 4, 5, 6].map((d) => (wd === d ? 1 : 0))];
  const X = days.map((d, t) => row(t, d.weekday));
  const y = days.map((d) => d.count);
  const p = X[0].length;
  const meanY = y.reduce((s, v) => s + v, 0) / n;
  let beta = [Math.log(Math.max(meanY, 1e-3)), ...Array(p - 1).fill(0)];
  for (let it = 0; it < 50; it++) {
    const eta = X.map((x) => x.reduce((s, v, j) => s + v * beta[j], 0));
    const mu = eta.map(Math.exp);
    const H = Array.from({ length: p }, () => Array(p).fill(0));
    const g = Array(p).fill(0);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < p; j++) {
        g[j] += X[i][j] * (y[i] - mu[i]);
        for (let k = 0; k < p; k++) H[j][k] += X[i][j] * X[i][k] * mu[i];
      }
    }
    const step = solve(H, g);
    beta = beta.map((b, j) => b + step[j]);
    if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  const mu = X.map((x) => Math.exp(x.reduce((s, v, j) => s + v * beta[j], 0)));
  const dispersion = y.reduce((s, v, i) => s + (v - mu[i]) ** 2 / mu[i], 0) / Math.max(1, n - p);
  const last = new Date(`${days[n - 1].date}T12:00:00Z`);
  const forecast = Array.from({ length: horizon }, (_, h) => {
    const d = new Date(last.getTime() + (h + 1) * 86_400_000);
    const wd = (days[n - 1].weekday + h + 1) % 7;
    const m = Math.exp(row(n + h, wd).reduce((s, v, j) => s + v * beta[j], 0));
    const sd = Math.sqrt(Math.max(1, dispersion) * m);
    return { date: d.toISOString().slice(0, 10), weekday: wd, mean: m, low: Math.max(0, m - 1.96 * sd), high: m + 1.96 * sd };
  });
  return {
    coefficients: beta,
    dispersion,
    trendPerWeek: Math.exp((beta[1] * 7) / n) - 1,
    weekdayRateRatio: [1, ...beta.slice(2).map(Math.exp)],
    forecast,
  };
}

export interface HotSpot {
  h3: string;
  count: number;
  z: number;
  confidence: 90 | 95 | 99 | 0;
}

/** Getis-Ord Gi* on H3 cells with a first-ring binary neighbourhood (zero-filled). */
export function getisOrd(counts: Map<string, number>, publish: Set<string>): HotSpot[] {
  const area = new Set<string>();
  for (const id of counts.keys()) for (const nb of gridDisk(id, 1)) area.add(nb);
  const n = area.size;
  if (n < 3) return [];
  const x = (id: string) => counts.get(id) ?? 0;
  let sum = 0;
  let sq = 0;
  for (const id of area) {
    sum += x(id);
    sq += x(id) ** 2;
  }
  const mean = sum / n;
  const s = Math.sqrt(sq / n - mean ** 2);
  if (!s) return [];
  const out: HotSpot[] = [];
  for (const id of publish) {
    const ring = gridDisk(id, 1);
    const w = ring.length;
    const local = ring.reduce((acc, nb) => acc + x(nb), 0);
    const z = (local - mean * w) / (s * Math.sqrt((n * w - w * w) / (n - 1)));
    const confidence = z >= 2.576 ? 99 : z >= 1.96 ? 95 : z >= 1.645 ? 90 : 0;
    out.push({ h3: id, count: x(id), z, confidence });
  }
  return out.sort((p, q) => q.z - p.z);
}

export function cellCounts(points: { lat: number; lng: number }[], res: number) {
  const m = new Map<string, number>();
  for (const p of points) {
    const id = latLngToCell(p.lat, p.lng, res);
    m.set(id, (m.get(id) ?? 0) + 1);
  }
  return m;
}

export interface Site {
  name: string;
  lng: number;
  lat: number;
}

/** Voronoi (nearest-site) partition of points among sites, clipped to a bbox. */
export function voronoiCounts(sites: Site[], points: { lat: number; lng: number }[], bbox: [number, number, number, number]) {
  const delaunay = Delaunay.from(sites, (s) => s.lng, (s) => s.lat);
  const vor = delaunay.voronoi(bbox);
  const counts = Array(sites.length).fill(0);
  let i = 0;
  for (const p of points) {
    i = delaunay.find(p.lng, p.lat, i);
    counts[i]++;
  }
  return {
    type: "FeatureCollection" as const,
    features: sites.map((s, j) => ({
      type: "Feature" as const,
      properties: { name: s.name, count: counts[j], share: points.length ? counts[j] / points.length : 0 },
      geometry: { type: "Polygon" as const, coordinates: [vor.cellPolygon(j) as [number, number][]] },
    })),
  };
}

export function cellCentroids(cells: { h3: string; count: number }[]) {
  return {
    type: "FeatureCollection" as const,
    features: cells.map((c) => {
      const [lat, lng] = cellToLatLng(c.h3);
      return { type: "Feature" as const, properties: { count: c.count }, geometry: { type: "Point" as const, coordinates: [lng, lat] } };
    }),
  };
}

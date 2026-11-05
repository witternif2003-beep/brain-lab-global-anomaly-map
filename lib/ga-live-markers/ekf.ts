/**
 * Constant Turn Rate and Velocity (CTRV) Extended Kalman Filter for ADS-B aircraft.
 * State: [east m, north m, speed m/s, heading rad (compass, -PI..PI), turn rate rad/s],
 * in a local tangent plane re-centred on the aircraft after every update.
 */
export const EKF_MAX_HORIZON_S = 30;
export const EKF_STALE_S = 120;
export const MAX_TURN_RATE = 0.12;

const M_PER_DEG = 111_320;
const TWO_PI = 2 * Math.PI;
const N = 5;

export type Vec = number[];
export type Mat = number[][];

export interface EkfMeasurement {
  id: string;
  /** Observation time, epoch ms. */
  t: number;
  lon: number;
  lat: number;
  speedMs: number;
  /** Compass heading in radians (0 = north, clockwise). */
  headingRad: number;
}

export interface EkfState {
  x: Vec;
  P: Mat;
  t: number;
  lon0: number;
  lat0: number;
}

export const SIGMA_POS_M = 25;
const SIGMA_SPEED = 1.5;
const SIGMA_HEADING = (2 * Math.PI) / 180;
const SIGMA_ACCEL = 1.5;
const SIGMA_YAW_ACCEL = 0.02;

export function wrapPi(a: number): number {
  const r = (((a + Math.PI) % TWO_PI) + TWO_PI) % TWO_PI;
  return r - Math.PI;
}

const clampTurn = (w: number) => Math.max(-MAX_TURN_RATE, Math.min(MAX_TURN_RATE, w));

/** CTRV motion model; heading is compass (east = v·sinψ, north = v·cosψ). */
export function ctrvStep(s: Vec, dt: number): Vec {
  const [x, y, v, psi, w] = s;
  if (Math.abs(w) < 1e-6) return [x + v * Math.sin(psi) * dt, y + v * Math.cos(psi) * dt, v, wrapPi(psi + w * dt), w];
  const p2 = psi + w * dt;
  return [x + (v / w) * (Math.cos(psi) - Math.cos(p2)), y + (v / w) * (Math.sin(p2) - Math.sin(psi)), v, wrapPi(p2), w];
}

const STEP = [1, 1, 1e-3, 1e-5, 1e-6];

/** Jacobian of ctrvStep by central finite differences (heading residuals wrapped). */
export function numericJacobian(s: Vec, dt: number): Mat {
  const J: Mat = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  for (let j = 0; j < N; j++) {
    const hi = s.slice();
    const lo = s.slice();
    hi[j] += STEP[j];
    lo[j] -= STEP[j];
    const fh = ctrvStep(hi, dt);
    const fl = ctrvStep(lo, dt);
    for (let i = 0; i < N; i++) {
      const d = i === 3 ? wrapPi(fh[i] - fl[i]) : fh[i] - fl[i];
      J[i][j] = d / (2 * STEP[j]);
    }
  }
  return J;
}

const mul = (A: Mat, B: Mat): Mat => A.map((r) => B[0].map((_, j) => r.reduce((s, a, k) => s + a * B[k][j], 0)));
const tr = (A: Mat): Mat => A[0].map((_, j) => A.map((r) => r[j]));
const add = (A: Mat, B: Mat): Mat => A.map((r, i) => r.map((a, j) => a + B[i][j]));
const diag = (d: number[]): Mat => d.map((v, i) => d.map((_, j) => (i === j ? v : 0)));

export function invert(A: Mat): Mat {
  const n = A.length;
  const M = A.map((r, i) => [...r, ...r.map((_, j) => (i === j ? 1 : 0))]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    if (Math.abs(M[p][c]) < 1e-12) throw new Error('singular matrix');
    [M[c], M[p]] = [M[p], M[c]];
    const d = M[c][c];
    for (let k = 0; k < 2 * n; k++) M[c][k] /= d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c];
      if (f) for (let k = 0; k < 2 * n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((r) => r.slice(n));
}

function processNoise(dt: number): Mat {
  const a = SIGMA_ACCEL;
  const w = SIGMA_YAW_ACCEL;
  return diag([(0.5 * a * dt * dt) ** 2 + 1, (0.5 * a * dt * dt) ** 2 + 1, (a * dt) ** 2, (0.5 * w * dt * dt) ** 2 + 1e-6, (w * dt) ** 2]);
}

const R = diag([SIGMA_POS_M ** 2, SIGMA_POS_M ** 2, SIGMA_SPEED ** 2, SIGMA_HEADING ** 2]);

export function toLocal(lon: number, lat: number, lon0: number, lat0: number): [number, number] {
  return [(lon - lon0) * M_PER_DEG * Math.cos((lat0 * Math.PI) / 180), (lat - lat0) * M_PER_DEG];
}

export function toLngLat(x: number, y: number, lon0: number, lat0: number): [number, number] {
  return [lon0 + x / (M_PER_DEG * Math.cos((lat0 * Math.PI) / 180)), lat0 + y / M_PER_DEG];
}

export function initState(m: EkfMeasurement): EkfState {
  return {
    x: [0, 0, m.speedMs, wrapPi(m.headingRad), 0],
    P: diag([SIGMA_POS_M ** 2, SIGMA_POS_M ** 2, SIGMA_SPEED ** 2, SIGMA_HEADING ** 2, 0.03 ** 2]),
    t: m.t,
    lon0: m.lon,
    lat0: m.lat,
  };
}

export function predictState(s: EkfState, dt: number): { x: Vec; P: Mat } {
  const F = numericJacobian(s.x, dt);
  const x = ctrvStep(s.x, dt);
  x[4] = clampTurn(x[4]);
  return { x, P: add(mul(mul(F, s.P), tr(F)), processNoise(dt)) };
}

/** Predict to the measurement time, then fuse position, speed and heading. Duplicate or older fixes are ignored. */
export function updateState(s: EkfState, m: EkfMeasurement): EkfState {
  const dt = (m.t - s.t) / 1000;
  if (!(dt > 0)) return s;
  if (dt > EKF_STALE_S) return initState(m);
  const { x, P } = predictState(s, dt);
  const [zx, zy] = toLocal(m.lon, m.lat, s.lon0, s.lat0);
  const resid = [zx - x[0], zy - x[1], m.speedMs - x[2], wrapPi(m.headingRad - x[3])];
  const S = add(P.slice(0, 4).map((r) => r.slice(0, 4)), R);
  const K = mul(P.map((r) => r.slice(0, 4)), invert(S));
  const nx = x.map((v, i) => v + K[i].reduce((acc, k, j) => acc + k * resid[j], 0));
  nx[3] = wrapPi(nx[3]);
  nx[4] = clampTurn(nx[4]);
  const IKH = diag([1, 1, 1, 1, 1]).map((r, i) => r.map((v, j) => v - (j < 4 ? K[i][j] : 0)));
  const nP = mul(IKH, P);
  const [lon0, lat0] = toLngLat(nx[0], nx[1], s.lon0, s.lat0);
  return { x: [0, 0, nx[2], nx[3], nx[4]], P: nP, t: m.t, lon0, lat0 };
}

/** Position at epoch ms `t`, extrapolated along the CTRV arc and capped at EKF_MAX_HORIZON_S. */
export function predictLngLat(s: EkfState, t: number): [number, number] {
  const dt = Math.min(EKF_MAX_HORIZON_S, Math.max(0, (t - s.t) / 1000));
  const p = ctrvStep(s.x, dt);
  return toLngLat(p[0], p[1], s.lon0, s.lat0);
}

/** Straight-line fallback (the previous dead-reckoning behaviour). */
export function straightLngLat(m: EkfMeasurement, t: number): [number, number] {
  const dt = Math.min(EKF_MAX_HORIZON_S, Math.max(0, (t - m.t) / 1000));
  return toLngLat(m.speedMs * Math.sin(m.headingRad) * dt, m.speedMs * Math.cos(m.headingRad) * dt, m.lon, m.lat);
}

export class EkfTracker {
  private readonly tracks = new Map<string, EkfState>();

  /** Fuse a full ADS-B snapshot; tracks absent from it are dropped. */
  ingest(batch: readonly EkfMeasurement[]): void {
    const seen = new Set<string>();
    for (const m of batch) {
      if (![m.t, m.lon, m.lat, m.speedMs, m.headingRad].every(Number.isFinite)) continue;
      seen.add(m.id);
      const s = this.tracks.get(m.id);
      try {
        this.tracks.set(m.id, s ? updateState(s, m) : initState(m));
      } catch {
        this.tracks.set(m.id, initState(m));
      }
    }
    for (const id of this.tracks.keys()) if (!seen.has(id)) this.tracks.delete(id);
  }

  predict(t: number): Record<string, [number, number]> {
    const out: Record<string, [number, number]> = {};
    for (const [id, s] of this.tracks) out[id] = predictLngLat(s, t);
    return out;
  }

  state(id: string): EkfState | undefined {
    return this.tracks.get(id);
  }

  get size(): number {
    return this.tracks.size;
  }
}

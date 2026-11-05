import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { EKF_MAX_HORIZON_S, EkfTracker, predictLngLat, straightLngLat, toLngLat, toLocal, wrapPi, type EkfMeasurement } from '../../lib/ga-live-markers/ekf';

const LON0 = -84.39;
const LAT0 = 33.75;
const T0 = Date.UTC(2026, 0, 1);
const meters = (a: [number, number], b: [number, number]) => Math.hypot(...toLocal(a[0], a[1], b[0], b[1]));

function fix(id: string, s: number, x: number, y: number, v: number, hdg: number): EkfMeasurement {
  const [lon, lat] = toLngLat(x, y, LON0, LAT0);
  return { id, t: T0 + s * 1000, lon, lat, speedMs: v, headingRad: wrapPi(hdg) };
}

/** Seeded LCG + Box–Muller so the noise test is deterministic. */
function gaussian(seed: number) {
  let s = seed >>> 0;
  const u = () => ((s = (1664525 * s + 1013904223) >>> 0) + 1) / 4294967297;
  return () => Math.sqrt(-2 * Math.log(u())) * Math.cos(2 * Math.PI * u());
}

test('wrapPi keeps headings in [-PI, PI)', () => {
  assert.ok(Math.abs(wrapPi(3 * Math.PI) - -Math.PI) < 1e-9);
  assert.ok(Math.abs(wrapPi((359 * Math.PI) / 180) - (-1 * Math.PI) / 180) < 1e-9);
  assert.ok(Math.abs(wrapPi(-Math.PI / 2) + Math.PI / 2) < 1e-12);
});

test('straight-line track: prediction matches constant-velocity truth', () => {
  const tr = new EkfTracker();
  for (let s = 0; s <= 10; s++) tr.ingest([fix('a', s, 100 * s, 0, 100, Math.PI / 2)]);
  const p = predictLngLat(tr.state('a')!, T0 + 20_000);
  const truth = toLngLat(2000, 0, LON0, LAT0);
  assert.ok(meters(p, truth) < 20, `error ${meters(p, truth)} m`);
});

test('curved track: CTRV beats straight-line extrapolation on a standard-rate turn', () => {
  const v = 100;
  const w = (3 * Math.PI) / 180;
  const r = v / w;
  const at = (s: number): [number, number, number] => {
    const psi = w * s;
    return [r * (1 - Math.cos(psi)), r * Math.sin(psi), psi];
  };
  const tr = new EkfTracker();
  let last!: EkfMeasurement;
  for (let s = 0; s <= 20; s++) {
    const [x, y, psi] = at(s);
    last = fix('c', s, x, y, v, psi);
    tr.ingest([last]);
  }
  const [tx, ty] = at(30);
  const truth = toLngLat(tx, ty, LON0, LAT0);
  const ekfErr = meters(predictLngLat(tr.state('c')!, T0 + 30_000), truth);
  const lineErr = meters(straightLngLat(last, T0 + 30_000), truth);
  assert.ok(ekfErr < lineErr / 3, `ekf ${ekfErr.toFixed(1)} m vs straight ${lineErr.toFixed(1)} m`);
});

test('heading wraparound: 355° → 3° track stays northbound', () => {
  const tr = new EkfTracker();
  const hdgs = [355, 357, 359, 1, 3];
  let x = 0;
  let y = 0;
  hdgs.forEach((d, s) => {
    const h = (d * Math.PI) / 180;
    if (s) {
      x += 100 * Math.sin(h);
      y += 100 * Math.cos(h);
    }
    tr.ingest([fix('w', s, x, y, 100, h)]);
  });
  const st = tr.state('w')!;
  assert.ok(Math.abs(st.x[3]) < (10 * Math.PI) / 180, `heading ${(st.x[3] * 180) / Math.PI}°`);
  assert.ok(st.x[4] > 0, 'turn rate should be positive (clockwise)');
  const [, lat] = predictLngLat(st, T0 + 14_000);
  assert.ok(lat > st.lat0);
});

test('noise attenuation: filtered positions are closer to truth than raw 25 m-noise fixes', () => {
  const n = gaussian(42);
  const tr = new EkfTracker();
  let raw = 0;
  let filt = 0;
  const N = 60;
  for (let s = 0; s < N; s++) {
    const tx = 120 * s;
    const ex = 25 * n();
    const ey = 25 * n();
    tr.ingest([fix('n', s, tx + ex, ey, 120 + 1.5 * n(), Math.PI / 2 + 0.03 * n())]);
    if (s < 10) continue;
    const truth = toLngLat(tx, 0, LON0, LAT0);
    raw += Math.hypot(ex, ey);
    const st = tr.state('n')!;
    filt += meters([st.lon0, st.lat0], truth);
  }
  assert.ok(filt < raw * 0.7, `filtered ${(filt / (N - 10)).toFixed(1)} m vs raw ${(raw / (N - 10)).toFixed(1)} m`);
});

test('prediction horizon is capped at 30 s', () => {
  const tr = new EkfTracker();
  tr.ingest([fix('h', 0, 0, 0, 200, 0)]);
  const st = tr.state('h')!;
  assert.deepEqual(predictLngLat(st, T0 + 120_000), predictLngLat(st, T0 + EKF_MAX_HORIZON_S * 1000));
});

test('tracker drops aircraft missing from the latest snapshot and ignores duplicate fixes', () => {
  const tr = new EkfTracker();
  tr.ingest([fix('a', 0, 0, 0, 100, 0), fix('b', 0, 0, 0, 100, 0)]);
  const before = tr.state('a');
  tr.ingest([fix('a', 0, 0, 0, 100, 0)]);
  assert.equal(tr.size, 1);
  assert.equal(tr.state('a'), before);
});

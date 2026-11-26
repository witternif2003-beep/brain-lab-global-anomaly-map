import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoofModel, fitPlane, fitRoofPlanes, roofPoints, ROOF_FIT_MIN_POINTS, type RoofPoints } from '../../lib/ga-buildings/lidar-roofs';
import type { LidarNodeData } from '../../lib/ga-lidar/ept';

const square = (h: number) => Float64Array.from([-h, -h, h, -h, h, h, -h, h]);

function grid(f: (x: number, y: number) => number, half = 6, step = 0.7, noise = 0.05): RoofPoints {
  const xs: number[] = [], ys: number[] = [], zs: number[] = [];
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 2 * noise;
  for (let x = -half + 0.2; x < half; x += step) for (let y = -half + 0.2; y < half; y += step) {
    xs.push(x);
    ys.push(y);
    zs.push(f(x, y) + rnd());
  }
  return { x: Float64Array.from(xs), y: Float64Array.from(ys), z: Float64Array.from(zs) };
}

test('least squares recovers an exact plane', () => {
  const p = grid((x, y) => 0.5 * x - 0.25 * y + 7, 6, 1, 0);
  const pl = fitPlane(p, Array.from({ length: p.x.length }, (_, i) => i));
  assert.ok(pl);
  assert.ok(Math.abs(pl.a - 0.5) < 1e-6 && Math.abs(pl.b + 0.25) < 1e-6 && Math.abs(pl.c - 7) < 1e-6);
});

test('a flat roof is one level plane at its measured height', () => {
  const m = buildRoofModel(square(6), grid(() => 9));
  assert.ok(m);
  assert.equal(m.kind, 'flat');
  assert.equal(m.planes, 1);
  assert.ok(Math.abs(m.ridgeM - 9) < 0.15 && Math.abs(m.eaveM - 9) < 0.15);
  assert.ok(m.rmsM < 0.1);
});

test('a gabled roof yields two sloped planes, eaves low and ridge high', () => {
  const m = buildRoofModel(square(6), grid((x) => 9 - 0.5 * Math.abs(x)));
  assert.ok(m);
  assert.equal(m.kind, 'gabled');
  assert.ok(m.ridgeM > 8.5 && m.ridgeM <= 9.2, `ridge ${m.ridgeM}`);
  assert.ok(m.eaveM < 6.5 && m.eaveM > 5.5, `eave ${m.eaveM}`);
  assert.ok(m.rmsM < 0.2, `rms ${m.rmsM}`);
  assert.equal(m.indices.length % 3, 0);
  assert.ok(Math.max(...m.indices) < m.positions.length / 3);
});

test('a hipped roof yields more than two planes', () => {
  const m = buildRoofModel(square(6), grid((x, y) => 10 - 0.6 * Math.max(Math.abs(x), Math.abs(y))));
  assert.ok(m);
  assert.equal(m.kind, 'multi-plane');
  assert.ok(m.planes >= 4);
});

test('scattered returns (trees, noise) are rejected instead of drawn', () => {
  let s = 3;
  const rnd = () => (s = (s * 48271) % 2147483647) / 2147483647;
  const p = grid(() => 0);
  for (let i = 0; i < p.z.length; i++) p.z[i] = 3 + rnd() * 12;
  assert.equal(buildRoofModel(square(6), p), null);
});

test('too few returns give no roof rather than a guess', () => {
  const p = grid(() => 8, 2, 1);
  assert.ok(p.x.length < ROOF_FIT_MIN_POINTS);
  assert.equal(buildRoofModel(square(2), p), null);
});

test('RANSAC is deterministic for a given seed', () => {
  const p = grid((x) => 9 - 0.5 * Math.abs(x));
  assert.deepEqual(fitRoofPlanes(p, 5).label, fitRoofPlanes(p, 5).label);
});

test('roofPoints keeps building returns inside the footprint and drops vegetation and ground', () => {
  const pts = [
    { x: 50, y: 50, h: 8, cls: 6 },
    { x: 51, y: 50, h: 8, cls: 1 },
    { x: 50, y: 51, h: 15, cls: 5 },
    { x: 52, y: 52, h: 0.5, cls: 2 },
    { x: 90, y: 90, h: 8, cls: 6 },
  ];
  const node: LidarNodeData = {
    count: pts.length, minX: 0, minY: 0, width: 100, groundZ: 0,
    x: Float32Array.from(pts.map((p) => p.x)), y: Float32Array.from(pts.map((p) => p.y)),
    hag: Float32Array.from(pts.map((p) => p.h)), cls: Uint8Array.from(pts.map((p) => p.cls)), intensity: new Uint8Array(pts.length),
  };
  const ring = { xy: Float64Array.from([45, 45, 55, 45, 55, 55, 45, 55, 45, 45]) };
  const r = roofPoints(ring, [node], 50, 50);
  assert.equal(r.x.length, 2);
  assert.deepEqual([...r.z], [8, 8]);
  assert.deepEqual([r.x[0], r.y[0]], [0, 0]);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureRing, percentile, pointInRing, ringFromCoordinates, MIN_POINTS } from '../../lib/ga-buildings/lidar-heights';
import type { LidarNodeData } from '../../lib/ga-lidar/ept';

const square = (half: number) => ({ xy: new Float64Array([-half, -half, half, -half, half, half, -half, half, -half, -half]) });

function node(points: { x: number; y: number; h: number; cls: number }[]): LidarNodeData {
  return {
    count: points.length,
    minX: 0,
    minY: 0,
    width: 100,
    groundZ: 0,
    x: Float32Array.from(points.map((p) => p.x)),
    y: Float32Array.from(points.map((p) => p.y)),
    hag: Float32Array.from(points.map((p) => p.h)),
    cls: Uint8Array.from(points.map((p) => p.cls)),
    intensity: new Uint8Array(points.length),
  };
}

test('a point inside the footprint is found and one outside is not', () => {
  assert.equal(pointInRing(square(10), 0, 0), true);
  assert.equal(pointInRing(square(10), 11, 0), false);
});

test('percentile picks the ranked value, not the maximum', () => {
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 100], 0.95), 100);
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 100], 0.5), 11);
});

test('roof height comes from the 95th percentile of returns inside the footprint', () => {
  const pts = Array.from({ length: 20 }, (_, i) => ({ x: 0, y: 0, h: i < 19 ? 12 : 30, cls: 6 }));
  const m = measureRing(square(5), [node(pts)]);
  assert.ok(m);
  assert.equal(m.points, 20);
  assert.equal(m.heightM, 12);
});

test('vegetation returns and returns outside the footprint are ignored', () => {
  const trees = Array.from({ length: 30 }, () => ({ x: 0, y: 0, h: 25, cls: 5 }));
  assert.equal(measureRing(square(5), [node(trees)]), null);
  const outside = Array.from({ length: 30 }, () => ({ x: 50, y: 50, h: 25, cls: 6 }));
  assert.equal(measureRing(square(5), [node(outside)]), null);
});

test('too few returns give no measured height rather than a guess', () => {
  const few = Array.from({ length: MIN_POINTS - 1 }, () => ({ x: 0, y: 0, h: 9, cls: 6 }));
  assert.equal(measureRing(square(5), [node(few)]), null);
});

test('footprint rings convert from lng/lat to EPSG:3857 metres', () => {
  const r = ringFromCoordinates([[-84.388, 33.749], [-84.387, 33.749], [-84.387, 33.75], [-84.388, 33.749]]);
  assert.equal(r.xy.length, 8);
  assert.ok(Math.abs(r.xy[0] - -9393000) < 3000);
});

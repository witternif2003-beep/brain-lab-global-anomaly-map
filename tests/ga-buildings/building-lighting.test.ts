import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convexHull, lightSun, propertyHeightM, shadowOffsetM, shadowRing, SHADOW_MAX_RATIO } from '../../lib/ga-buildings/building-lighting';
import { BUILDING_LIGHT } from '../../lib/ga-sky';

test('building light is the fixed afternoon sun: south, 25° up, intensity 0.8', () => {
  assert.deepEqual(BUILDING_LIGHT.position, [1.5, 180, 65]);
  assert.equal(BUILDING_LIGHT.intensity, 0.8);
  assert.deepEqual(lightSun(), { azimuthDeg: 180, elevationDeg: 25 });
});

test('shadow points away from the sun with length h / tan(elevation)', () => {
  const [e, n] = shadowOffsetM(30, 180, 45)!; // sun due south → shadow due north
  assert.ok(Math.abs(e) < 1e-9);
  assert.ok(Math.abs(n - 30) < 1e-9);
  const [e2] = shadowOffsetM(10, 90, 45)!; // sun in the east → shadow west
  assert.ok(Math.abs(e2 + 10) < 1e-9);
  assert.equal(shadowOffsetM(10, 90, 1), null);
  const [, n3] = shadowOffsetM(10, 180, 3)!;
  assert.ok(Math.abs(n3 - 10 * SHADOW_MAX_RATIO) < 1e-9);
});

test('convex hull is closed and drops interior points', () => {
  const h = convexHull([[0, 0], [1, 0], [1, 1], [0, 1], [0.5, 0.5]]);
  assert.equal(h.length, 5);
  assert.deepEqual(h[0], h[4]);
  assert.ok(!h.some(([x, y]) => x === 0.5 && y === 0.5));
});

test('shadow ring covers the footprint and the shifted roof', () => {
  const sq: [number, number][] = [[-84.39, 33.75], [-84.3899, 33.75], [-84.3899, 33.7501], [-84.39, 33.7501], [-84.39, 33.75]];
  const r = shadowRing(sq, 50, 180, 45)!;
  const maxLat = Math.max(...r.map((p) => p[1]));
  assert.ok(Math.abs(maxLat - (33.7501 + 50 / 110540)) < 1e-9);
  assert.ok(Math.min(...r.map((p) => p[1])) <= 33.75);
});

test('height falls back from height to floors × 3.2 m to 5 m', () => {
  assert.equal(propertyHeightM({ height: 41 }), 41);
  assert.ok(Math.abs(propertyHeightM({ num_floors: 10 }) - 32) < 1e-9);
  assert.equal(propertyHeightM({}), 5);
});

import { heightRampColor } from '../../lib/ga-lidar/ept';
test('LiDAR height ramp runs blue → green → orange', () => {
  assert.deepEqual(heightRampColor(0), [0, 85, 255]);
  assert.deepEqual(heightRampColor(15), [0, 255, 85]);
  assert.deepEqual(heightRampColor(60), [255, 170, 0]);
});

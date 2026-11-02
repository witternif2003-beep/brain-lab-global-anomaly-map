import { test } from 'node:test';
import assert from 'node:assert/strict';
import { latLngToCell } from 'h3-js';
import { drillDown } from '../../lib/geo/h3-drilldown';

// Deterministic LCG so the fixtures are reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}
const uniform = (n: number, seed: number) => {
  const r = rng(seed);
  return Array.from({ length: n }, () => ({ lat: 31 + r() * 3.5, lng: -85 + r() * 3.5 }));
};

test('flat data yields no hotspots', () => {
  const res = drillDown(uniform(20_000, 1));
  assert.deepEqual(res.hotspots, []);
});

test('a planted cluster is localised at the finest resolution', () => {
  const r = rng(2);
  const cluster = Array.from({ length: 400 }, () => ({ lat: 33.7490 + (r() - 0.5) * 0.004, lng: -84.3880 + (r() - 0.5) * 0.004 }));
  const res = drillDown([...uniform(20_000, 3), ...cluster]);
  assert.ok(res.hotspots.length >= 1);
  assert.equal(res.hotspots[0].resolution, 8);
  assert.equal(res.hotspots[0].h3, latLngToCell(33.749, -84.388, 8));
  assert.ok(res.evaluations < res.flatEvaluations, `${res.evaluations} vs ${res.flatEvaluations}`);
});

test('cells below the k floor are never reported', () => {
  const tiny = Array.from({ length: 4 }, () => ({ lat: 33.749, lng: -84.388 }));
  assert.deepEqual(drillDown(tiny, { resolutions: [8], zThreshold: 0, minCount: 5 }).hotspots, []);
});

test('rejects non-increasing resolutions', () => {
  assert.throws(() => drillDown([], { resolutions: [7, 5], zThreshold: 3, minCount: 5 }));
});

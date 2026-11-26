import { test } from "node:test";
import assert from "node:assert/strict";
import { dropletPositions, fallSpeed, mpConcentration, mpLambda, sampleDiameter, seedDroplets } from "../lib/ga-precip/droplets";

test("Marshall-Palmer: Λ = 4.1 R^-0.21; N_T = N0/Λ", () => {
  assert.ok(Math.abs(mpLambda(1) - 4.1) < 1e-9);
  assert.ok(Math.abs(mpConcentration(1) - 8000 / 4.1) < 1e-6);
  assert.ok(mpConcentration(25) > mpConcentration(1));
});

test("diameters stay in 0.5-6 mm and fall speeds follow the Atlas et al. fit", () => {
  for (const u of [0, 0.5, 0.999]) { const d = sampleDiameter(5, u); assert.ok(d >= 0.5 && d <= 6); }
  assert.ok(Math.abs(fallSpeed(2, "rain") - (9.65 - 10.3 * Math.exp(-1.2))) < 1e-9);
  assert.equal(fallSpeed(2, "snow"), 1);
});

test("drops are seeded only inside the view and fall within their column", () => {
  const cells = [{ west: 0, south: 0, east: 1, north: 1, rateMmH: 5, phase: "rain" as const, baseM: 1000 }, { west: 5, south: 5, east: 6, north: 6, rateMmH: 5, phase: "rain" as const, baseM: 1000 }];
  const d = seedDroplets(cells, { west: -1, south: -1, east: 2, north: 2 }, 100, () => 10, () => 0.5);
  assert.equal(d.n, 100);
  for (let i = 0; i < d.n; i++) assert.ok(d.lng[i] >= 0 && d.lng[i] <= 1);
  const src = new Float32Array(300), dst = new Float32Array(300);
  dropletPositions(d, 37, 20, 1.5, src, dst);
  for (let i = 0; i < d.n; i++) { assert.ok(dst[i * 3 + 2] >= 10 && dst[i * 3 + 2] <= 10 + 1000 * 1.5 + 1e-3); assert.ok(src[i * 3 + 2] > dst[i * 3 + 2]); }
  assert.equal(seedDroplets(cells, { west: 10, south: 10, east: 11, north: 11 }, 100, () => 0).n, 0);
});

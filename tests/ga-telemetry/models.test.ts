import assert from "node:assert/strict";
import test from "node:test";
import { latLngToCell, gridDisk } from "h3-js";
import { bayesianChangePoint, getisOrd, lgamma, poissonForecast, voronoiCounts } from "../../lib/ga-telemetry/models";

test("lgamma matches log factorial", () => {
  assert.ok(Math.abs(lgamma(6) - Math.log(120)) < 1e-9);
  assert.ok(Math.abs(lgamma(0.5) - Math.log(Math.sqrt(Math.PI))) < 1e-9);
});

test("change-point finds a step from 10/day to 30/day", () => {
  const series = [...Array(20).fill(10), ...Array(20).fill(30)];
  const cp = bayesianChangePoint(series)!;
  assert.equal(cp.index, 20);
  assert.ok(cp.probability > 0.9);
  assert.equal(cp.rateBefore, 10);
  assert.equal(cp.rateAfter, 30);
});

test("flat series has low change probability", () => {
  const cp = bayesianChangePoint(Array(40).fill(12))!;
  assert.ok(cp.probability < 0.2);
});

test("poisson regression recovers weekday effect", () => {
  const days = Array.from({ length: 56 }, (_, i) => ({ date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`, weekday: i % 7, count: i % 7 === 5 ? 40 : 20 }));
  const fit = poissonForecast(days)!;
  assert.ok(Math.abs(fit.weekdayRateRatio[5] - 2) < 1e-6);
  assert.ok(Math.abs(fit.trendPerWeek) < 1e-6);
  assert.equal(fit.forecast.length, 7);
  const fri = fit.forecast.find((f) => f.weekday === 5)!;
  assert.ok(Math.abs(fri.mean - 40) < 1e-4);
});

test("Gi* flags the dense cluster as a hot spot", () => {
  const centre = latLngToCell(33.749, -84.388, 8);
  const counts = new Map<string, number>();
  for (const id of gridDisk(centre, 1)) counts.set(id, 50);
  for (const id of gridDisk(latLngToCell(33.85, -84.36, 8), 6)) if (!counts.has(id)) counts.set(id, 1);
  const hs = getisOrd(counts, new Set([centre]));
  assert.equal(hs[0].h3, centre);
  assert.equal(hs[0].confidence, 99);
});

test("voronoi assigns points to nearest site", () => {
  const fc = voronoiCounts(
    [{ name: "W", lng: -84.45, lat: 33.75 }, { name: "E", lng: -84.33, lat: 33.75 }],
    [{ lng: -84.44, lat: 33.75 }, { lng: -84.46, lat: 33.76 }, { lng: -84.32, lat: 33.74 }],
    [-84.6, 33.6, -84.2, 33.9],
  );
  assert.deepEqual(fc.features.map((f) => f.properties.count), [2, 1]);
});

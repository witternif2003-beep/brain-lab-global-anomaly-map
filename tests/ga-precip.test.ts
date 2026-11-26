import { test } from "node:test";
import assert from "node:assert/strict";
import { precipCells, precipColor, rateBand, PRECIP_FLAGS } from "../lib/ga-precip/precip-cells";
import type { MrmsGrid } from "../lib/ga-clouds/mrms";

const grid = (values: number[], width = 4): MrmsGrid => ({ time: "2026-11-25T23:14:00Z", width, height: values.length / width, lat0: 34.995, lng0: -85.695, stepDeg: 0.01, values: Float32Array.from(values) });

test("NOAA flag table: rain, snow and hail phases; -3/0 are not precipitation", () => {
  assert.equal(PRECIP_FLAGS[3].phase, "snow");
  assert.equal(PRECIP_FLAGS[7].phase, "hail");
  assert.equal(PRECIP_FLAGS[1].phase, "rain");
  assert.equal(PRECIP_FLAGS[-3], undefined);
  assert.equal(PRECIP_FLAGS[0], undefined);
});

test("rate bands by lower bound", () => {
  assert.equal(rateBand(0.05), -1);
  assert.equal(rateBand(0.1), 0);
  assert.equal(rateBand(3), 1);
  assert.equal(rateBand(60), 4);
});

test("cells merge along a row by flag and band, keep max rate and 1-h total, and sit on the MRMS grid", () => {
  // 2 rows x 4 cols, factor 1: row 0 = rain, rain, snow, none; row 1 = no coverage everywhere
  const flag = grid([1, 1, 3, 0, -3, -3, -3, -3]);
  const rate = grid([1.2, 2.0, 0.8, 0, -3, -3, -3, -3]);
  const qpe = grid([0.5, 1.5, 0.2, 0, -3, -3, -3, -3]);
  const { geojson, summary } = precipCells(flag, rate, qpe, 1);
  assert.equal(geojson.features.length, 2);
  const [rain, snow] = geojson.features;
  assert.equal(rain.properties!.phase, "rain");
  assert.equal(rain.properties!.rateMmH, 2);
  assert.equal(rain.properties!.qpe1hMm, 1.5);
  assert.equal(rain.properties!.cells, 2);
  assert.equal(snow.properties!.phase, "snow");
  const ring = rain.geometry.coordinates[0];
  assert.ok(Math.abs(ring[0][0] - -85.7) < 1e-9 && Math.abs(ring[0][1] - 35.0) < 1e-9);
  assert.ok(Math.abs(ring[1][0] - -85.68) < 1e-9);
  assert.deepEqual(summary.byPhase, { rain: 2, snow: 1, hail: 0 });
  assert.equal(summary.peakRateMmH, 2);
});

test("mismatched grids are rejected", () => {
  assert.throws(() => precipCells(grid([1, 1, 1, 1]), grid([1, 1, 1, 1, 1, 1, 1, 1]), null, 1));
});

test("deck palette matches the fill stops and alpha rises with rate", () => {
  assert.deepEqual(precipColor("rain", 0.1), [0x7d, 0xd3, 0xfc, 0x8c]);
  assert.deepEqual(precipColor("rain", 50).slice(0, 3), [0xdc, 0x26, 0x26]);
  assert.ok(precipColor("rain", 50)[3] > precipColor("rain", 0.1)[3]);
  assert.deepEqual(precipColor("snow", 0.1).slice(0, 3), [0xee, 0xf2, 0xff]);
});

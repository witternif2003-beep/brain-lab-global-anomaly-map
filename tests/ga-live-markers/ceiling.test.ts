import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { LIVE_FEED_LAYERS, LIVE_POINT_CEILING, liveCeiling } from "../../lib/ga-live-markers/ceiling";

test("ceiling is 30,000 and counts only layers that refresh while the map is open", () => {
  assert.equal(LIVE_POINT_CEILING, 30_000);
  for (const fixed of ["signals", "towers", "police", "firestations", "sirens", "speedcams", "alpr", "equipment", "policetech"]) {
    assert.ok(!(LIVE_FEED_LAYERS as readonly string[]).includes(fixed), fixed);
  }
  assert.equal(LIVE_FEED_LAYERS.length, 13);
});

test("sums loaded layers, lists unloaded or failed layers as missing instead of 0", () => {
  const c = liveCeiling({ aircraft: 444, micromobility: 5465, athens911: 5042, transit: null });
  assert.equal(c.total, 10_951);
  assert.equal(c.pct, 36.5);
  assert.deepEqual(c.parts.map((p) => p.layer), ["micromobility", "athens911", "aircraft"]);
  assert.ok(c.missing.includes("transit"));
  assert.ok(c.missing.includes("stations"));
  assert.equal(c.missing.length, 10);
});

test("the map reports the ceiling row and never drops points to fit it", () => {
  const src = readFileSync(new URL("../../lib/ga-live-markers-layer.ts", import.meta.url), "utf8");
  assert.match(src, /id: 'live-ceiling'/);
  assert.match(src, /none are dropped to fit the ceiling/);
  assert.doesNotMatch(src, /\.slice\(0, LIVE_POINT_CEILING\)/);
});

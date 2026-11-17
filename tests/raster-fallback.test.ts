import test from "node:test";
import assert from "node:assert/strict";
import { fallbackTiles } from "../lib/map/raster-fallback";

test("fallback covers the view with tiles around the centre", () => {
  const t = fallbackTiles({ lng: -84.388, lat: 33.749, zoom: 12, width: 430, height: 800 });
  assert.ok(t.length > 0);
  assert.ok(t.every((x) => x.url.includes("/tile/13/")));
  assert.ok(t.some((x) => x.left <= 215 && x.left + x.size >= 215 && x.top <= 400 && x.top + x.size >= 400));
  assert.ok(Math.min(...t.map((x) => x.left)) <= 0 && Math.max(...t.map((x) => x.left + x.size)) >= 430);
  assert.ok(Math.min(...t.map((x) => x.top)) <= 0 && Math.max(...t.map((x) => x.top + x.size)) >= 800);
});

test("Atlanta at zoom 12 lands on the known z13 tile", () => {
  // z13 tile for 33.749, -84.388 is x=2175, y=3279 (standard slippy-map formula).
  const t = fallbackTiles({ lng: -84.388, lat: 33.749, zoom: 12, width: 2, height: 2 });
  assert.equal(t.length, 1);
  assert.match(t[0].url, /\/tile\/13\/3279\/2175$/);
});

test("bad view yields no tiles", () => {
  assert.deepEqual(fallbackTiles({ lng: NaN, lat: 0, zoom: 3, width: 100, height: 100 }), []);
  assert.deepEqual(fallbackTiles({ lng: 0, lat: 0, zoom: 3, width: 0, height: 100 }), []);
});

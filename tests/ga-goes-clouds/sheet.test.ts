import { test } from "node:test";
import assert from "node:assert/strict";
import { latOfMercY, mercY, sheetAltitudeM, sheetBox, sheetCovers, SHEET_DEFAULT_BASE_M } from "../../lib/ga-goes-clouds/sheet";

test("sheetBox sizes the image at the native pixel size", () => {
  const b = sheetBox({ lng: -84, lat: 33 }, { w: -85, s: 32.5, e: -83, n: 33.5 }, 0.5);
  // 2° of longitude at 33°N ≈ 186.8 km → ≈ 374 native 0.5 km pixels.
  assert.ok(Math.abs(b.width - 374) <= 3, `width ${b.width}`);
  assert.ok(Math.abs(b.height - 222) <= 3, `height ${b.height}`);
  assert.equal(b.grid, 2);
});

test("sheetBox clips a pitched view's horizon to ±3° and caps the image", () => {
  const b = sheetBox({ lng: -84, lat: 33 }, { w: -100, s: 20, e: -70, n: 50 }, 0.5);
  assert.equal(b.s, 30);
  assert.equal(b.n, 36);
  assert.ok(b.e - b.w < 7.2);
  assert.ok(b.width <= 2048 && b.height <= 2048);
  assert.equal(b.grid, 6);
});

test("sheetCovers", () => {
  assert.ok(sheetCovers({ w: -86, s: 31, e: -82, n: 35 }, { w: -85, s: 32, e: -83, n: 34 }));
  assert.ok(!sheetCovers({ w: -86, s: 31, e: -82, n: 35 }, { w: -87, s: 32, e: -83, n: 34 }));
});

test("sheetAltitudeM takes the median base, clamps, defaults", () => {
  assert.equal(sheetAltitudeM([]), SHEET_DEFAULT_BASE_M);
  assert.equal(sheetAltitudeM([900, 1200, 4000]), 1200);
  assert.equal(sheetAltitudeM([800, 1000]), 900);
  assert.equal(sheetAltitudeM([30, 60, NaN]), 600);
  assert.equal(sheetAltitudeM([9000]), 3000);
});

test("mercator round trip", () => {
  assert.ok(Math.abs(latOfMercY(mercY(33.75)) - 33.75) < 1e-9);
});

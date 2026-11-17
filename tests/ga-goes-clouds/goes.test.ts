import { test } from "node:test";
import assert from "node:assert/strict";
import { GOES_BANDS, cloudAlphaInPlace, goesTileUrl, latestScanTimes, sunGainFor, tileBbox3857 } from "../../lib/ga-goes-clouds/goes";

test("tileBbox3857 covers the world at z0 and splits at z1", () => {
  const w = 20_037_508.342789244;
  tileBbox3857(0, 0, 0).forEach((v, i) => assert.ok(Math.abs(v - [-w, -w, w, w][i]) < 1e-6));
  tileBbox3857(1, 1, 0).forEach((v, i) => assert.ok(Math.abs(v - [0, 0, w, w][i]) < 1e-6));
});

test("goesTileUrl asks nowCOAST WMS for one 256 px EPSG:3857 tile at a fixed scan time", () => {
  const u = new URL(goesTileUrl("vis", 7, 34, 51, "2026-10-31T14:03:00Z"));
  assert.equal(u.origin + u.pathname, "https://nowcoast.noaa.gov/geoserver/satellite/wms");
  assert.equal(u.searchParams.get("layers"), "goes_visible_imagery");
  assert.equal(u.searchParams.get("crs"), "EPSG:3857");
  assert.equal(u.searchParams.get("time"), "2026-10-31T14:03:00Z");
  assert.equal(u.searchParams.get("bbox")?.split(",").length, 4);
});

test("latestScanTimes reads each layer's time-dimension default", () => {
  const xml = `<Layer><Name>goes_longwave_imagery</Name><Title>x</Title><Dimension name="time" default="2026-10-31T14:03:00Z" units="ISO8601">a,b</Dimension></Layer>
    <Layer><Name>goes_visible_imagery</Name><Dimension name="time" default="2026-10-31T14:08:00Z">c</Dimension></Layer>`;
  assert.deepEqual(latestScanTimes(xml), { goes_longwave_imagery: "2026-10-31T14:03:00Z", goes_visible_imagery: "2026-10-31T14:08:00Z" });
});

test("cloudAlphaInPlace makes dark ground transparent and bright cloud opaque white", () => {
  const px = new Uint8ClampedArray([45, 45, 45, 255, 200, 200, 200, 255, 140, 140, 140, 255]);
  const frac = cloudAlphaInPlace(px, GOES_BANDS.vis);
  assert.equal(px[3], 0);
  assert.equal(px[7], 255);
  assert.ok(px[11] > 0 && px[11] < 255);
  assert.ok(Math.abs(frac - 2 / 3) < 1e-9);
  assert.equal(sunGainFor(90), 1);
  assert.equal(sunGainFor(-5), 5);
});

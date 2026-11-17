import { test } from "node:test";
import assert from "node:assert/strict";
import { belowIntervals, subsolarPoint, sunAltitudeDeg, twilightGeoJSON } from "../../lib/terminator/solar";

const near = (a: number, b: number, tol: number) => assert.ok(Math.abs(a - b) <= tol, `${a} not within ${tol} of ${b}`);

test("declination is ~0 at the March 2024 equinox and ~23.44 at the June 2024 solstice", () => {
  near(subsolarPoint(new Date("2024-03-20T03:06:00Z")).declinationDeg, 0, 0.05);
  near(subsolarPoint(new Date("2024-06-20T20:51:00Z")).declinationDeg, 23.44, 0.02);
});

test("subsolar longitude at 12:00 UTC reflects the equation of time", () => {
  // Equation of time on 2024-11-03 is about +16.4 min, so the sun is ~4.1° west of Greenwich at 12:00 UTC.
  near(subsolarPoint(new Date("2024-11-03T12:00:00Z")).longitudeDeg, -4.1, 0.2);
  // Around 2024-02-11 it is about -14.2 min: ~3.55° east.
  near(subsolarPoint(new Date("2024-02-11T12:00:00Z")).longitudeDeg, 3.55, 0.2);
});

test("altitude is 90° at the subsolar point and -90° at the antisolar point", () => {
  const sun = subsolarPoint(new Date("2026-10-15T15:00:00Z"));
  near(sunAltitudeDeg(sun, sun.longitudeDeg, sun.declinationDeg), 90, 1e-6);
  near(sunAltitudeDeg(sun, sun.longitudeDeg + 180, -sun.declinationDeg), -90, 1e-6);
});

test("below-horizon intervals match direct altitude checks", () => {
  const sun = subsolarPoint(new Date("2026-12-21T00:00:00Z"));
  for (const lng of [-170, -84.4, 0, 45, 120]) {
    const iv = belowIntervals(sun, lng, -6);
    for (let lat = -89; lat <= 89; lat += 7) {
      const inside = iv.some(([lo, hi]) => lat > lo + 0.2 && lat < hi - 0.2);
      const outside = iv.every(([lo, hi]) => lat < lo - 0.2 || lat > hi + 0.2);
      const alt = sunAltitudeDeg(sun, lng, lat);
      if (inside) assert.ok(alt < -6, `lng ${lng} lat ${lat} alt ${alt}`);
      if (outside) assert.ok(alt >= -6, `lng ${lng} lat ${lat} alt ${alt}`);
    }
  }
});

test("twilight polygons cover each meridian once per night interval and close their rings", () => {
  const fc = twilightGeoJSON(new Date("2026-10-15T15:00:00Z"), 2);
  const bands = new Set(fc.features.map((f) => f.properties?.band));
  assert.deepEqual([...bands], ["sunset", "civil", "nautical", "astronomical"]);
  for (const f of fc.features) {
    const ring = f.geometry.coordinates[0];
    assert.deepEqual(ring[0], ring[ring.length - 1]);
  }
  assert.ok(fc.features.filter((f) => f.properties?.band === "sunset").length >= 180);
});

test("night shade ramps smoothly and its slices tile each meridian without gaps or overlap", async () => {
  const { SHADE_EDGES, SHADE_MAX_OPACITY, nightShadeGeoJSON, shadeOpacity, sliceIntervals } = await import("../../lib/terminator/solar");
  assert.equal(shadeOpacity(5), 0);
  assert.equal(shadeOpacity(-30), SHADE_MAX_OPACITY);
  for (let a = 0.8; a > -18; a -= 0.5) assert.ok(shadeOpacity(a - 0.5) >= shadeOpacity(a));
  const sun = subsolarPoint(new Date("2026-10-16T13:00:00Z"));
  for (const lng of [-170, -84.4, 0, 69, 150]) {
    const ivs = sliceIntervals(sun, lng, SHADE_EDGES).flat().sort((x, y) => x[0] - y[0]);
    for (let i = 1; i < ivs.length; i++) {
      const gap = ivs[i][0] - ivs[i - 1][1];
      if (Math.abs(gap) > 1e-9) {
        const mid = (ivs[i - 1][1] + ivs[i][0]) / 2;
        assert.ok(sunAltitudeDeg(sun, lng, mid) >= SHADE_EDGES[0] - 1e-6, `lng ${lng}: gap at ${mid}`);
      }
      assert.ok(gap > -1e-9, `lng ${lng}: overlap at ${ivs[i][0]}`);
    }
  }
  const fc = nightShadeGeoJSON(new Date("2026-10-16T13:00:00Z"));
  const ops = new Set(fc.features.map((f) => f.properties?.opacity));
  assert.ok(ops.size >= 15, `only ${ops.size} shade steps`);
});

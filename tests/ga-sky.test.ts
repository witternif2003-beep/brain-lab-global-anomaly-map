import test from "node:test";
import assert from "node:assert/strict";
import { skyFor, skyPhase, sunElevationDeg } from "../lib/ga-sky";

const ATL = [33.749, -84.388] as const;

test("sun elevation tracks noon and midnight over Atlanta", () => {
  const noon = sunElevationDeg(new Date("2026-06-21T17:39:00Z"), ...ATL);
  assert.ok(noon > 78 && noon < 80, `${noon}`);
  assert.ok(sunElevationDeg(new Date("2026-06-22T05:40:00Z"), ...ATL) < -30);
  const dec = sunElevationDeg(new Date("2026-12-21T17:30:00Z"), ...ATL);
  assert.ok(dec > 32 && dec < 33.5, `${dec}`);
});

// USNO 2026-03-20, 33.749 N 84.388 W: begin civil twilight 11:16 UTC (−6°), sunrise 11:41 UTC (−0.833° incl. refraction).
test("matches USNO sunrise and civil-twilight times, and names twilight phases", () => {
  const rise = sunElevationDeg(new Date("2026-03-20T11:41:00Z"), ...ATL);
  const civil = sunElevationDeg(new Date("2026-03-20T11:16:00Z"), ...ATL);
  assert.ok(Math.abs(rise + 0.833) < 0.1, `${rise}`);
  assert.ok(Math.abs(civil + 6) < 0.1, `${civil}`);
  assert.deepEqual([10, 3, -3, -9, -15, -25].map(skyPhase), ["day", "golden", "civil", "nautical", "astronomical", "night"]);
});

test("night sky is transparent so stars show; day sky is opaque blue", () => {
  assert.match(String(skyFor(-30)["sky-color"]), /,0\.000\)$/);
  const day = String(skyFor(45)["sky-color"]);
  assert.match(day, /,1\.000\)$/);
  const [r, , b] = day.match(/\d+/g)!.map(Number);
  assert.ok(b > r);
});

// NOAA Solar Calculator (gml.noaa.gov/grad/solcalc) refraction model: ~0.48° at the horizon, ~0.16° at 5°, 0 above 85°.
test("NOAA refraction, sun azimuth and sun-driven 3D light", async () => {
  const { refractionDeg, apparentElevationDeg, sunAzimuthDeg, lightFor } = await import("../lib/ga-sky");
  assert.ok(Math.abs(refractionDeg(0) - 1735 / 3600) < 1e-9);
  assert.ok(Math.abs(refractionDeg(5) - 0.16) < 0.01);
  assert.equal(refractionDeg(89), 0);
  assert.ok(apparentElevationDeg(-0.833) > -0.5 && apparentElevationDeg(-0.833) < 0);
  // Equinox over Atlanta: sun rises near due east, is due south at solar noon (12:00 + 84.388°/15 h − ~7.5 min equation of time ≈ 17:45 UTC), sets near due west.
  const riseAz = sunAzimuthDeg(new Date("2026-03-20T11:41:00Z"), ...ATL);
  assert.ok(Math.abs(riseAz - 90) < 2, `${riseAz}`);
  const noonAz = sunAzimuthDeg(new Date("2026-03-20T17:45:00Z"), ...ATL);
  assert.ok(Math.abs(noonAz - 180) < 1.5, `${noonAz}`);
  const setAz = sunAzimuthDeg(new Date("2026-03-20T23:55:00Z"), ...ATL);
  assert.ok(setAz > 265 && setAz < 275, `${setAz}`);
  const noon = lightFor(56, 180);
  assert.deepEqual(noon.position, [1.5, 180, 34]);
  assert.equal(noon.anchor, "map");
  const dusk = lightFor(1, 270);
  assert.match(String(dusk.color), /^#ff/);
  assert.ok(Number(lightFor(-30, 0).intensity) < Number(noon.intensity));
});

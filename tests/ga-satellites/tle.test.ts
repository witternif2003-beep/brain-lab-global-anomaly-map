import { test } from "node:test";
import assert from "node:assert/strict";
import { twoline2satrec } from "satellite.js";
import { dedupeByNorad, elevationDeg, fromSatnogs, parseTle, subPoint, tleEpoch } from "../../lib/ga-satellites/tle";

const L1 = "1 25544U 98067A   26277.07866052  .00003472  00000-0  71811-4 0  9996";
const L2 = "2 25544  51.6316 121.2001 0006887 219.9512 140.0970 15.48727366588639";

test("parses three-line TLE text and skips junk lines", () => {
  const out = parseTle(`ISS (ZARYA)\n${L1}\n${L2}\nstray line\nISS DUP\n${L1}\n${L2}\n`, "Space stations");
  assert.equal(out.length, 2);
  assert.equal(out[0].name, "ISS (ZARYA)");
  assert.equal(out[0].norad, 25544);
  assert.equal(out[0].group, "Space stations");
  assert.equal(dedupeByNorad(out).length, 1);
});

test("decodes the TLE epoch", () => {
  assert.equal(tleEpoch(L1).slice(0, 16), "2026-10-04T01:53");
  assert.equal(tleEpoch("1 00005U 58002B   99001.50000000").slice(0, 13), "1999-01-01T12");
});

test("maps SatNOGS rows", () => {
  const out = fromSatnogs([{ tle0: "0 ISS (ZARYA)", tle1: L1, tle2: L2 }, { tle0: "bad", tle1: "x", tle2: "y" }], "SatNOGS");
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "ISS (ZARYA)");
});

test("SGP4 sub-point for the ISS is in LEO and within its inclination", () => {
  const p = subPoint(twoline2satrec(L1, L2), new Date("2026-10-04T03:00:00Z"));
  assert.ok(p);
  assert.ok(p.altKm > 380 && p.altKm < 450, `alt ${p.altKm}`);
  assert.ok(Math.abs(p.lat) <= 51.7);
  assert.ok(p.lon >= -180 && p.lon <= 180);
  assert.ok(p.speedKmS > 7.5 && p.speedKmS < 7.8, `speed ${p.speedKmS}`);
});

test("elevation from central Georgia is bounded and matches the sub-point geometry", () => {
  const sr = twoline2satrec(L1, L2);
  for (let m = 0; m < 95; m += 5) {
    const t = new Date(Date.parse("2026-10-04T03:00:00Z") + m * 60_000);
    const e = elevationDeg(sr, t);
    const p = subPoint(sr, t);
    assert.ok(e !== null && p);
    assert.ok(e >= -90 && e <= 90);
    const far = Math.hypot(p.lat - 32.68, (p.lon + 83.22) * Math.cos((32.68 * Math.PI) / 180)) > 40;
    if (far) assert.ok(e < 0, `ISS ${e}° elevation while ${p.lat},${p.lon}`);
  }
});

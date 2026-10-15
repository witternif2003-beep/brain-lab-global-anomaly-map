import { test } from "node:test";
import assert from "node:assert/strict";
import { auroraGeojson, currentScales, flareMagnitude, latestKp, solarWind, summarizeDonki } from "../../lib/space-weather/normalize";

test("aurora grid keeps points at or above the threshold and wraps longitude", () => {
  const fc = auroraGeojson({ coordinates: [[0, 65, 2], [270, 60, 12], [10, 70, 3]] });
  assert.deepEqual(fc.features.map((f) => f.geometry.coordinates), [[-90, 60], [10, 70]]);
  assert.equal(fc.features[0].properties?.p, 12);
});

test("latest Kp is the last valid row", () => {
  assert.deepEqual(latestKp([{ time_tag: "2026-10-15T09:00:00", Kp: 2 }, { time_tag: "2026-10-15T12:00:00", Kp: 3.33 }]), { kp: 3.33, time: "2026-10-15T12:00:00Z" });
  assert.equal(latestKp("bad"), null);
});

test("NOAA scales read the current R/S/G levels", () => {
  const s = currentScales({ "0": { DateStamp: "2026-10-15", TimeStamp: "13:30:00", R: { Scale: "1" }, S: { Scale: "0" }, G: { Scale: null } } });
  assert.deepEqual(s, { R: "R1", S: "S0", G: "G0", time: "2026-10-15T13:30:00Z" });
});

test("solar wind prefers the active spacecraft row", () => {
  const w = solarWind(
    [{ time_tag: "2026-10-15T13:29:00", active: false, source: "ACE", proton_speed: 498 }, { time_tag: "2026-10-15T13:29:00", active: true, source: "DSCOVR", proton_speed: 512.5, proton_density: 2.1 }],
    [{ time_tag: "2026-10-15T13:29:00", active: true, source: "SOLAR1", bt: 5.22, bz_gsm: -1.69 }],
  );
  assert.deepEqual(w, { speedKmS: 512.5, densityCm3: 2.1, btNt: 5.22, bzNt: -1.69, time: "2026-10-15T13:29:00Z", source: "DSCOVR / SOLAR1" });
});

test("flare classes order by letter then magnitude", () => {
  assert.ok(flareMagnitude("X1.0") > flareMagnitude("M9.9"));
  assert.ok(flareMagnitude("M6.7") > flareMagnitude("M2"));
  assert.equal(flareMagnitude("?"), -1);
});

test("DONKI summary picks the strongest flare, fastest CME and strongest storm", () => {
  const s = summarizeDonki(
    [{ classType: "C3.1" }, { classType: "M6.7", activeRegionNum: 14549, link: "f" }],
    [{ startTime: "a", cmeAnalyses: [{ speed: 450 }] }, { startTime: "b", cmeAnalyses: [{ speed: 1200 }, { speed: null }] }],
    [{ startTime: "g", allKpIndex: [{ kpIndex: 7 }, { kpIndex: 6.67 }] }],
  );
  assert.equal(s.strongestFlare?.class, "M6.7");
  assert.equal(s.fastestCme?.speedKmS, 1200);
  assert.equal(s.strongestStorm?.maxKp, 7);
  assert.deepEqual([s.flares, s.cmes, s.storms], [2, 2, 1]);
});

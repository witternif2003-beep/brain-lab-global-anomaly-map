import { test } from "node:test";
import assert from "node:assert/strict";
import { buildCounts, flowStyle, levelFor, localToIso, roadName, type TadaSite, type TadaSnapshot } from "../../lib/ga-traffic-counts/normalize";

const site = (o: Partial<TadaSite> = {}): TadaSite => ({
  id: "A", node: "GDOT_CCS", name: "121-5502", description: "I-85 N of Pleasantdale Rd, ATL(SB-VOL)", isDisabled: false,
  speedLimit: 29058, bearing: 200, location: { lat: 33.9, lng: -84.2 }, parameters: { tz: "US/Eastern", county: "DeKalb" }, ...o,
});
const snap = (o: Partial<TadaSnapshot> = {}): TadaSnapshot => ({
  siteId: "A", interval: 900, startTime: "2026-10-19 09:15:00", endTime: "2026-10-19 10:15:00",
  total: { count: [3000, 3100, 3200, 3414], normalCount: [3900, 3900, 3950, 3950], avgSpeed: [29000, 20000, 15000, 14207], countStatus: ["OK", "OK", "OK", "OK"] },
  byDirection: [{ direction: 4, count: [1, 2, 3, 3414], avgSpeed: [0, 0, 0, 14207] }],
  byChannel: [{ direction: 4, bearing: 205, name: "Ln 1 SB" }],
  ...o,
});

test("converts US/Eastern wall time to UTC across DST", () => {
  assert.equal(localToIso("2026-10-19 10:15:00"), "2026-10-19T14:15:00.000Z");
  assert.equal(localToIso("2026-12-01 10:15:00"), "2026-12-01T15:15:00.000Z");
  assert.equal(localToIso("bad"), null);
});

test("levels, road names and flow geometry follow measured values", () => {
  assert.equal(levelFor(0).id, "light");
  assert.equal(levelFor(1000).id, "busy");
  assert.equal(levelFor(13656).id, "very-heavy");
  assert.equal(roadName("I-85 N of Pleasantdale Rd"), "I-85");
  assert.equal(roadName("SR169 btwn Wayne Co Line & SR 121"), "SR169");
  assert.equal(flowStyle({ direction: "S", bearing: 0, count: 1, vph: 4, avgMph: null }).durationS, null);
  assert.ok((flowStyle({ direction: "S", bearing: 0, count: 900, vph: 3600, avgMph: 64 }).durationS ?? 9) < (flowStyle({ direction: "S", bearing: 0, count: 900, vph: 3600, avgMph: 20 }).durationS ?? 0));
});

test("builds station features from the newest measured bin only", () => {
  const now = Date.parse("2026-10-19T14:20:00Z");
  const out = buildCounts(
    [site(), site({ id: "B", location: { lat: 31.8, lng: -82.1 } }), site({ id: "P", node: "GDOT_PORTABLES" })],
    [snap(), snap({ siteId: "B", total: { count: [], countStatus: [] } }), snap({ siteId: "P" })],
    now,
  );
  assert.equal(out.stations.features.length, 1);
  const p = out.stations.features[0].properties;
  assert.equal(p.binStart, "2026-10-19T14:00:00.000Z");
  assert.equal(p.binEnd, "2026-10-19T14:15:00.000Z");
  assert.equal(p.count, 3414);
  assert.equal(p.vph, 13656);
  assert.equal(p.pctOfNormal, 86);
  assert.equal(p.avgMph, 32);
  assert.equal(p.limitMph, 65);
  assert.equal(p.slowed, true);
  assert.equal(p.status, "OK");
  assert.deepEqual(p.directions, [{ direction: "S", bearing: 205, count: 3414, vph: 13656, avgMph: 32 }]);
  assert.equal(out.summary.noCurrentCount, 1);
  assert.equal(out.summary.sitesListed, 2);
  assert.equal(out.summary.latestBinEnd, "2026-10-19T14:15:00.000Z");
  const stale = buildCounts([site()], [snap()], now + 3_600_000).stations.features[0].properties;
  assert.equal(stale.status, "stale");
});

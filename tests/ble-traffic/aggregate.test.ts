import { test } from "node:test";
import assert from "node:assert/strict";
import { latLngToCell } from "h3-js";
import { BLE_H3_RES, binSites, bleGauges, buildPayload, diffFeatures, linkFeatures, type LinkFeature, type SiteFeature } from "../../lib/ble-traffic/aggregate";

const site = (SiteId: number, lng: number, lat: number, ProbeCount: number, IntervalStart = "2026-10-17T20:05:00+11:00"): SiteFeature => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties: { SiteId, Name: `SITE ${SiteId}`, IntervalStart, ProbeCount },
});

const link = (Id: number, o: Partial<LinkFeature["properties"]> = {}): LinkFeature => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates: [[149.123456789, -35.2], [149.13, -35.21]] },
  properties: { Id, Name: "Northbourne Av", Direction: "N", Length: 1000, MinTT: 60, IntervalStart: "2026-10-17T20:10:30+11:00", TT: 80, Delay: 20, Speed: 45, Congestion: 0, Score: 0, EnoughData: true, Closed: false, ...o },
});

test("sums sites in the same H3 cell and withholds cells under k = 3", () => {
  const r = binSites([site(1, 149.13, -35.28, 2), site(2, 149.13001, -35.28001, 2), site(3, 149.2, -35.4, 2), site(4, 149.3, -35.5, 0)]);
  assert.equal(r.bins.length, 1);
  assert.equal(r.bins[0].bin_id, latLngToCell(-35.28, 149.13, BLE_H3_RES));
  assert.equal(r.bins[0].count, 4);
  assert.equal(r.bins[0].sites, 2);
  assert.ok(r.bins[0].density > 0);
  assert.equal(r.bins[0].last_updated, "2026-10-17T09:05:00.000Z");
  assert.deepEqual([r.suppressedBins, r.suppressedDevices], [2, 2]);
});

test("published bins carry no site names or ids", () => {
  const r = binSites([site(7, 149.13, -35.28, 9)]);
  assert.deepEqual(Object.keys(r.bins[0]).sort(), ["bin_id", "count", "density", "last_updated", "sites"]);
});

test("skips malformed sites", () => {
  const bad = { ...site(1, 149.13, -35.28, 5), geometry: { type: "Point" as const, coordinates: [] } };
  assert.equal(binSites([bad, site(2, 149.13, -35.28, Number.NaN)]).bins.length, 0);
});

test("links without enough matched devices get no speed instead of a made-up one", () => {
  const fc = linkFeatures([link(1), link(2, { EnoughData: false, Speed: -1, TT: -1 })]);
  assert.equal(fc.features[0].id, 1);
  assert.equal(fc.features[0].properties.speedKmh, 45);
  assert.deepEqual(fc.features[0].geometry.coordinates[0], [149.12346, -35.2]);
  assert.equal(fc.features[1].properties.speedKmh, null);
  assert.equal(fc.features[1].properties.travelTimeS, null);
});

test("payload reports source lag from the newest interval and link coverage", () => {
  const now = Date.parse("2026-10-17T09:11:30Z");
  const p = buildPayload([site(1, 149.13, -35.28, 5)], [link(1), link(2, { EnoughData: false }), link(3, { Closed: true })], now);
  assert.equal(p.sourceUpdatedAt, "2026-10-17T09:10:30.000Z");
  assert.equal(p.sourceLagSeconds, 60);
  assert.deepEqual(p.links, { total: 3, reporting: 2, insufficientData: 1, closed: 1 });
  assert.equal(p.binFeatures.features[0].id, p.bins[0].bin_id);
  const ring = p.binFeatures.features[0].geometry.coordinates[0];
  assert.deepEqual(ring[0], ring[ring.length - 1]);
});

test("diff adds new, updates changed properties only, removes missing", () => {
  const a = { type: "Feature" as const, id: "a", geometry: { type: "Point" as const, coordinates: [0, 0] }, properties: { count: 3, sites: 1 } };
  const b = { ...a, id: "b" };
  const prev = new Map([["a", a], ["b", b]] as const);
  const d = diffFeatures(prev, [{ ...a, properties: { count: 5, sites: 1 } }, { ...a, id: "c" }]);
  assert.deepEqual(d.remove, ["b"]);
  assert.deepEqual(d.add?.map((f) => f.id), ["c"]);
  assert.deepEqual(d.update, [{ id: "a", addOrUpdateProperties: [{ key: "count", value: 5 }] }]);
  assert.equal(d.size, 3);
  assert.equal(diffFeatures(new Map([["a", a]]), [a]).size, 0);
});

test("gauges mark the source down and leave values empty when the probe fails", () => {
  const g = bleGauges(null);
  assert.equal(g.find((x) => x.name === "ble_source_up")?.values[0].value, 0);
  assert.equal(g.find((x) => x.name === "ble_source_lag_seconds")?.values[0].value, null);
});

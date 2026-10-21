import { test } from "node:test";
import assert from "node:assert/strict";
import { aisTimeMs, parseAisStream, type AisStreamMessage } from "../../lib/ga-live-markers/parse";

const NOW = Date.parse("2026-10-21T14:20:00Z");
const pos = (mmsi: number, type: string, time: string, lat: number, lon: number, r: Record<string, number | boolean> = {}): AisStreamMessage => ({
  MessageType: type,
  MetaData: { MMSI: mmsi, ShipName: `SHIP ${mmsi}   `, latitude: lat, longitude: lon, time_utc: `${time} +0000 UTC` },
  Message: { [type]: { Sog: 12.3, Cog: 270, TrueHeading: 268, NavigationalStatus: 0, Valid: true, ...r } },
});

test("aisTimeMs reads aisstream.io nanosecond timestamps", () => {
  assert.equal(aisTimeMs("2026-10-21 14:13:25.445923921 +0000 UTC"), Date.parse("2026-10-21T14:13:25.445Z"));
  assert.equal(aisTimeMs("garbage"), null);
});

test("keeps the newest position per vessel inside Georgia and never returns MMSI", () => {
  const ms = parseAisStream([
    pos(1, "PositionReport", "2026-10-21 14:10:00.0", 32.08, -81.09),
    pos(1, "PositionReport", "2026-10-21 14:15:00.0", 32.09, -81.08),
    pos(2, "PositionReport", "2026-10-21 14:15:00.0", 32.0, -80.5),
  ], NOW);
  assert.equal(ms.length, 1);
  assert.deepEqual([ms[0].lat, ms[0].lon, ms[0].label, ms[0].observedAt], [32.09, -81.08, "SHIP 1", "2026-10-21T14:15:00.000Z"]);
  assert.ok(!JSON.stringify(ms).includes('"mmsi"') && !Object.values(ms[0].props).includes(1));
});

test("Class B craft get no name, stale and unavailable values are dropped", () => {
  const ms = parseAisStream([
    pos(3, "StandardClassBPositionReport", "2026-10-21 14:19:00.0", 31.15, -81.49, { Sog: 102.3, Cog: 360, TrueHeading: 511 }),
    pos(4, "PositionReport", "2026-10-21 13:50:00.0", 31.15, -81.49),
    pos(5, "PositionReport", "2026-10-21 14:19:00.0", 31.15, -81.49, { Valid: false }),
    { MessageType: "ShipStaticData", MetaData: { MMSI: 6, latitude: 31.1, longitude: -81.4, time_utc: "2026-10-21 14:19:00.0 +0000 UTC" } },
  ], NOW);
  assert.equal(ms.length, 1);
  assert.equal(ms[0].label, "small craft");
  assert.deepEqual(ms[0].props, { aisClass: "B", sogKt: null, cog: null, heading: null, navStatus: null });
});

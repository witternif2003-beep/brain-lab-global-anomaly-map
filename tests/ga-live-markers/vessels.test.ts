import { test } from "node:test";
import assert from "node:assert/strict";
import { aisTimeMs, mergeVessels, parseAisStream, type AisStreamMessage, type LiveMarker } from "../../lib/ga-live-markers/parse";

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

test("vesselId adds an opaque vid, never the MMSI", () => {
  const [m] = parseAisStream([pos(366999001, "PositionReport", "2026-10-21 14:19:00.0", 32.08, -81.09)], NOW, (n) => `v${n % 7}`);
  assert.equal(m.props.vid, `v${366999001 % 7}`);
  assert.ok(!Object.values(m.props).includes(366999001) && !JSON.stringify(m.props).includes("366999001"));
});

test("mergeVessels keeps vessels missing from a refresh until they are 15 min old, newest position wins", () => {
  const mk = (vid: string | null, t: string, lat = 31.1): LiveMarker => ({ lon: -81.5, lat, observedAt: t, label: "x", props: vid ? { vid } : {} });
  const prev = [mk("a", "2026-10-21T14:10:00Z"), mk("b", "2026-10-21T14:04:00Z"), mk("c", "2026-10-21T14:12:00Z", 31.0), mk(null, "2026-10-21T14:15:00Z")];
  const next = [mk("c", "2026-10-21T14:19:00Z", 31.2), mk(null, "2026-10-21T14:19:30Z")];
  const out = mergeVessels(prev, next, NOW);
  assert.deepEqual(out.map((m) => [m.props.vid ?? null, m.lat]).sort(), [["a", 31.1], ["c", 31.2], [null, 31.1]].sort());
  assert.equal(out.find((m) => !m.props.vid)?.observedAt, "2026-10-21T14:19:30Z");
});

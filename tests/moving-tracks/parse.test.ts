import { test } from "node:test";
import assert from "node:assert/strict";
import { capTracks, hexList, isUsRegistered, movingGauges, parseAdsbLolTiles, parseDigitrafficAis, parseDigitrafficTrains, parseOpenSkyStates, tileCentres, type MovingSourceStatus, type MovingTracksPayload, type MovingTrack } from "../../lib/moving-tracks/parse";

const NOW = 1_792_000_000;
const state = (hex: string, o: Partial<Record<number, unknown>> = {}): unknown[] => {
  const s: unknown[] = [hex, "DLH4AB  ", "Germany", NOW - 5, NOW - 2, 8.5, 50.1, 10000, false, 230, 90, 0, null, 10100, null, false, 0];
  for (const [k, v] of Object.entries(o)) s[Number(k)] = v;
  return s;
};

test("OpenSky keeps airborne moving aircraft and publishes no ICAO hex", () => {
  const r = parseOpenSkyStates({ time: NOW, states: [state("3c6444"), state("3c6445", { 8: true }), state("3c6446", { 9: 3 }), state("3c6447", { 3: NOW - 600 }), state("3c6448", { 5: null })] }, { hexes: new Set() });
  assert.equal(r.received, 5);
  assert.equal(r.tracks.length, 1);
  const t = r.tracks[0];
  assert.deepEqual([t.kind, t.label, t.course, t.altFt, t.at], ["aircraft", "DLH4AB", 90, 32808, (NOW - 5) * 1000]);
  assert.ok(Math.abs(t.speedKt - 447.1) < 0.1);
  assert.ok(!JSON.stringify(t).includes("3c6444"));
});

test("LADD/PIA aircraft are removed; without the lists every US-registered aircraft is removed", () => {
  const states = [state("a1b2c3"), state("a4ffff"), state("3c6444")];
  const listed = parseOpenSkyStates({ time: NOW, states }, { hexes: new Set(["a1b2c3"]) });
  assert.deepEqual([listed.tracks.length, listed.removedPrivacy], [2, 1]);
  const none = parseOpenSkyStates({ time: NOW, states }, { hexes: null });
  assert.deepEqual([none.tracks.length, none.removedPrivacy], [1, 2]);
  assert.equal(isUsRegistered("adf7c7"), true);
  assert.equal(isUsRegistered("c00001"), false);
  assert.deepEqual(hexList({ ac: [{ hex: "~A1B2C3" }, {}] }), ["a1b2c3"]);
});

test("AIS keeps vessels at 0.5 kt or more, drops the 102.3 'not available' speed and unnames pleasure craft", () => {
  const nowMs = NOW * 1000;
  const f = (mmsi: number, sog: number, cog = 120) => ({ geometry: { coordinates: [24.9, 60.1] }, properties: { mmsi, sog, cog, timestampExternal: nowMs - 30_000 } });
  const r = parseDigitrafficAis({ features: [f(1, 12.3), f(2, 0.2), f(3, 102.3), f(4, 6, 360)] }, [{ mmsi: 1, name: "FINLANDIA ", shipType: 60 }, { mmsi: 4, name: "MY YACHT", shipType: 37 }], nowMs);
  assert.deepEqual(r.tracks.map((t) => [t.label, t.course]), [["FINLANDIA", 120], ["pleasure craft", null]]);
  assert.ok(!JSON.stringify(r.tracks).includes("mmsi"));
});

test("trains need a positive speed and a fresh fix", () => {
  const nowMs = Date.parse("2026-10-17T23:50:00Z");
  const t = (n: number, speed: number, ts = "2026-10-17T23:49:30Z") => ({ location: { coordinates: [23.4, 63.8] }, speed, trainNumber: n, timestamp: ts });
  const r = parseDigitrafficTrains([t(1, 139), t(2, 0), t(3, 80, "2026-10-17T23:00:00Z")], nowMs);
  assert.deepEqual(r.tracks.map((x) => x.label), ["Train 1"]);
  assert.ok(Math.abs(r.tracks[0].speedKt - 75.1) < 0.1);
  assert.equal(parseDigitrafficTrains({ not: "an array" }, nowMs).tracks.length, 0);
});

const tr = (kind: MovingTrack["kind"], at: number): MovingTrack => ({ kind, lon: 0.1, lat: 0.1, course: null, speedKt: 1, altFt: null, label: "x", at, source: "s" });

test("the 50,000 ceiling is shared by source size and keeps the newest fixes", () => {
  const air = Array.from({ length: 80 }, (_, i) => tr("aircraft", i));
  const sea = Array.from({ length: 20 }, (_, i) => tr("vessel", i));
  const r = capTracks([air, sea], 50);
  assert.equal(r.tracks.length, 50);
  assert.equal(r.truncated, 50);
  assert.equal(r.tracks.filter((t) => t.kind === "aircraft").length, 40);
  assert.equal(Math.min(...r.tracks.filter((t) => t.kind === "aircraft").map((t) => t.at)), 40);
  assert.deepEqual(capTracks([air.slice(0, 3)], 50), { tracks: air.slice(0, 3), truncated: 0 });
});

test("gauges report nothing invented when the route is down", () => {
  const g = movingGauges(null);
  assert.ok(g.every((x) => x.values.every((v) => v.value === null)));
});

test("adsb.lol tiles: dedupe by hex, drop PIA/LADD, ground and slow aircraft, publish no hex", () => {
  const now = NOW * 1000;
  const a = { hex: "abc123", flight: "DAL1 ", lat: 33.6, lon: -84.4, alt_baro: 30000, gs: 450, track: 90, seen_pos: 1 };
  const r = parseAdsbLolTiles(
    [
      { now, ac: [a, { ...a, hex: "a00001", dbFlags: 8 }, { ...a, hex: "a00002", alt_baro: "ground" as const }, { ...a, hex: "a00003", gs: 5 }, { ...a, hex: "a00004", seen_pos: 500 }] },
      { now, ac: [a, { ...a, hex: "a00005", dbFlags: 4 }] },
    ],
    now,
  );
  assert.deepEqual([r.received, r.removedPrivacy, r.tracks.length], [6, 2, 1]);
  assert.equal(r.tracks[0].label, "DAL1");
  assert.equal(r.tracks[0].at, now - 1000);
  assert.ok(!JSON.stringify(r.tracks).includes("abc123"));
});

test("tileCentres covers each box with overlapping 250 NM circles", () => {
  const t = tileCentres([[-125, 24, -66, 49]]);
  assert.ok(t.length >= 20 && t.length <= 40);
  for (const [lat, lon] of t) assert.ok(lat >= 24 && lat <= 52 && lon >= -125 && lon <= -60);
});

test("standby fallback sources are left out of up/lag gauges", () => {
  const src = (id: string, standby: boolean): MovingSourceStatus => ({ id, kind: "aircraft", url: "", licence: "", ok: !standby, standby, error: null, received: 1, moving: 1, removedPrivacy: 0, newestAt: null, lagSeconds: 3 });
  const body = { generatedAt: "", max: 50_000, total: 0, truncated: 0, counts: { aircraft: 0, vessel: 0, train: 0 }, privacy: { listsLoaded: false, error: null, note: "" }, sources: [src("adsb.lol", false), src("OpenSky Network", true)], tracks: [] } satisfies MovingTracksPayload;
  const up = movingGauges(body).find((g) => g.name === "moving_tracks_source_up");
  assert.deepEqual(up?.values.map((v) => v.labels?.source), ["adsb.lol"]);
});

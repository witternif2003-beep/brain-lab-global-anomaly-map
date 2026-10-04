import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decodeGtfsRtVehicles,
  parseAdsbLol,
  parseGbfsFreeBikes,
  parseIemCurrents,
  parseOpenSky,
  parseUsgsIv,
  transitMarkers,
} from "../../lib/ga-live-markers/parse";

const varint = (n: number) => {
  const out: number[] = [];
  do {
    let b = n % 128;
    n = Math.floor(n / 128);
    if (n) b |= 0x80;
    out.push(b);
  } while (n);
  return out;
};
const key = (field: number, wire: number) => varint(field * 8 + wire);
const bytes = (field: number, payload: number[]) => [...key(field, 2), ...varint(payload.length), ...payload];
const str = (field: number, s: string) => bytes(field, [...new TextEncoder().encode(s)]);
const f32 = (field: number, v: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setFloat32(0, v, true);
  return [...key(field, 5), ...b];
};

test("GTFS-RT decoder reads vehicle position, trip route, label and timestamp; skips unknown fields", () => {
  const position = [...f32(1, 33.75), ...f32(2, -84.39), ...f32(3, 90), ...f32(5, 10)];
  const vehicle = [...bytes(1, [...str(1, "trip-1"), ...str(5, "110")]), ...bytes(2, position), ...key(5, 0), ...varint(1791120574), ...bytes(8, str(2, "1609")), ...key(9, 0), ...varint(2)];
  const noPos = [...bytes(1, str(5, "2"))];
  const feed = [
    ...bytes(1, [...str(1, "2.0"), ...key(3, 0), ...varint(1791120588)]),
    ...bytes(2, [...str(1, "e1"), ...bytes(4, vehicle)]),
    ...bytes(2, [...str(1, "e2"), ...bytes(4, noPos)]),
  ];
  const r = decodeGtfsRtVehicles(new Uint8Array(feed));
  assert.equal(r.headerTimestamp, 1791120588);
  assert.equal(r.vehicles.length, 1);
  const v = r.vehicles[0];
  assert.equal(v.routeId, "110");
  assert.equal(v.tripId, "trip-1");
  assert.equal(v.vehicleLabel, "1609");
  assert.equal(v.timestamp, 1791120574);
  assert.ok(Math.abs(v.lat - 33.75) < 1e-5 && Math.abs(v.lon + 84.39) < 1e-5);
  const [m] = transitMarkers(r.vehicles, "MARTA");
  assert.equal(m.label, "Route 110");
  assert.equal(m.props.speedMph, 22.4);
  assert.equal(m.observedAt, "2026-10-04T13:29:34.000Z");
});

test("GTFS-RT decoder rejects truncated input", () => {
  assert.throws(() => decodeGtfsRtVehicles(new Uint8Array([0x12, 0x10, 0x0a])));
});

test("adsb.lol parser drops PIA/LADD aircraft, stale positions and out-of-Georgia aircraft, and omits hex/registration", () => {
  const now = Date.parse("2026-10-04T13:00:00Z");
  const ms = parseAdsbLol({
    now,
    ac: [
      { flight: "DAL123  ", t: "B739", lat: 33.6, lon: -84.4, alt_baro: 12000, gs: 300, track: 90, seen_pos: 2, hex: "a1b2c3", r: "N123DL" } as never,
      { flight: "LADD1", lat: 33.6, lon: -84.4, seen_pos: 1, dbFlags: 8 },
      { flight: "PIA1", lat: 33.6, lon: -84.4, seen_pos: 1, dbFlags: 4 },
      { flight: "MIL1", lat: 32.5, lon: -83.6, alt_baro: "ground", seen_pos: 1, dbFlags: 1 },
      { flight: "OLD1", lat: 33.6, lon: -84.4, seen_pos: 120 },
      { flight: "FLA1", lat: 28.4, lon: -81.3, seen_pos: 1 },
    ],
  });
  assert.deepEqual(ms.map((m) => m.label), ["DAL123", "MIL1"]);
  assert.equal(ms[0].observedAt, "2026-10-04T12:59:58.000Z");
  assert.equal(ms[1].props.onGround, true);
  assert.ok(!JSON.stringify(ms).includes("a1b2c3") && !JSON.stringify(ms).includes("N123DL"));
});

test("OpenSky parser converts metres and m/s", () => {
  const [m] = parseOpenSky({ time: 1791120585, states: [["abc123", "SWA9  ", "United States", 1791120580, 1791120584, -84.4, 33.6, 1000, false, 100, 45, 0, null, 1010, null, false, 0]] });
  assert.equal(m.label, "SWA9");
  assert.equal(m.props.altFt, 3281);
  assert.equal(m.props.gsKt, 194.4);
});

test("GBFS parser hides reserved vehicles and vehicle IDs", () => {
  const ms = parseGbfsFreeBikes(
    { last_updated: 1791120592, data: { bikes: [
      { bike_id: "x1", lat: 33.76, lon: -84.33, is_reserved: false, is_disabled: false, vehicle_type: "scooter", current_range_meters: 42213 } as never,
      { lat: 33.77, lon: -84.34, is_reserved: true },
      { lat: 33.78, lon: -84.35, is_reserved: 0, is_disabled: 1 },
    ] } },
    "Lime",
  );
  assert.equal(ms.length, 2);
  assert.equal(ms[0].props.rangeKm, 42.2);
  assert.equal(ms[1].props.disabled, true);
  assert.ok(!JSON.stringify(ms).includes("x1"));
});

test("IEM parser keeps only recent observations", () => {
  const now = Date.parse("2026-10-04T13:00:00Z");
  const ms = parseIemCurrents({ data: [
    { station: "ATL", name: "Atlanta", utc_valid: "2026-10-04T12:52:00Z", lon: -84.43, lat: 33.63, tmpf: 71, relh: 88.4, sknt: 5, drct: 90 },
    { station: "OLD", name: "Old", utc_valid: "2026-10-03T12:00:00Z", lon: -84, lat: 33 },
    { station: "NOT", name: "No time", utc_valid: null, lon: -84, lat: 33 },
  ] }, "GA_ASOS", now);
  assert.equal(ms.length, 1);
  assert.equal(ms[0].props.rh, 88);
  assert.equal(ms[0].props.network, "GA_ASOS");
});

test("USGS IV parser takes the latest value per site and skips no-data sentinels", () => {
  const series = (site: string, value: string) => ({
    sourceInfo: { siteName: `SITE ${site}`, siteCode: [{ value: site }], geoLocation: { geogLocation: { latitude: 34.97, longitude: -83.11 } } },
    variable: { unit: { unitCode: "ft" } },
    values: [{ value: [{ value: "0.5", dateTime: "2026-10-04T08:30:00.000-04:00" }, { value, dateTime: "2026-10-04T08:45:00.000-04:00", qualifiers: ["P"] }] }],
  });
  const ms = parseUsgsIv({ value: { timeSeries: [series("02176930", "0.97"), series("02999999", "-999999")] } });
  assert.equal(ms.length, 1);
  assert.equal(ms[0].props.gageHeightFt, 0.97);
  assert.equal(ms[0].props.provisional, true);
  assert.equal(ms[0].observedAt, "2026-10-04T12:45:00.000Z");
});

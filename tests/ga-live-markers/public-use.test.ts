import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { atlasMarkers, GA_BBOX, parseApdCrime, parseDoravilleIncidents, parseOsmEquipment, toBlockAddress, type EquipmentCategory } from "../../lib/ga-live-markers/parse";

const cats = JSON.parse(readFileSync("data/osm/ga-equipment-categories.json", "utf8")) as EquipmentCategory[];
const inBox = (m: { lon: number; lat: number }) => m.lat >= GA_BBOX.south && m.lat <= GA_BBOX.north && m.lon >= GA_BBOX.west && m.lon <= GA_BBOX.east;

test("committed equipment snapshot fills every category inside Georgia, dated by its OSM time", () => {
  const json = JSON.parse(gunzipSync(readFileSync("data/osm/ga-equipment-snapshot.json.gz")).toString("utf8"));
  const ms = parseOsmEquipment(json, cats);
  assert.ok(cats.length >= 50);
  const seen = new Set(ms.map((m) => m.props.category));
  for (const c of cats) assert.ok(seen.has(c.id), `${c.id} has markers`);
  assert.ok(ms.every(inBox) && ms.every((m) => m.observedAt === json.osm3s.timestamp_osm_base));
});

test("parseOsmEquipment drops private items and lists charger connectors", () => {
  const ms = parseOsmEquipment({ elements: [
    { type: "node", id: 1, lat: 33.7, lon: -84.4, tags: { amenity: "charging_station", "socket:type1_combo": "2", "socket:type1": "yes", operator: "ChargePoint" } },
    { type: "node", id: 2, lat: 33.7, lon: -84.4, tags: { amenity: "charging_station", access: "private" } },
  ] }, cats);
  assert.equal(ms.length, 1);
  assert.equal(ms[0].props.sockets, "CCS1 ×2, J1772");
  assert.equal(ms[0].props.kind, "Public EV charger");
});

test("toBlockAddress generalizes house numbers and keeps intersections", () => {
  assert.equal(toBlockAddress("1195 WOODLAND AVE NE"), "1100 block WOODLAND AVE NE");
  assert.equal(toBlockAddress("BUFORD HWY @ MCELROY RD"), "BUFORD HWY @ MCELROY RD");
});

test("police report parsers keep the window, round positions and drop sensitive fields", () => {
  const now = Date.parse("2026-10-15T12:00:00Z");
  const since = now - 21 * 86_400_000;
  const apd = parseApdCrime({ features: [
    { attributes: { ReportDate: now - 3_600_000, NIBRS_Offense: "Theft From Motor Vehicle", StreetAddress: "410 14TH ST NW", Longitude: -84.4004835, Latitude: 33.78591, FireArmInvolved: "no" } },
    { attributes: { ReportDate: 4886971245388, NIBRS_Offense: "future", Longitude: -84.4, Latitude: 33.7 } },
  ] }, since, now);
  assert.equal(apd.length, 1);
  assert.deepEqual([apd[0].lon, apd[0].lat], [-84.4, 33.786]);
  assert.equal(apd[0].props.block, "400 block 14TH ST NW");
  assert.ok(!("GAFamilyViolenceIndicator" in apd[0].props) && !("victims" in apd[0].props));
  const dor = parseDoravilleIncidents({ features: [
    { attributes: { USER_INC_REPORT_DATE: now - 86_400_000, USER_NIBR_DESC: "SIMPLE ASSAULT", USER_BLOCK_ADDRESS: "3800 BLOCK MARYLAND DR " }, geometry: { x: -84.261643, y: 33.903648 } },
    { attributes: { USER_INC_REPORT_DATE: now - 40 * 86_400_000, USER_NIBR_DESC: "old" }, geometry: { x: -84.26, y: 33.9 } },
  ] }, since, now);
  assert.equal(dor.length, 1);
  assert.equal(dor[0].props.block, "3800 BLOCK MARYLAND DR");
  assert.ok(!Object.values(dor[0].props).some((v) => typeof v === "string" && /SHUMATE|2026-0/.test(v)));
});

test("committed Atlas of Surveillance copy gives one Georgia marker per agency", () => {
  const json = JSON.parse(readFileSync("data/aos/ga-atlas-of-surveillance.json", "utf8"));
  const ms = atlasMarkers(json);
  assert.ok(ms.length > 250 && ms.every(inBox));
  assert.equal(new Set(ms.map((m) => m.label)).size, ms.length);
  assert.ok(ms.every((m) => ["osm", "city", "county"].includes(String(m.props.placedBy))));
});

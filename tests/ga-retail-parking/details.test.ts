import { test } from "node:test";
import assert from "node:assert/strict";
import { distanceM, fmtArea, nearest, nwsObservationText, osmRefFromPoiId, parkingTagRows, parseOsmElement, ringAreaM2 } from "../../lib/ga-parking-details";

test("osmRefFromPoiId decodes OpenFreeMap POI ids (OSM id × 10 + type)", () => {
  assert.deepEqual(osmRefFromPoiId(7051218112), { type: "way", id: 705121811 });
  assert.deepEqual(osmRefFromPoiId(32662573831), { type: "node", id: 3266257383 });
  assert.deepEqual(osmRefFromPoiId("123"), { type: "relation", id: 12 });
  assert.equal(osmRefFromPoiId(120), null);
  assert.equal(osmRefFromPoiId(undefined), null);
});

test("ringAreaM2 measures a 100 m × 100 m square within 0.5%", () => {
  const dLat = 100 / 111_195;
  const dLon = dLat / Math.cos((33.75 * Math.PI) / 180);
  const ring: [number, number][] = [[-84.39, 33.75], [-84.39 + dLon, 33.75], [-84.39 + dLon, 33.75 + dLat], [-84.39, 33.75 + dLat], [-84.39, 33.75]];
  assert.ok(Math.abs(ringAreaM2(ring) - 10_000) < 50);
  assert.match(fmtArea(10_000), /^10,000 m² \(2\.47 acres\)$/);
});

test("parseOsmElement rebuilds a closed way ring and rejects incomplete ones", () => {
  const nodes = [[1, -84, 33], [2, -84.001, 33], [3, -84.001, 33.001]].map(([id, lon, lat]) => ({ type: "node", id, lon, lat }));
  const way = { type: "way", id: 9, nodes: [1, 2, 3, 1], tags: { amenity: "parking" } };
  assert.equal(parseOsmElement({ elements: [...nodes, way] }, { type: "way", id: 9 })?.ring?.length, 4);
  assert.equal(parseOsmElement({ elements: [nodes[0], way] }, { type: "way", id: 9 })?.ring, null);
  assert.equal(parseOsmElement({ elements: [] }, { type: "way", id: 9 }), null);
});

test("parkingTagRows turns OSM tags into readable rows", () => {
  const rows = Object.fromEntries(parkingTagRows({ parking: "multi-storey", access: "customers", fee: "yes", charge: "$2/h", capacity: "400", "capacity:disabled": "8" }));
  assert.equal(rows.Type, "multi-storey garage");
  assert.equal(rows.Fee, "yes ($2/h)");
  assert.equal(rows["Mapped capacity"], "400 spaces · 8 accessible");
  assert.equal(rows.Name, "");
});

test("nearest honours the distance cap", () => {
  const pts = [{ lon: -84.39, lat: 33.75 }, { lon: -84.5, lat: 33.9 }];
  assert.equal(nearest(pts, [-84.391, 33.75], 500)?.item, pts[0]);
  assert.equal(nearest(pts, [-83, 32], 500), null);
  assert.ok(Math.abs(distanceM([-84.39, 33.75], [-84.39, 33.76]) - 1112) < 2);
});

test("nwsObservationText converts NWS SI units and skips missing values", () => {
  const t = nwsObservationText({ textDescription: "Cloudy", temperature: { value: 16.7 }, windSpeed: { value: null }, relativeHumidity: { value: 51.7 }, visibility: { value: 16090 } });
  assert.equal(t, "Cloudy · 62°F (16.7°C) · humidity 52% · visibility 10.0 mi");
});

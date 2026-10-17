import { test } from "node:test";
import assert from "node:assert/strict";
import { decodePolyline, normalize, type Ga511Attributes } from "../../lib/ga-traffic/normalize";

const row = (o: Partial<Ga511Attributes>): Ga511Attributes => ({
  ID: 1, RoadwayName: "I-285", DirectionOfTravel: "n", Description: "Incident on I-285  Northbound.", LastUpdated: Date.UTC(2026, 9, 2, 18),
  StartDate: null, PlannedEndDate: null, LanesAffected: "1 lane blocked.", Latitude: 33.76, Longitude: -84.49,
  EventType: "accidentsAndIncidents", IsFullClosure: "False", EncodedPolyline: "", Severity: "minor", ...o,
});

test("decodes the reference Google polyline as [lng, lat]", () => {
  assert.deepEqual(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@"), [[-120.2, 38.5], [-120.95, 40.7], [-126.453, 43.252]]);
});

test("normalizes points, lines and summary counts", () => {
  const out = normalize([
    row({}),
    row({ ID: 2, EventType: "closures", IsFullClosure: "True", Severity: "major", EncodedPolyline: "_p~iF~ps|U_ulLnnqC" }),
    row({ ID: 3, Latitude: null }),
  ]);
  assert.equal(out.points.features.length, 2);
  assert.equal(out.lines.features.length, 1);
  assert.equal(out.points.features[0].properties?.direction, "Northbound");
  assert.equal(out.points.features[0].properties?.description, "Incident on I-285 Northbound.");
  assert.deepEqual(out.summary.byType, { Incident: 1, Closure: 1 });
  assert.deepEqual(out.summary.bySeverity, { minor: 1, major: 1 });
  assert.equal(out.summary.fullClosures, 1);
  assert.equal(out.summary.latestUpdate, "2026-10-02T18:00:00.000Z");
});

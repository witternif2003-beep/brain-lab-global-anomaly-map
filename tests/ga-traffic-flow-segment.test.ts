import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePoint, summarizeSegment, tomtomSegmentUrl } from "../lib/ga-traffic-flow/segment";

test("point must be lat,lon inside Georgia", () => {
  assert.deepEqual(parsePoint("33.7489,-84.3881"), { lat: 33.7489, lon: -84.3881 });
  assert.equal(parsePoint("40.7,-74.0"), null);
  assert.equal(parsePoint("-84.3881,33.7489"), null);
  assert.equal(parsePoint("33.7;drop"), null);
  assert.equal(parsePoint(null), null);
});

test("ratio is current / free-flow speed from TomTom's own fields", () => {
  const s = summarizeSegment({ flowSegmentData: { frc: "FRC0", currentSpeed: 30, freeFlowSpeed: 60, currentTravelTime: 120, freeFlowTravelTime: 60, confidence: 0.95, roadClosure: false } });
  assert.equal(s?.ratio, 0.5);
  assert.equal(s?.condition, "slow");
  assert.equal(s?.confidence, 0.95);
  assert.equal(s?.currentSpeedMph, 30);
});

test("missing or zero free-flow speed gives no ratio; closures are reported as closed", () => {
  assert.equal(summarizeSegment({ flowSegmentData: { currentSpeed: 20, freeFlowSpeed: 0 } })?.ratio, null);
  assert.equal(summarizeSegment({ flowSegmentData: { currentSpeed: 0, freeFlowSpeed: 55, roadClosure: true } })?.condition, "closed");
  assert.equal(summarizeSegment({}), null);
});

test("segment URL asks for mph and encodes the key", () => {
  assert.match(tomtomSegmentUrl(33.7, -84.4, "a&b"), /flowSegmentData\/absolute\/22\/json\?point=33\.7,-84\.4&unit=MPH&key=a%26b$/);
});

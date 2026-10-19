import { test } from "node:test";
import assert from "node:assert/strict";
import { carSpacingM, carsAlong, MIN_CAR_SPACING_M, roadPathFor, type LngLat, type RoadLine } from "../../lib/ga-traffic-counts/cars";

test("carSpacingM is measured speed ÷ measured flow, floored at icon spacing", () => {
  const s = carSpacingM(1000, 60);
  assert.ok(s && Math.abs(s.spacingM - 96.56) < 0.1 && s.vehiclesPerIcon === 1);
  const dense = carSpacingM(8000, 20);
  assert.ok(dense && dense.spacingM === MIN_CAR_SPACING_M && dense.vehiclesPerIcon > 2);
  assert.equal(carSpacingM(1000, null), null);
  assert.equal(carSpacingM(0, 60), null);
});

const station: LngLat = [-84.4, 33.75];
const northbound: RoadLine = { coords: [[-84.4001, 33.74], [-84.4001, 33.76]] };
const eastbound: RoadLine = { coords: [[-84.41, 33.7501], [-84.39, 33.7501]] };

test("roadPathFor picks the line aligned with the bearing and orients it with traffic", () => {
  const north = roadPathFor(station, 0, [eastbound, northbound]);
  assert.ok(north && north[0][1] < north[north.length - 1][1]);
  const south = roadPathFor(station, 180, [northbound]);
  assert.ok(south && south[0][1] > south[south.length - 1][1]);
  const west = roadPathFor(station, 270, [eastbound, northbound]);
  assert.ok(west && west[0][0] > west[west.length - 1][0]);
  assert.equal(roadPathFor(station, 45, [{ coords: [[-84.5, 33.9], [-84.49, 33.9]] }]), null);
});

test("roadPathFor keeps each direction on its own one-way carriageway", () => {
  const westOnly: RoadLine = { coords: [[-84.39, 33.75007], [-84.41, 33.75007]], oneway: 1 };
  const eastOnly: RoadLine = { coords: [[-84.41, 33.74991], [-84.39, 33.74991]], oneway: 1 };
  const east = roadPathFor(station, 90, [westOnly, eastOnly]);
  assert.ok(east && east[0][0] < east[east.length - 1][0] && Math.abs(east[0][1] - 33.74991) < 1e-6);
  const west = roadPathFor(station, 270, [westOnly, eastOnly]);
  assert.ok(west && Math.abs(west[0][1] - 33.75007) < 1e-6);
  const drawnBackwards: RoadLine = { coords: [[-84.39, 33.74991], [-84.41, 33.74991]], oneway: -1 };
  const e2 = roadPathFor(station, 90, [westOnly, drawnBackwards]);
  assert.ok(e2 && Math.abs(e2[0][1] - 33.74991) < 1e-6);
});

test("carsAlong spaces cars evenly, heads them along the path and advances them at the measured speed", () => {
  const path = roadPathFor(station, 0, [northbound]) as LngLat[];
  const a = carsAlong(path, 50, 60, 0);
  assert.ok(a.length >= 11 && a.length <= 13);
  assert.ok(a.every((c) => c.heading < 1 || c.heading > 359));
  const b = carsAlong(path, 50, 60, 1);
  assert.ok(Math.abs((b[0].at[1] - a[0].at[1]) * 110_540 - 26.8) < 0.5);
  assert.deepEqual(carsAlong(path, 50, null, 5), carsAlong(path, 50, null, 0));
});

test("roadPathFor stays on the road class nearest the station", () => {
  const motorway: RoadLine = { coords: [[-84.4003, 33.74], [-84.4003, 33.76]], oneway: 1, cls: "motorway" };
  const sideStreet: RoadLine = { coords: [[-84.4001, 33.76], [-84.4001, 33.74]], cls: "tertiary" };
  const closeMotorway: RoadLine = { coords: [[-84.39995, 33.74], [-84.39995, 33.76]], oneway: 1, cls: "motorway" };
  assert.equal(roadPathFor(station, 180, [motorway, sideStreet, closeMotorway]), null);
  assert.ok(roadPathFor(station, 0, [motorway, sideStreet, closeMotorway]));
});

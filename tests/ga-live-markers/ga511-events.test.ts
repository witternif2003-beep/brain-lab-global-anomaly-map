import { test } from "node:test";
import assert from "node:assert/strict";
import { parse511Events } from "../../lib/ga-live-markers/parse";

// Sample record from https://511ga.org/help/endpoint/event (accessed 2026-11-11).
const SAMPLE = {
  ID: 12, SourceId: "3458465", Organization: "GA-Events", RoadwayName: "SR 1", DirectionOfTravel: "both directions",
  Description: "Road construction on SR 1 both directions at DENTON RD.. 2 right lanes are blocked.",
  Reported: 1693022400, LastUpdated: 1711201085, StartDate: 1693022400, PlannedEndDate: 1769920200,
  LanesAffected: "2 right lanes are blocked.", Latitude: 34.063612, Longitude: -85.232752,
  EventType: "roadwork", IsFullClosure: false, Severity: "3",
};

test("511GA events keep the published coordinates and event fields", () => {
  const [m] = parse511Events([SAMPLE]);
  assert.equal(m.lat, 34.063612);
  assert.equal(m.lon, -85.232752);
  assert.equal(m.label, "roadwork · SR 1");
  assert.equal(m.observedAt, new Date(1711201085 * 1000).toISOString());
  assert.equal(m.props.eventId, 12);
  assert.equal(m.props.fullClosure, false);
  assert.equal(m.props.plannedEnd, new Date(1769920200 * 1000).toISOString());
});

test("511GA events outside Georgia or without coordinates are dropped", () => {
  assert.equal(parse511Events([{ ...SAMPLE, Latitude: null }, { ...SAMPLE, Latitude: 40.7, Longitude: -74 }]).length, 0);
  assert.equal(parse511Events(null).length, 0);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { airframeFor, airframeKnown } from "../../lib/ga-live-markers/airframe";
import { gaMesh } from "../../lib/ga-mesh-models";

test("airframeFor picks the shape from the ICAO type designator before the ADS-B category", () => {
  assert.deepEqual(airframeFor("B738", "A3"), ["airliner", 1]);
  assert.equal(airframeFor("CRJ9", "A3")[0], "regionaljet");
  assert.equal(airframeFor("e145", "A2")[0], "regionaljet");
  assert.equal(airframeFor("B77W", "A5")[0], "widebody");
  assert.equal(airframeFor("R66", "A1")[0], "helicopter");
  assert.equal(airframeFor("GLF5", "A3")[0], "lightplane");
  assert.equal(airframeFor("C172", "A1")[0], "lightplane");
});

test("airframeFor falls back to the ADS-B emitter category for unlisted types", () => {
  assert.deepEqual(airframeFor("ZZZZ", "A7"), ["helicopter", 1]);
  assert.deepEqual(airframeFor(null, "A5"), ["widebody", 1]);
  assert.deepEqual(airframeFor(undefined, undefined), ["airliner", 0.8]);
  assert.equal(airframeKnown("ZZZZ"), false);
  assert.equal(airframeKnown(" a321 "), true);
});

test("new airframe meshes build with valid indices", () => {
  for (const kind of ["regionaljet", "widebody"] as const) {
    const m = gaMesh(kind);
    const verts = m.attributes.positions.value.length / 3;
    assert.ok(verts > 0 && m.indices.value.length % 3 === 0);
    assert.ok(Math.max(...m.indices.value) < verts);
  }
});

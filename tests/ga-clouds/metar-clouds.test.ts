import { test } from "node:test";
import assert from "node:assert/strict";
import { CLOUD_THICKNESS_M, circle, metarCloudSlabs } from "../../lib/ga-clouds/metar-clouds";

test("each reported cloud layer becomes a slab at its base height above ground", () => {
  const fc = metarCloudSlabs([
    { icaoId: "KATL", lat: 33.63, lon: -84.44, reportTime: "2026-10-15T13:52:00Z", clouds: [{ cover: "FEW", base: 2500 }, { cover: "BKN", base: 10000 }] },
    { icaoId: "KCLR", lat: 32, lon: -83, clouds: [{ cover: "CLR", base: null }] },
    { icaoId: "KVV", lat: 31, lon: -82, clouds: [{ cover: "VV", base: 200 }] },
    { icaoId: "KNOPOS", clouds: [{ cover: "OVC", base: 500 }] },
  ], 8);
  assert.deepEqual(fc.features.map((f) => [f.properties?.station, f.properties?.cover, f.properties?.baseM]), [["KATL", "FEW", 762], ["KATL", "BKN", 3048], ["KVV", "OVC", 61]]);
  assert.equal(fc.features[1].properties?.topM, 3048 + CLOUD_THICKNESS_M);
  assert.equal(fc.features[0].geometry.coordinates[0].length, 9);
});

test("circle is closed and about the requested radius", () => {
  const ring = circle(-84, 33, 8000, 16);
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  const dLat = Math.abs(ring[4][1] - 33) * 111_195;
  assert.ok(Math.abs(dLat - 8000) < 20);
});

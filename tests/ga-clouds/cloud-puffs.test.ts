import { test } from "node:test";
import assert from "node:assert/strict";
import { radarCloudPuffs } from "../../lib/ga-clouds/cloud-puffs";

const block = (w: number, s: number, e: number, n: number, props: Record<string, unknown>): GeoJSON.Feature<GeoJSON.Polygon> => ({
  type: "Feature",
  geometry: { type: "Polygon", coordinates: [[[w, n], [e, n], [e, s], [w, s], [w, n]]] },
  properties: props,
});
const flat = () => 0;

test("radarCloudPuffs fills each echo column from the base to the echo top", () => {
  const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [block(-84, 33, -83.99, 33.01, { topM: 6000, baseM: 900, band: "light", night: 0, baseStation: "KATL" })] };
  const puffs = radarCloudPuffs(fc, { cellDeg: 0.01, groundM: flat, maxPuffs: 1000 });
  assert.ok(puffs.length > 3);
  for (const p of puffs) {
    assert.ok(p.position[0] > -84.01 && p.position[0] < -83.98);
    assert.ok(p.position[1] > 32.99 && p.position[1] < 33.02);
    assert.equal(p.block, 0);
  }
  const zs = puffs.map((p) => p.position[2]);
  assert.ok(Math.min(...zs) < 900 + 1000 && Math.min(...zs) > 900);
  assert.ok(Math.max(...zs) <= 6000 && Math.max(...zs) > 5000);
  const top = puffs.reduce((a, b) => (b.position[2] > a.position[2] ? b : a));
  const bottom = puffs.reduce((a, b) => (b.position[2] < a.position[2] ? b : a));
  assert.ok(top.color[0] > bottom.color[0], "crowns are brighter than bases");
});

test("radarCloudPuffs adds ground height to the METAR base and keeps only surface puffs", () => {
  const props = { topM: 6000, baseM: 500, band: "moderate", night: 0, baseStation: "KATL" };
  const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [block(-84, 33, -83.95, 33.05, props)] };
  const raised = radarCloudPuffs(fc, { cellDeg: 0.01, groundM: () => 400, maxPuffs: 10_000 });
  assert.ok(Math.min(...raised.map((p) => p.position[2])) > 900);
  const columnsXY = new Set(raised.map((p) => `${p.position[0].toFixed(2)},${p.position[1].toFixed(2)}`));
  assert.ok(columnsXY.size >= 20);
  const interior = raised.filter((p) => Math.abs(p.position[0] + 83.975) < 0.003 && Math.abs(p.position[1] - 33.025) < 0.003);
  assert.equal(interior.length, 2, "a column surrounded by equal columns keeps only its base and crown puffs");
  const edge = raised.filter((p) => Math.abs(p.position[0] + 83.995) < 0.003 && Math.abs(p.position[1] - 33.025) < 0.003);
  assert.ok(edge.length > 4, "edge columns keep their side puffs");
});

test("radarCloudPuffs tints night cells blue-grey and merges cells to fit the budget", () => {
  const fc: GeoJSON.FeatureCollection = {
    type: "FeatureCollection",
    features: [block(-84, 33, -83.9, 33.1, { topM: 8000, baseM: 0, band: "heavy", night: 1, baseStation: "KATL" })],
  };
  const all = radarCloudPuffs(fc, { cellDeg: 0.01, groundM: flat, maxPuffs: 1e9 });
  const capped = radarCloudPuffs(fc, { cellDeg: 0.01, groundM: flat, maxPuffs: 500 });
  assert.ok(capped.length <= 500 && capped.length < all.length);
  const crown = all.reduce((a, b) => (b.position[2] > a.position[2] ? b : a));
  assert.ok(crown.color[2] > crown.color[0], "night puffs are bluer than they are red");
  assert.deepEqual(radarCloudPuffs(fc, { cellDeg: 0.01, groundM: flat, maxPuffs: 1e9 }), all, "deterministic");
});

test("radarCloudPuffs draws only a cap at the measured echo top when no METAR base is in range", () => {
  const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [block(-84, 33, -83.99, 33.01, { topM: 7000, baseM: 0, band: "light", night: 0, baseStation: null })] };
  const puffs = radarCloudPuffs(fc, { cellDeg: 0.01, groundM: () => 300, maxPuffs: 1000 });
  assert.ok(puffs.length > 0);
  for (const p of puffs) assert.ok(p.position[2] > 7000 - 2 * p.scale[0] && p.position[2] <= 7000, "no puff hangs down to the ground");
});

test("radarCloudPuffs sorts puffs low to high so crowns blend last", () => {
  const fc: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: [block(-84, 33, -83.97, 33.03, { topM: 8000, baseM: 600, band: "moderate", night: 0, baseStation: "KATL" })] };
  const zs = radarCloudPuffs(fc, { cellDeg: 0.01, groundM: flat, maxPuffs: 1e6 }).map((p) => p.position[2]);
  assert.deepEqual(zs, [...zs].sort((a, b) => a - b));
});

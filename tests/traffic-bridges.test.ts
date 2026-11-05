import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  BRIDGE_LAYER_M,
  DECK_THICKNESS_M,
  MAX_APPROACH_GRADE,
  bridgeLayerAt,
  bridgeLine,
  bridgeSegments,
  buildBridgeIndex,
  deckPolygons,
  densify,
  taperOffsets,
} from "../lib/traffic-bridges";
import { haversineM, type LngLat } from "../lib/traffic-sim";

/** 400 m east-west layer-2 ramp bridge in 4 vertices, near Spaghetti Junction. */
const RAMP: LngLat[] = [0, 1, 2, 3].map(
  (i) => [-84.262 + (i * 0.0043) / 3, 33.8915] as LngLat,
);
const feat = (coords: LngLat[], props: Record<string, unknown>) => ({
  geometry: { type: "LineString", coordinates: coords },
  properties: props,
});

test("only brunnel=bridge with an integer layer ≥ 1 becomes a bridge segment", () => {
  const segs = bridgeSegments([
    feat(RAMP, { brunnel: "bridge", layer: 2, class: "motorway" }),
    feat(RAMP, { brunnel: "bridge", class: "motorway" }),
    feat(RAMP, { brunnel: "tunnel", layer: -1 }),
    feat(RAMP, { class: "motorway", layer: 1 }),
    feat(RAMP, { brunnel: "bridge", layer: 2, class: "motorway" }),
  ]);
  assert.equal(segs.length, 3);
  assert.ok(segs.every((s) => s.layer === 2));
});

test("matches mid-span, either direction, within 12 m; ignores crossing roads and far lines", () => {
  const idx = buildBridgeIndex(
    bridgeSegments([feat(RAMP, { brunnel: "bridge", layer: 2 })]),
  );
  const mid: LngLat = [-84.262 + 0.00215, 33.8915];
  assert.equal(bridgeLayerAt(idx, mid, 90), 2);
  assert.equal(bridgeLayerAt(idx, mid, 270), 2);
  assert.equal(bridgeLayerAt(idx, [mid[0], mid[1] + 8 / 110_574], 95), 2);
  assert.equal(bridgeLayerAt(idx, [mid[0], mid[1] + 20 / 110_574], 90), 0);
  assert.equal(
    bridgeLayerAt(idx, mid, 0),
    0,
    "a road passing under at right angles stays on the ground",
  );
});

test("densify keeps the ends and caps the step", () => {
  const d = densify(RAMP, 20);
  assert.deepEqual(d[0], RAMP[0]);
  assert.deepEqual(d[d.length - 1], RAMP[3]);
  for (let i = 1; i < d.length; i++)
    assert.ok(haversineM(d[i - 1], d[i]) <= 20.001);
});

test("approach taper never exceeds the grade and keeps the deck height", () => {
  const cum = [0, 100, 200, 300, 400, 500];
  const off = taperOffsets([0, 0, 14, 14, 0, 0], cum);
  assert.deepEqual(off.slice(2, 4), [14, 14]);
  assert.ok(Math.abs(off[1] - (14 - MAX_APPROACH_GRADE * 100)) < 1e-9);
  for (let i = 1; i < off.length; i++)
    assert.ok(Math.abs(off[i] - off[i - 1]) <= MAX_APPROACH_GRADE * 100 + 1e-9);
});

test("a TomTom line along the bridge is lifted to layer × 7 m with decks under it; others stay flat", () => {
  const idx = buildBridgeIndex(
    bridgeSegments([feat(RAMP, { brunnel: "bridge", layer: 2 })]),
  );
  const along: LngLat[] = [
    [-84.2635, 33.89151],
    [-84.256, 33.89151],
  ];
  const b = bridgeLine(idx, along);
  assert.ok(b.onBridge);
  assert.equal(Math.max(...b.offsets), 2 * BRIDGE_LAYER_M);
  assert.equal(b.offsets.length, b.coords.length);
  const decks = deckPolygons(b);
  assert.ok(decks.length > 0);
  for (const d of decks) {
    assert.ok(
      Math.abs(d.properties.height - d.properties.base - DECK_THICKNESS_M) <
        1e-9,
    );
    assert.deepEqual(
      d.geometry.coordinates[0][0],
      d.geometry.coordinates[0][4],
    );
  }
  const away = bridgeLine(idx, [
    [-84.3, 33.8],
    [-84.29, 33.8],
  ]);
  assert.equal(away.onBridge, false);
  assert.equal(away.coords.length, 2);
  assert.deepEqual(away.offsets, [0, 0]);
  assert.equal(deckPolygons(away).length, 0);
});

test("no bridges loaded → no lift", () => {
  const b = bridgeLine(buildBridgeIndex([]), RAMP);
  assert.equal(b.onBridge, false);
  assert.deepEqual(b.offsets, [0, 0, 0, 0]);
});

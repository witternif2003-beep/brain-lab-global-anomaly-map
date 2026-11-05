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
  deckOffsets,
  densify,
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

const steps = (n: number, d = 20) => Array.from({ length: n }, (_, i) => i * d);

test("overpass over a cut rests on its abutments: no lift on the approach, ~layer × 7 m over the cut", () => {
  // Liberty Rd over I-20 (GDOT-CCTV-1128): terrarium z15 ground 350 m at the ends, 342 m in the cut.
  const ground = [352, 350, 349, 344, 342, 343, 348, 348, 347];
  const layers = [0, 0, 1, 1, 1, 1, 1, 0, 0];
  const off = deckOffsets(layers, ground, steps(9));
  assert.deepEqual([off[0], off[1], off[7], off[8]], [0, 0, 0, 0]);
  const deck = ground.map((g, i) => g + off[i]);
  assert.ok(Math.abs(deck[4] - 349) < 1e-9, "342 m floor + 1 × 7 m");
  for (let i = 2; i <= 6; i++)
    assert.ok(deck[i] <= 350 + 1e-9, "never above the abutments on a cut");
});

test("flyover on flat ground climbs at ≤ 6 % from both ends to layer × 7 m", () => {
  const n = 40;
  const ground = new Array(n).fill(300);
  const layers = ground.map((_, i) => (i > 0 && i < n - 1 ? 2 : 0));
  const cum = steps(n);
  const off = deckOffsets(layers, ground, cum);
  assert.equal(off[0], 0);
  assert.equal(off[n - 1], 0);
  assert.equal(Math.max(...off), 2 * BRIDGE_LAYER_M);
  for (let i = 1; i < n; i++)
    assert.ok(Math.abs(off[i] - off[i - 1]) <= MAX_APPROACH_GRADE * 20 + 1e-9);
});

test("span over a valley stays on the chord between its abutments", () => {
  const off = deckOffsets([0, 1, 1, 1, 0], [350, 300, 290, 300, 350], steps(5));
  assert.deepEqual(off, [0, 50, 60, 50, 0]);
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
  const top = Math.max(...b.offsets);
  assert.ok(top > 0 && top <= 2 * BRIDGE_LAYER_M);
  assert.equal(b.offsets[0], 0, "approach off the bridge stays on the road");
  assert.equal(b.offsets[b.offsets.length - 1], 0);
  assert.equal(b.ground.length, b.coords.length);
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

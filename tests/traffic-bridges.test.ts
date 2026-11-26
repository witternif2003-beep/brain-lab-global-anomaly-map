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
  flowStripePolygons,
  FLOW_STRIPE_THICKNESS_M,
  ribbonEdges,
  levelSharedDecks,
  SLAB_STEP_M,
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

test("mitred deck slabs share their joint edge at a bend, and flow stripes sit on top in the given colour", () => {
  const coords: LngLat[] = [
    [-84.262, 33.8915],
    [-84.2618, 33.8915],
    [-84.2616, 33.8917],
  ];
  const line = { coords, ground: [0, 0, 0], layers: [1, 1, 1], offsets: [7, 7, 7], onBridge: true };
  const decks = deckPolygons(line);
  const n1 = Math.ceil(haversineM(coords[0], coords[1]) / SLAB_STEP_M);
  assert.equal(decks.length, n1 + Math.ceil(haversineM(coords[1], coords[2]) / SLAB_STEP_M));
  const [a, b] = [decks[n1 - 1], decks[n1]].map((d) => d.geometry.coordinates[0]);
  assert.deepEqual(a[1], b[0], "left edge continues");
  assert.deepEqual(a[2], b[3], "right edge continues");
  const { left, right } = ribbonEdges(coords, 8);
  for (const [i, c] of coords.entries()) assert.ok(Math.abs(haversineM(left[i], c) - haversineM(right[i], c)) < 1e-6);
  assert.ok(Math.abs(haversineM(left[0], coords[0]) - 4) < 0.05, "half width at a straight end");
  const stripes = flowStripePolygons(line, "#00e676");
  assert.equal(stripes.length, decks.length);
  for (const [i, s] of stripes.entries()) {
    assert.equal(s.properties.color, "#00e676");
    assert.equal(s.properties.base, decks[i].properties.height);
    assert.ok(Math.abs(s.properties.height - s.properties.base - FLOW_STRIPE_THICKNESS_M) < 1e-9);
  }
});

test("overlapping decks from two lines on one bridge are levelled to the higher top; separate bridges are untouched", () => {
  const mk = (lat: number, off: number, layer = 1) => ({
    coords: [[-84.262, lat], [-84.2618, lat]] as LngLat[],
    ground: [100, 100],
    layers: [layer, layer],
    offsets: [off, off],
    onBridge: true,
  });
  const [a, b, far, other] = levelSharedDecks([mk(33.8915, 7), mk(33.89154, 5.5), mk(33.8925, 3), mk(33.89152, 2, 2)]);
  assert.deepEqual(a.offsets, [7, 7]);
  assert.deepEqual(b.offsets, [7, 7], "4 m apart: raised to the shared top");
  assert.deepEqual(far.offsets, [3, 3], "110 m away: separate deck");
  assert.deepEqual(other.offsets, [2, 2], "different OSM layer: stacked bridge stays below");
});

import { bridgeWays, deckProfile, groundRuns, mergeBridgeWays, osmDeckPolygons, OSM_DECK_MIN_TOP_M, profiledBridgeIndex } from "../lib/traffic-bridges";

/** I-75 over SR 83 (Monroe Co.) shape: 72 m span, abutments at 195.9 m, valley floor at 188.6 m (1 m DEM × 1.5 as drawn). */
const SPAN: LngLat[] = [[-83.9385, 33.0420], [-83.9385, 33.0420 + 72 / 110_574]];
const valley = (c: LngLat) => {
  const t = (c[1] - SPAN[0][1]) / (SPAN[1][1] - SPAN[0][1]);
  return 195.9 - 7.3 * Math.sin(Math.PI * Math.max(0, Math.min(1, t)));
};

test("bridgeWays: OSM bridges without a layer tag count as layer 1; negative layers and other classes are skipped", () => {
  const ways = bridgeWays(
    [
      feat(SPAN, { brunnel: "bridge", class: "motorway" }),
      feat(SPAN, { brunnel: "bridge", class: "motorway", layer: -1 }),
      feat(SPAN, { brunnel: "bridge", class: "rail", layer: 1 }),
      feat(SPAN, { class: "motorway" }),
    ],
    ["motorway"],
  );
  assert.equal(ways.length, 1);
  assert.equal(ways[0].layer, 1);
});

test("mergeBridgeWays joins a bridge cut at a tile edge (overlapping pieces) and drops a piece lying on another", () => {
  const n = (f: number): LngLat => [SPAN[0][0], SPAN[0][1] + (f * 72) / 110_574];
  const merged = mergeBridgeWays([
    { coords: [n(0), n(0.55)], cls: "motorway", layer: 1 },
    { coords: [n(0.5), n(1)], cls: "motorway", layer: 1 },
    { coords: [n(0.2), n(0.3)], cls: "motorway", layer: 1 },
    { coords: [n(0.5), n(1)], cls: "primary", layer: 1 },
  ]);
  assert.equal(merged.length, 2);
  const mw = merged.find((w) => w.cls === "motorway")!;
  assert.ok(Math.abs(mw.coords[0][1] - n(0)[1]) < 1e-9 && Math.abs(mw.coords[mw.coords.length - 1][1] - n(1)[1]) < 1e-9);
});

test("deckProfile: deck spans the valley abutment to abutment instead of draping into it", () => {
  const p = deckProfile({ coords: SPAN, cls: "motorway", layer: 1 }, valley);
  const tops = p.ground.map((g, i) => g + p.offsets[i]);
  assert.ok(Math.abs(tops[0] - 195.9) < 1e-6 && Math.abs(tops[tops.length - 1] - 195.9) < 1e-6);
  const mid = Math.floor(tops.length / 2);
  assert.ok(tops[mid] >= 195.9 - 1e-6, `mid-span top ${tops[mid]} sagged below the abutments`);
  assert.ok(p.offsets[mid] > 7, "mid-span sits > 7 m over the valley floor");
  assert.ok(Math.max(...p.offsets) <= BRIDGE_LAYER_M + 7.3 + 1e-6);
});

test("car lines ride the drawn OSM deck top and only their off-bridge parts stay draped", () => {
  const prof = deckProfile({ coords: SPAN, cls: "motorway", layer: 1 }, valley);
  const idx = profiledBridgeIndex([prof]);
  const car: LngLat[] = [[SPAN[0][0] + 3 / 93_000, SPAN[0][1] - 100 / 110_574], [SPAN[0][0] + 3 / 93_000, SPAN[1][1] + 100 / 110_574]];
  const b = bridgeLine(idx, car, valley);
  assert.ok(b.onBridge);
  b.coords.forEach((_, i) => {
    if (b.layers[i] > 0) {
      assert.ok(b.ground[i] + b.offsets[i] >= 195.9 - 0.5, `car top ${b.ground[i] + b.offsets[i]} below deck at vertex ${i}`);
    } else assert.equal(b.offsets[i], 0);
  });
  const runs = groundRuns(b);
  assert.equal(runs.length, 2, "approach and departure stay draped, the span is cut out");
});

test("osmDeckPolygons draws every slab of the span, never lower than OSM_DECK_MIN_TOP_M, in the given colour", () => {
  const prof = deckProfile({ coords: SPAN, cls: "motorway", layer: 1 }, valley);
  const slabs = osmDeckPolygons(prof, 15, "#cbd5e1", valley);
  assert.ok(slabs.length >= 72 / SLAB_STEP_M);
  assert.ok(slabs.every((s) => s.properties.height >= OSM_DECK_MIN_TOP_M && s.properties.color === "#cbd5e1"));
  assert.ok(slabs.every((s) => s.properties.base >= 0 && s.properties.base < s.properties.height));
});

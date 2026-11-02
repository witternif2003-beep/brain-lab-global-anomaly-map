import { test } from "node:test";
import assert from "node:assert/strict";
import { declutterMarkers } from "../../lib/ga-marker-declutter";

test("an overlapping lower-priority marker is dropped, a distant one is kept", () => {
  const shown = declutterMarkers([
    { item: "plane", x: 100, y: 100, half: 6 },
    { item: "tower", x: 104, y: 102, half: 6 },
    { item: "far", x: 200, y: 100, half: 6 },
  ]);
  assert.deepEqual([...shown].sort(), ["far", "plane"]);
});

test("keep markers are always shown and block others even when listed last", () => {
  const shown = declutterMarkers([
    { item: "signal", x: 50, y: 50, half: 4 },
    { item: "a1", x: 51, y: 50, half: 6, keep: true },
    { item: "a2", x: 52, y: 50, half: 6, keep: true },
  ]);
  assert.deepEqual([...shown].sort(), ["a1", "a2"]);
});

test("small allowed overlap: boxes touching by under 25% both stay", () => {
  const shown = declutterMarkers([
    { item: "a", x: 0, y: 0, half: 10 },
    { item: "b", x: 16, y: 0, half: 10 },
    { item: "c", x: 14, y: 0, half: 10 },
  ]);
  assert.deepEqual([...shown].sort(), ["a", "b"]);
});

test("a big marker placed first still blocks a small one in a neighbouring grid cell", () => {
  const shown = declutterMarkers([
    { item: "big", x: 30, y: 30, half: 30 },
    { item: "small", x: 52, y: 30, half: 3 },
  ]);
  assert.deepEqual([...shown].sort(), ["big"]);
});

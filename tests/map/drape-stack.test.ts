import { test } from "node:test";
import assert from "node:assert/strict";
import { drapeStackEnabled, drapeStackMoves } from "../../lib/map/drape-stack";

const apply = (layers: { id: string; type: string }[]) => {
  const out = [...layers];
  for (const [id, before] of drapeStackMoves(layers)) {
    const l = out.splice(out.findIndex((x) => x.id === id), 1)[0];
    out.splice(out.findIndex((x) => x.id === before), 0, l);
  }
  return out;
};

test("draped layers move below the first non-draped layer, keeping both groups' order and every layer", () => {
  const layers = [
    { id: "sat", type: "raster" }, { id: "b3d", type: "fill-extrusion" }, { id: "outline", type: "line" },
    { id: "labels", type: "symbol" }, { id: "roads", type: "line" }, { id: "dots", type: "circle" }, { id: "alerts", type: "fill" },
  ];
  const out = apply(layers);
  assert.deepEqual(out.map((l) => l.id), ["sat", "outline", "roads", "alerts", "b3d", "labels", "dots"]);
  assert.equal(out.length, layers.length);
  assert.deepEqual(drapeStackMoves(out), []);
});

test("no moves when already one stack or no non-draped layer", () => {
  assert.deepEqual(drapeStackMoves([{ id: "a", type: "raster" }, { id: "b", type: "symbol" }]), []);
  assert.deepEqual(drapeStackMoves([{ id: "a", type: "raster" }, { id: "b", type: "line" }]), []);
});

test("phones on by default; ?drapestack=off/on override", () => {
  assert.equal(drapeStackEnabled(true), true);
  assert.equal(drapeStackEnabled(true, "?drapestack=off"), false);
  assert.equal(drapeStackEnabled(false), false);
  assert.equal(drapeStackEnabled(false, "?drapestack=on"), true);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { lazyUrlAtlas } from "../lib/ga-marker-icons";
import { PRESSURE_ON, QUALITY_LATCH_RATIO } from "../lib/map/gpu-ledger";

test("atlas PNG data URL is encoded only when read, then cached", () => {
  let encodes = 0;
  const canvas = { toDataURL: () => { encodes++; return "data:image/png;base64,x"; } } as unknown as HTMLCanvasElement;
  const atlas = lazyUrlAtlas(canvas, { a: 1 });
  assert.equal(encodes, 0);
  assert.equal(atlas.canvas, canvas);
  assert.equal(atlas.url, "data:image/png;base64,x");
  assert.equal(atlas.url, "data:image/png;base64,x");
  assert.equal(encodes, 1);
});

test("quality latch engages before the pressure gate", () => {
  assert.ok(QUALITY_LATCH_RATIO < PRESSURE_ON);
  assert.ok(QUALITY_LATCH_RATIO > 0.5);
});

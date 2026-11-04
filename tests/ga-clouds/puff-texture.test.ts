import { test } from "node:test";
import assert from "node:assert/strict";
import { puffAlpha, PUFF_SIZE, PUFF_VARIANTS } from "../../lib/ga-clouds/puff-texture";

test("puffAlpha is opaque-ish in the middle and exactly zero at the sprite rim, so no square edge shows", () => {
  for (let k = 0; k < PUFF_VARIANTS; k++) {
    assert.ok(puffAlpha(k, 0.5, 0.52) > 0.5);
    for (let i = 0; i < PUFF_SIZE; i++) {
      const t = (i + 0.5) / PUFF_SIZE;
      for (const [u, v] of [[t, 0.002], [t, 0.998], [0.002, t], [0.998, t]]) assert.equal(puffAlpha(k, u, v), 0);
    }
  }
});

test("puffAlpha falls off smoothly (no step larger than 2% per texel along a radius)", () => {
  for (let k = 0; k < PUFF_VARIANTS; k++) {
    let prev = puffAlpha(k, 0.5, 0.5);
    for (let i = 1; i < PUFF_SIZE / 2; i++) {
      const a = puffAlpha(k, 0.5 + i / PUFF_SIZE, 0.5);
      assert.ok(Math.abs(a - prev) < 0.02, `variant ${k} texel ${i}`);
      prev = a;
    }
  }
});

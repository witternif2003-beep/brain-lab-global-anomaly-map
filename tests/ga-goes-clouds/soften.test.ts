import { test } from "node:test";
import assert from "node:assert/strict";
import { boxBlur, nightFactor, smooth } from "../../lib/ga-goes-clouds/soften";

test("smooth clamps to 0..1 with an S curve", () => {
  assert.equal(smooth(-1), 0);
  assert.equal(smooth(2), 1);
  assert.equal(smooth(0.5), 0.5);
  assert.ok(smooth(0.25) < 0.25);
});

test("nightFactor is 0 in daylight, 1 after civil twilight, linear between", () => {
  assert.equal(nightFactor(30), 0);
  assert.equal(nightFactor(-10), 1);
  assert.equal(nightFactor(0), 0.5);
});

test("boxBlur keeps total alpha on a flat field and spreads a hard step", () => {
  const w = 9, h = 3;
  const flat = new Float32Array(w * h).fill(100);
  assert.ok(boxBlur(flat, w, h, 2).every((v) => Math.abs(v - 100) < 1e-4));
  const step = new Float32Array(w * h).map((_, i) => (i % w < 4 ? 0 : 255));
  const out = boxBlur(step, w, h, 2);
  assert.equal(out[0], 0);
  assert.equal(out[w - 1], 255);
  assert.ok(out[3] > 0 && out[4] < 255);
});

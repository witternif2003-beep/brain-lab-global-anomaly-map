import { test } from "node:test";
import assert from "node:assert/strict";
import { densityPausedFor, FpsMeter, LOW_FPS } from "../lib/map/fps-watchdog";

const run = (meter: FpsMeter, frameMs: number, frames: number, t0 = 0) => {
  const out: number[] = [];
  for (let i = 0; i <= frames; i++) {
    const fps = meter.tick(t0 + i * frameMs);
    if (fps !== null) out.push(fps);
  }
  return out;
};

test("fps meter reports one sample per second at the real frame rate", () => {
  const at60 = run(new FpsMeter(), 1000 / 60, 120);
  assert.equal(at60.length, 2);
  assert.ok(Math.abs(at60[0] - 60) < 0.5);
  const at20 = run(new FpsMeter(), 50, 40);
  assert.ok(Math.abs(at20[0] - 20) < 0.5);
});

test("reset starts a fresh window", () => {
  const m = new FpsMeter();
  run(m, 50, 10);
  m.reset();
  assert.equal(m.tick(10_000), null);
});

test("density pauses only while moving below the threshold", () => {
  assert.equal(densityPausedFor(true, LOW_FPS - 1), true);
  assert.equal(densityPausedFor(true, LOW_FPS), false);
  assert.equal(densityPausedFor(false, 5), false);
  assert.equal(densityPausedFor(true, null), false);
});

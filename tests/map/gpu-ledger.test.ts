import { test } from "node:test";
import assert from "node:assert/strict";
import { LEDGER_SHARES, NO_SHED, ledgerState, lidarSliceCeiling, nextShed, sliceBytes } from "../../lib/map/gpu-ledger";

const MB = 1024 * 1024;

test("shares sum to the whole target and give a phone 96/192/128/96 MB", () => {
  assert.equal(Object.values(LEDGER_SHARES).reduce((a, b) => a + b, 0), 1);
  assert.deepEqual(sliceBytes(512 * MB), { telemetry: 96 * MB, map: 192 * MB, lidar: 128 * MB, reserve: 96 * MB });
});

test("pressure turns on at 90% and stays on until use falls below 75%", () => {
  assert.equal(ledgerState({ telemetry: 50 * MB, map: 300 * MB, lidar: 100 * MB }, 512 * MB).pressure, false);
  const on = ledgerState({ telemetry: 50 * MB, map: 300 * MB, lidar: 120 * MB }, 512 * MB);
  assert.equal(on.pressure, true);
  assert.equal(ledgerState({ telemetry: 50 * MB, map: 250 * MB, lidar: 100 * MB }, 512 * MB, true).pressure, true);
  assert.equal(ledgerState({ telemetry: 50 * MB, map: 200 * MB, lidar: 100 * MB }, 512 * MB, true).pressure, false);
});

test("a slice sheds when over its own share even without pressure, and other slices are untouched", () => {
  const s = ledgerState({ telemetry: 20 * MB, map: 200 * MB, lidar: 0 }, 512 * MB);
  assert.deepEqual(nextShed(NO_SHED, s), { telemetry: false, map: true });
});

test("shedding restores only below 75% of the slice", () => {
  const prev = { telemetry: true, map: false };
  assert.equal(nextShed(prev, ledgerState({ telemetry: 80 * MB, map: 0, lidar: 0 }, 512 * MB)).telemetry, true);
  assert.equal(nextShed(prev, ledgerState({ telemetry: 70 * MB, map: 0, lidar: 0 }, 512 * MB)).telemetry, false);
});

test("pressure sheds every slice", () => {
  assert.deepEqual(nextShed(NO_SHED, ledgerState({ telemetry: 10 * MB, map: 100 * MB, lidar: 400 * MB }, 512 * MB)), { telemetry: true, map: true });
});

test("LiDAR point ceiling is its slice divided by bytes per point", () => {
  assert.equal(lidarSliceCeiling(512 * MB, 9), Math.floor(128 * MB / 9));
  assert.equal(ledgerState({ telemetry: 0, map: 0, lidar: 0 }, 0).ratio, 0);
});

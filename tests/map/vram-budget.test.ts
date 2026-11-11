import { test } from "node:test";
import assert from "node:assert/strict";
import { drawingBufferBytes, LIDAR_BYTES_PER_POINT, LIDAR_MIN_POINTS, lidarPointBudget, vramTargetBytes } from "../../lib/map/vram-budget";
import { bytesPerPixel } from "../../lib/map/vram-meter";

const MB = 1024 * 1024;

test("lidarPointBudget keeps the 5M ceiling when memory allows and shrinks to what fits otherwise", () => {
  assert.equal(lidarPointBudget({ ceiling: 5_000_000, targetBytes: 1536 * MB, otherBytes: 300 * MB }), 5_000_000);
  const fit = lidarPointBudget({ ceiling: 5_000_000, targetBytes: 384 * MB, otherBytes: 300 * MB });
  assert.equal(fit, Math.floor((384 - 300 - 48) * MB / LIDAR_BYTES_PER_POINT));
  assert.equal(lidarPointBudget({ ceiling: 5_000_000, targetBytes: 256 * MB, otherBytes: 400 * MB }), LIDAR_MIN_POINTS);
  assert.equal(lidarPointBudget({ ceiling: 100_000, targetBytes: 256 * MB, otherBytes: 400 * MB }), 100_000);
});

test("targets drop in safe mode and drawing buffers count colour + depth-stencil per sample", () => {
  assert.ok(vramTargetBytes(true, true) < vramTargetBytes(true, false));
  assert.ok(vramTargetBytes(false, true) < vramTargetBytes(false, false));
  assert.equal(drawingBufferBytes(780, 1688), 780 * 1688 * 8);
  assert.equal(drawingBufferBytes(100, 100, 4), 100 * 100 * 8 * 4);
});

test("bytesPerPixel maps common WebGL internal formats", () => {
  assert.equal(bytesPerPixel(0x8058), 4);
  assert.equal(bytesPerPixel(0x8814), 16);
  assert.equal(bytesPerPixel(0x881a), 8);
  assert.equal(bytesPerPixel(0x8229), 1);
  assert.equal(bytesPerPixel(0x88f0), 4);
  assert.equal(bytesPerPixel(0x1234), 4);
});

import { lidarVramStats, VRAM_TARGET_MB } from '../../lib/map/vram-budget';

test('stats() reports LiDAR GPU memory, and the 9.65 M points measured downtown stay under 0.9 × the desktop target', () => {
  const s = lidarVramStats(9_651_869, VRAM_TARGET_MB.desktop * MB);
  assert.equal(s.pointCount, 9_651_869);
  assert.ok(Math.abs(s.loadedGB - (9_651_869 * LIDAR_BYTES_PER_POINT) / 1024 ** 3) < 1e-12);
  assert.equal(s.targetGB, 4);
  assert.ok(s.loadedGB <= 0.9 * s.targetGB);
  const full = lidarVramStats(40_000_000, VRAM_TARGET_MB.desktop * MB);
  assert.ok(full.loadedGB <= 0.9 * full.targetGB, `40 M points use ${full.loadedGB.toFixed(2)} GB`);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { cappedPixelRatio, LIDAR_CRASH_FLOOR, LIDAR_POINT_CEILING, lidarBudget, TOUCH_MAX_PIXEL_RATIO } from "../../lib/map/touch-gpu-budget";

test("touch devices cap the drawing-buffer pixel ratio; desktop keeps the device ratio", () => {
  assert.equal(cappedPixelRatio(3, true), TOUCH_MAX_PIXEL_RATIO);
  assert.equal(cappedPixelRatio(1.5, true), 1.5);
  assert.equal(cappedPixelRatio(3, false), 3);
  assert.equal(cappedPixelRatio(0, true), 1);
});

test("touch LiDAR budget downloads and caches less than desktop", () => {
  const t = lidarBudget(true);
  const d = lidarBudget(false);
  assert.ok(t.fetchParallel < d.fetchParallel && t.imageryTiles < d.imageryTiles);
});

test("with no recent crash every device draws up to the 5,000,000-point LiDAR ceiling", () => {
  assert.equal(LIDAR_POINT_CEILING, 5_000_000);
  for (const touch of [true, false]) {
    assert.equal(lidarBudget(touch).points, LIDAR_POINT_CEILING);
    assert.equal(lidarBudget(touch, 0).points, LIDAR_POINT_CEILING);
    assert.equal(lidarBudget(touch, false).points, LIDAR_POINT_CEILING);
  }
});

test("each recent crash halves the LiDAR point ceiling down to the 1,000,000 floor", () => {
  assert.equal(lidarBudget(true, 1).points, 2_500_000);
  assert.equal(lidarBudget(true, true).points, 2_500_000);
  assert.equal(lidarBudget(true, 2).points, 1_250_000);
  assert.equal(lidarBudget(true, 3).points, LIDAR_CRASH_FLOOR);
  assert.equal(lidarBudget(false, 20).points, LIDAR_CRASH_FLOOR);
  assert.equal(lidarBudget(true, -1).points, LIDAR_POINT_CEILING);
});

test("lidarBudget halves downloads and imagery cache in crash safe mode", () => {
  const t = lidarBudget(true, true);
  assert.ok(t.fetchParallel >= 1 && t.fetchParallel < lidarBudget(true).fetchParallel);
  assert.equal(t.imageryTiles, lidarBudget(true).imageryTiles / 2);
});

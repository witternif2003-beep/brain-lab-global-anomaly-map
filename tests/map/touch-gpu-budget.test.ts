import { test } from "node:test";
import assert from "node:assert/strict";
import { cappedPixelRatio, LIDAR_POINT_CEILING, lidarBudget, TOUCH_MAX_PIXEL_RATIO } from "../../lib/map/touch-gpu-budget";

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

test("every device, including crash safe mode, draws up to the 5,000,000-point LiDAR ceiling", () => {
  assert.equal(LIDAR_POINT_CEILING, 5_000_000);
  for (const touch of [true, false]) for (const safe of [false, true]) assert.equal(lidarBudget(touch, safe).points, LIDAR_POINT_CEILING);
});

test("lidarBudget halves downloads and imagery cache in crash safe mode", () => {
  const t = lidarBudget(true, true);
  assert.ok(t.fetchParallel >= 1 && t.fetchParallel < lidarBudget(true).fetchParallel);
  assert.equal(t.imageryTiles, lidarBudget(true).imageryTiles / 2);
});

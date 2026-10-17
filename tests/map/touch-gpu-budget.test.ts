import { test } from "node:test";
import assert from "node:assert/strict";
import { cappedPixelRatio, LIDAR_POINT_CEILING, lidarBudget, TOUCH_MAX_PIXEL_RATIO } from "../../lib/map/touch-gpu-budget";

test("touch devices cap the drawing-buffer pixel ratio; desktop keeps the device ratio", () => {
  assert.equal(cappedPixelRatio(3, true), TOUCH_MAX_PIXEL_RATIO);
  assert.equal(cappedPixelRatio(1.5, true), 1.5);
  assert.equal(cappedPixelRatio(3, false), 3);
  assert.equal(cappedPixelRatio(0, true), 1);
});

test("touch LiDAR budget is below the desktop budget on every axis", () => {
  const t = lidarBudget(true);
  const d = lidarBudget(false);
  assert.ok(t.points < d.points && t.fetchParallel < d.fetchParallel && t.imageryTiles < d.imageryTiles);
  assert.ok(t.points >= 1_000_000);
});

test("no device draws more than the 2,000,000-point LiDAR ceiling", () => {
  assert.equal(LIDAR_POINT_CEILING, 2_000_000);
  for (const touch of [true, false]) assert.ok(lidarBudget(touch).points <= LIDAR_POINT_CEILING);
});

test("lidarBudget halves points, downloads and imagery cache in crash safe mode", () => {
  const t = lidarBudget(true, true);
  assert.equal(t.points, lidarBudget(true).points / 2);
  assert.ok(t.fetchParallel >= 1 && t.fetchParallel < lidarBudget(true).fetchParallel);
  assert.equal(t.imageryTiles, lidarBudget(true).imageryTiles / 2);
});

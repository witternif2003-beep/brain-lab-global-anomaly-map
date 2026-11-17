import { test } from "node:test";
import assert from "node:assert/strict";
import { cappedPixelRatio, LIDAR_CRASH_FLOOR, LIDAR_DESKTOP_POINT_CEILING, LIDAR_POINT_CEILING, lidarBudget, TOUCH_MAX_PIXEL_RATIO } from "../../lib/map/touch-gpu-budget";

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

test("with no recent crash touch devices draw up to 20,000,000 LiDAR points and desktops up to 40,000,000", () => {
  assert.equal(LIDAR_POINT_CEILING, 20_000_000);
  assert.equal(LIDAR_DESKTOP_POINT_CEILING, 80_000_000);
  for (const [touch, ceiling] of [[true, LIDAR_POINT_CEILING], [false, LIDAR_DESKTOP_POINT_CEILING]] as const) {
    assert.equal(lidarBudget(touch).points, ceiling);
    assert.equal(lidarBudget(touch, 0).points, ceiling);
    assert.equal(lidarBudget(touch, false).points, ceiling);
  }
});

test("each recent crash halves the LiDAR point ceiling down to the 1,000,000 floor", () => {
  assert.equal(lidarBudget(true, 1).points, 10_000_000);
  assert.equal(lidarBudget(true, true).points, 10_000_000);
  assert.equal(lidarBudget(true, 2).points, 5_000_000);
  assert.equal(lidarBudget(true, 3).points, 2_500_000);
  assert.equal(lidarBudget(true, 4).points, 1_250_000);
  assert.equal(lidarBudget(true, 5).points, LIDAR_CRASH_FLOOR);
  assert.equal(lidarBudget(false, 20).points, LIDAR_CRASH_FLOOR);
  assert.equal(lidarBudget(true, -1).points, LIDAR_POINT_CEILING);
});

test("lidarBudget halves downloads and imagery cache in crash safe mode", () => {
  const t = lidarBudget(true, true);
  assert.ok(t.fetchParallel >= 1 && t.fetchParallel < lidarBudget(true).fetchParallel);
  assert.equal(t.imageryTiles, lidarBudget(true).imageryTiles / 2);
});

test("marker canvas uses the full 3× ratio on touch devices until a recent GPU crash", async () => {
  const { markerPixelRatio, TOUCH_FULL_PIXEL_RATIO } = await import("../../lib/map/touch-gpu-budget");
  assert.equal(markerPixelRatio(3, true), TOUCH_FULL_PIXEL_RATIO);
  assert.equal(markerPixelRatio(3, true, 1), TOUCH_MAX_PIXEL_RATIO);
  assert.equal(markerPixelRatio(4, true), 3);
  assert.equal(markerPixelRatio(2, true), 2);
  assert.equal(markerPixelRatio(4, false), 4);
  assert.equal(markerPixelRatio(0, true), 1);
});

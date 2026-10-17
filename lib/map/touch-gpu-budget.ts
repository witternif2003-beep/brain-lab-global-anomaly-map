/** Phone/tablet GPU memory budget shared by the GodsEYE map canvases and the LiDAR layer. */
export const TOUCH_MAX_PIXEL_RATIO = 2;

export const isTouchDevice = (): boolean => typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

/** Drawing-buffer pixel ratio: the device ratio, capped on touch devices. */
export function cappedPixelRatio(devicePixelRatio: number, touch: boolean): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  return touch ? Math.min(TOUCH_MAX_PIXEL_RATIO, dpr) : dpr;
}

export interface LidarBudget {
  points: number;
  fetchParallel: number;
  imageryTiles: number;
}

/** Hard ceiling on LiDAR points drawn at once on any device. */
export const LIDAR_POINT_CEILING = 5_000_000;

const LIDAR_TOUCH: LidarBudget = { points: LIDAR_POINT_CEILING, fetchParallel: 3, imageryTiles: 48 };
const LIDAR_DESKTOP: LidarBudget = { points: LIDAR_POINT_CEILING, fetchParallel: 6, imageryTiles: 96 };

/** Per-device LiDAR budget; every device draws up to the ceiling. `safe` (a recent crash on this device) halves downloads and the imagery cache. */
export function lidarBudget(touch: boolean, safe = false): LidarBudget {
  const b = touch ? LIDAR_TOUCH : LIDAR_DESKTOP;
  return safe ? { points: b.points, fetchParallel: Math.max(1, Math.floor(b.fetchParallel / 2)), imageryTiles: b.imageryTiles / 2 } : b;
}

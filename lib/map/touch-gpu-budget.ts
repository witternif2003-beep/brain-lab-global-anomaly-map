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

/** Lowest point ceiling after repeated crashes; still well above LIDAR_MIN_POINTS so buildings stay readable. */
export const LIDAR_CRASH_FLOOR = 1_000_000;

/**
 * Per-device LiDAR budget. With no recent crash every device draws up to the 5,000,000 ceiling. Each crash or GPU
 * context loss on this device in the last 30 min halves the ceiling (5M → 2.5M → 1.25M → 1M floor), halves downloads
 * and the imagery cache, so a phone that ran out of memory comes back lighter instead of crashing again.
 */
export function lidarBudget(touch: boolean, crashes: number | boolean = 0): LidarBudget {
  const b = touch ? LIDAR_TOUCH : LIDAR_DESKTOP;
  const n = Math.max(0, Math.floor(Number(crashes)));
  if (!n) return b;
  return {
    points: Math.max(LIDAR_CRASH_FLOOR, Math.floor(b.points / 2 ** n)),
    fetchParallel: Math.max(1, Math.floor(b.fetchParallel / 2)),
    imageryTiles: b.imageryTiles / 2,
  };
}

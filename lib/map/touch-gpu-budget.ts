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
export const LIDAR_POINT_CEILING = 2_000_000;

const LIDAR_TOUCH: LidarBudget = { points: 1_500_000, fetchParallel: 3, imageryTiles: 48 };
const LIDAR_DESKTOP: LidarBudget = { points: LIDAR_POINT_CEILING, fetchParallel: 6, imageryTiles: 96 };

export const lidarBudget = (touch: boolean): LidarBudget => (touch ? LIDAR_TOUCH : LIDAR_DESKTOP);

/** GPU memory budget for the GodsEYE map: how much the LiDAR layer may use given what everything else already holds. */

/** LiDAR GPU bytes per point: Float32 xyz position (12) + Uint8 rgb colour (3). */
export const LIDAR_BYTES_PER_POINT = 15;
/** Never plan fewer points than this, so the layer still shows something under pressure. */
export const LIDAR_MIN_POINTS = 250_000;
const MB = 1024 * 1024;

/**
 * Working GPU memory targets per device class. These are this app's own engineering limits, not vendor-published figures:
 * browsers do not expose GPU memory, and iOS Safari reloads tabs under memory pressure without a documented threshold.
 * Safe mode (a crash or context loss in the last 30 min) lowers the target further.
 */
export const VRAM_TARGET_MB = { touch: 512, touchSafe: 320, desktop: 2048, desktopSafe: 1024 } as const;

export function vramTargetBytes(touch: boolean, safe: boolean): number {
  const mb = touch ? (safe ? VRAM_TARGET_MB.touchSafe : VRAM_TARGET_MB.touch) : safe ? VRAM_TARGET_MB.desktopSafe : VRAM_TARGET_MB.desktop;
  return mb * MB;
}

/** Bytes of a drawing buffer: RGBA8 colour + 24/8 depth-stencil per sample. */
export function drawingBufferBytes(width: number, height: number, samples = 1): number {
  return Math.max(0, width) * Math.max(0, height) * 8 * Math.max(1, samples);
}

export interface PointBudgetInput {
  ceiling: number;
  targetBytes: number;
  /** Measured GPU bytes held by everything except the LiDAR points. */
  otherBytes: number;
  /** Headroom kept free for tile uploads and transient buffers. */
  reserveBytes?: number;
  bytesPerPoint?: number;
}

/** Points the LiDAR layer may hold: what fits in the target after other allocations and the reserve, clamped to [LIDAR_MIN_POINTS, ceiling]. */
export function lidarPointBudget({ ceiling, targetBytes, otherBytes, reserveBytes = 48 * MB, bytesPerPoint = LIDAR_BYTES_PER_POINT }: PointBudgetInput): number {
  const free = targetBytes - otherBytes - reserveBytes;
  const fit = Math.floor(free / bytesPerPoint);
  return Math.max(Math.min(LIDAR_MIN_POINTS, ceiling), Math.min(ceiling, Number.isFinite(fit) ? fit : ceiling));
}

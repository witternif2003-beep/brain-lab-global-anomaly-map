/** Phone/tablet GPU memory budget shared by the GodsEYE map canvases and the LiDAR layer. */
export const TOUCH_MAX_PIXEL_RATIO = 2;

export const isTouchDevice = (): boolean => typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;

/**
 * Every device renders at maximum quality (the user's choice, Nov 2026: "maximum everywhere") until the memory latch engages. `?quality=safe` restores the reduced
 * phone settings and the automatic step-downs after a crash or under GPU-memory pressure. Memory-only optimisations that do not
 * change what is drawn keep using isTouchDevice().
 */
export const QUALITY_LATCH_KEY = 'ga-quality-latch';
let latched = false;
const sessionLatch = (): boolean => {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(QUALITY_LATCH_KEY) === '1';
  } catch {
    return false;
  }
};
/** Whether the memory latch has engaged in this tab (kept in sessionStorage so a crash reload starts latched). */
export const qualityLatchEngaged = (): boolean => latched || sessionLatch();
/**
 * One-way latch: once measured GPU memory reaches the pressure threshold (or the page restarts after a crash) the reduced settings
 * and automatic step-downs switch on and stay on until the tab closes, instead of toggling. `?quality=max` disables the latch.
 */
export function engageQualityLatch(reason: string, search = typeof location !== 'undefined' ? location.search : ''): boolean {
  if (new URLSearchParams(search).get('quality') === 'max') return false;
  const first = !qualityLatchEngaged();
  latched = true;
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(QUALITY_LATCH_KEY, '1');
  } catch { /* storage unavailable: latch holds for this page load */ }
  if (typeof window !== 'undefined' && first) window.__gaQualityLatch = { engaged: true, reason, at: new Date().toISOString() };
  return first;
}
/** Test hook: clears the in-memory latch. */
export const resetQualityLatch = (): void => { latched = false; };
export const safeQualityRequested = (search = typeof location !== 'undefined' ? location.search : ''): boolean => {
  const q = new URLSearchParams(search).get('quality');
  return q !== 'max' && (q === 'safe' || qualityLatchEngaged());
};
/** Touch flag for quality decisions: true only on a touch device with `?quality=safe`. */
export const qualityTouch = (): boolean => isTouchDevice() && safeQualityRequested();
/** Crash count for quality step-downs: ignored unless `?quality=safe`. */
export const qualityCrashes = (crashes: number): number => (safeQualityRequested() ? crashes : 0);

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

/** Touch devices with no recent GPU crash draw markers and labels at up to this ratio (iPhone Pro screens are 3×). */
export const TOUCH_FULL_PIXEL_RATIO = 3;

/** Marker-canvas pixel ratio: full device ratio (≤3) on touch devices, falling back to the 2× cap after a recent GPU crash. */
export function markerPixelRatio(devicePixelRatio: number, touch: boolean, crashes = 0): number {
  const dpr = devicePixelRatio > 0 ? devicePixelRatio : 1;
  if (!touch) return dpr;
  return Math.min(crashes > 0 ? TOUCH_MAX_PIXEL_RATIO : TOUCH_FULL_PIXEL_RATIO, dpr);
}

/** WebGL context attributes the marker and simulated-traffic deck.gl canvases request. */
export interface OverlayContextAttributes { preserveDrawingBuffer: boolean; antialias: boolean }

/**
 * luma.gl creates deck.gl canvases with `preserveDrawingBuffer: true` and the browser's default `antialias: true` (multisampled).
 * On touch devices both overlay canvases instead request a single-sample buffer that the compositor may swap, so each holds one
 * colour + depth-stencil buffer rather than a multisampled set plus a resolve copy. Every marker is still drawn; exports read
 * the canvas right after its frame (onNextGaDeckFrame), which does not need a preserved buffer. `?overlaybuf=default` restores luma.gl's defaults.
 */
export function overlayContextAttributes(touch: boolean, search = ''): OverlayContextAttributes | null {
  if (!touch || new URLSearchParams(search).get('overlaybuf') === 'default') return null;
  return { preserveDrawingBuffer: false, antialias: !safeQualityRequested(search) };
}

/**
 * Scale for the offscreen WebGL sky photo relative to the sky canvas. Touch devices render it at no more than the 2× cap
 * and stretch it onto the full-density canvas (the catalogue stars stay full density), so the preserveDrawingBuffer sky
 * context holds 4/9 of the pixels on a 3× iPhone.
 */
export function skyRenderScale(canvasDpr: number, touch: boolean): number {
  const dpr = Number.isFinite(canvasDpr) && canvasDpr > 0 ? canvasDpr : 1;
  return touch ? Math.min(1, TOUCH_MAX_PIXEL_RATIO / dpr) : 1;
}

/** Hard ceiling on LiDAR points drawn at once on touch devices. */
export const LIDAR_POINT_CEILING = 20_000_000;
/** Desktop ceiling; the GPU-memory target usually stops loading first. */
export const LIDAR_DESKTOP_POINT_CEILING = 80_000_000;

const LIDAR_TOUCH: LidarBudget = { points: LIDAR_POINT_CEILING, fetchParallel: 3, imageryTiles: 48 };
const LIDAR_DESKTOP: LidarBudget = { points: LIDAR_DESKTOP_POINT_CEILING, fetchParallel: 8, imageryTiles: 128 };

/** Lowest point ceiling after repeated crashes; still well above LIDAR_MIN_POINTS so buildings stay readable. */
export const LIDAR_CRASH_FLOOR = 1_000_000;

/**
 * Per-device LiDAR budget. With no recent crash every device draws up to the 20,000,000 ceiling (lower if the GPU-memory target is reached first). Each crash or GPU
 * context loss on this device in the last 30 min halves the ceiling (20M → 10M → 5M → 2.5M → 1.25M → 1M floor), halves downloads
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

declare global {
  interface Window { __gaQualityLatch?: { engaged: boolean; reason: string; at: string } }
}

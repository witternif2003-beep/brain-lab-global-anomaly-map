/** Lifted GOES cloud sheet: request box, tiling and height (pure helpers). */

const R = 6_378_137;
const RAD = Math.PI / 180;
export const mercX = (lng: number) => R * lng * RAD;
export const mercY = (lat: number) => R * Math.log(Math.tan(Math.PI / 4 + (lat * RAD) / 2));
export const latOfMercY = (y: number) => (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) / RAD;

export interface SheetBox {
  w: number;
  s: number;
  e: number;
  n: number;
  /** Image size requested from the WMS, at the band's native pixel size (capped at `maxPx`). */
  width: number;
  height: number;
  /** Cells per side the image is cut into, so each flat quad stays close to the curved Earth. */
  grid: number;
}

/**
 * Box around the view centre (bounds clipped to ±`maxHalfDeg` latitude, so a pitched view's horizon doesn't blow up the
 * request), sized so one image pixel is one native satellite pixel at the centre latitude.
 */
export function sheetBox(
  center: { lng: number; lat: number },
  view: { w: number; s: number; e: number; n: number },
  km: number,
  maxHalfDeg = 3,
  maxPx = 2048,
  cellKm = 100,
): SheetBox {
  const lat = Math.max(-80, Math.min(80, center.lat));
  const halfLng = maxHalfDeg / Math.max(0.2, Math.cos(lat * RAD));
  const s = Math.max(-80, lat - maxHalfDeg, Math.min(view.s, view.n));
  const n = Math.min(80, lat + maxHalfDeg, Math.max(view.s, view.n));
  const w = Math.max(center.lng - halfLng, view.w);
  const e = Math.min(center.lng + halfLng, view.e);
  const pxM = (km * 1000) / Math.cos(lat * RAD);
  const width = Math.max(16, Math.min(maxPx, Math.round((mercX(e) - mercX(w)) / pxM)));
  const height = Math.max(16, Math.min(maxPx, Math.round((mercY(n) - mercY(s)) / pxM)));
  const spanKm = Math.max((e - w) * 111.32 * Math.cos(lat * RAD), (n - s) * 110.57);
  const grid = Math.max(1, Math.min(6, Math.ceil(spanKm / cellKm)));
  return { w, s, e, n, width, height, grid };
}

/** True when the view's centre box still lies inside the box already drawn. */
export function sheetCovers(box: Pick<SheetBox, 'w' | 's' | 'e' | 'n'>, want: Pick<SheetBox, 'w' | 's' | 'e' | 'n'>): boolean {
  return want.w >= box.w && want.e <= box.e && want.s >= box.s && want.n <= box.n;
}

export const SHEET_DEFAULT_BASE_M = 1500;

/** Sheet height: median of the lowest METAR cloud bases (m above ground), clamped to 600–3,000 m; 1,500 m with none. */
export function sheetAltitudeM(basesM: number[]): number {
  const v = basesM.filter((b) => Number.isFinite(b) && b > 0).sort((a, b) => a - b);
  if (!v.length) return SHEET_DEFAULT_BASE_M;
  const mid = v.length >> 1;
  const median = v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
  return Math.round(Math.max(600, Math.min(3000, median)));
}

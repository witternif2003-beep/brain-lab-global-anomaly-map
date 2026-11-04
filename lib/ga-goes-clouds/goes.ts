/** NOAA nowCOAST GOES East/West imagery → cloud-only tiles (pure helpers). */

export type GoesKind = 'vis' | 'ir';

export interface GoesBand {
  wms: string;
  label: string;
  /** Native pixel size at the sub-satellite point, km (nowCOAST layer abstract). */
  km: number;
  maxzoom: number;
  /** Grey level ramp mapped to cloud opacity 0 → 1. */
  lo: number;
  hi: number;
}

export const GOES_WMS = 'https://nowcoast.noaa.gov/geoserver/satellite/wms';
export const GOES_BANDS: Record<GoesKind, GoesBand> = {
  vis: { wms: 'goes_visible_imagery', label: 'GOES visible, band 2 (0.64 µm)', km: 0.5, maxzoom: 8, lo: 95, hi: 190 },
  ir: { wms: 'goes_longwave_imagery', label: 'GOES longwave infrared, band 14 (11.2 µm)', km: 2, maxzoom: 7, lo: 120, hi: 185 },
};

/** Web Mercator bbox (minX,minY,maxX,maxY metres) of an XYZ tile. */
export function tileBbox3857(z: number, x: number, y: number): [number, number, number, number] {
  const world = 2 * Math.PI * 6_378_137;
  const size = world / 2 ** z;
  const minX = -world / 2 + x * size;
  const maxY = world / 2 - y * size;
  return [minX, maxY - size, minX + size, maxY];
}

export function goesTileUrl(kind: GoesKind, z: number, x: number, y: number, time: string): string {
  const q = new URLSearchParams({
    service: 'WMS', version: '1.3.0', request: 'GetMap', layers: GOES_BANDS[kind].wms, styles: '', format: 'image/png',
    transparent: 'true', crs: 'EPSG:3857', bbox: tileBbox3857(z, x, y).join(','), width: '256', height: '256', time,
  });
  return `${GOES_WMS}?${q}`;
}

/** WMS GetMap for an arbitrary EPSG:3857 box and image size. */
export function goesBoxUrl(kind: GoesKind, bbox3857: [number, number, number, number], width: number, height: number, time: string): string {
  const q = new URLSearchParams({
    service: 'WMS', version: '1.3.0', request: 'GetMap', layers: GOES_BANDS[kind].wms, styles: '', format: 'image/png',
    transparent: 'true', crs: 'EPSG:3857', bbox: bbox3857.join(','), width: String(width), height: String(height), time,
  });
  return `${GOES_WMS}?${q}`;
}

/** Latest scan time per WMS layer, from the GetCapabilities `time` dimension default. */
export function latestScanTimes(xml: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /<Name>(goes_[a-z_]+)<\/Name>[\s\S]*?<Dimension name="time" default="([^"]+)"/g;
  for (let m = re.exec(xml); m; m = re.exec(xml)) out[m[1]] ??= m[2];
  return out;
}

/**
 * Grey satellite pixels → white cloud with opacity from brightness, so the ground below stays visible. Visible
 * brightness is divided by the sine of the sun's altitude (floored at 0.2) so the ramp holds from morning to noon.
 * Returns the fraction of pixels drawn as cloud (opacity > 0).
 */
export function cloudAlphaInPlace(px: Uint8ClampedArray, band: Pick<GoesBand, 'lo' | 'hi'>, sunGain = 1): number {
  let cloudy = 0;
  const n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) {
    const l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) * sunGain;
    const t = Math.max(0, Math.min(1, (l - band.lo) / (band.hi - band.lo)));
    const v = Math.round(214 + 41 * t);
    px[i] = v;
    px[i + 1] = v;
    px[i + 2] = Math.min(255, v + 6);
    px[i + 3] = Math.round(255 * Math.pow(t, 0.8) * (px[i + 3] / 255));
    if (px[i + 3] > 0) cloudy++;
  }
  return n ? cloudy / n : 0;
}

export const sunGainFor = (sunAltDeg: number) => 1 / Math.max(0.2, Math.sin((Math.max(0, sunAltDeg) * Math.PI) / 180));

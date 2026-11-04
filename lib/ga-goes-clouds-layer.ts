import type { Map as MapLibreMap } from 'maplibre-gl';
import { GOES_BANDS, GOES_WMS, cloudAlphaInPlace, latestScanTimes, sunGainFor, type GoesKind } from './ga-goes-clouds/goes';
import { coverAt, type CloudTopGrid } from './ga-goes-clouds/cloud-tops';
import { boxBlur, nightFactor, smooth } from './ga-goes-clouds/soften';
import { setGaDeckCloudSheet } from './ga-deck-overlay';
import { reportGaFeed } from './ga-live-status';
import { subsolarPoint, sunAltitudeDeg } from './terminator/solar';

const POLL_MS = 60_000;
/** Visible imagery is used while the sun is this high over the box centre; infrared otherwise. */
const VIS_MIN_SUN_DEG = 8;
const DOCS = 'https://nowcoast.noaa.gov/';
const TOPS_DOCS = 'https://registry.opendata.aws/noaa-goes/';
const MAX_PX = 2048;
/** Sheet opacity fades to zero over this many degrees inside the box edge, so it never ends in a hard line. */
const EDGE_FEATHER_DEG = 0.35;
/** Same colours as the radar puffs (lib/ga-clouds/cloud-puffs.ts), so the two layers read as one cloud deck. */
const DAY_RGB = [255, 255, 255];
const NIGHT_RGB = [172, 186, 212];
const BLUR_PX = 2;

interface TopsPayload { grid?: CloudTopGrid; scanStart?: string; scanEnd?: string; file?: string; measuredVertices?: number; minM?: number | null; maxM?: number | null; error?: string }

const bound = new WeakSet<MapLibreMap>();
const drawn = new WeakMap<MapLibreMap, string>();

function activeKind(grid: CloudTopGrid): GoesKind {
  const { w, s, e, n } = grid.box;
  return sunAltitudeDeg(subsolarPoint(new Date()), (w + e) / 2, (s + n) / 2) >= VIS_MIN_SUN_DEG ? 'vis' : 'ir';
}

/** Satellite image of the whole box at the band's native pixel size, in lon/lat (CRS:84) so it maps linearly onto the mesh. */
function imageUrl(kind: GoesKind, grid: CloudTopGrid, time: string): { url: string; width: number; height: number } {
  const { w, s, e, n } = grid.box;
  const km = GOES_BANDS[kind].km;
  const lat = (s + n) / 2;
  const width = Math.min(MAX_PX, Math.round(((e - w) * 111.32 * Math.cos((lat * Math.PI) / 180)) / km));
  const height = Math.min(MAX_PX, Math.round(((n - s) * 110.57) / km));
  const q = new URLSearchParams({
    service: 'WMS', version: '1.3.0', request: 'GetMap', layers: GOES_BANDS[kind].wms, styles: '', format: 'image/png',
    transparent: 'true', crs: 'CRS:84', bbox: [w, s, e, n].join(','), width: String(width), height: String(height), time,
  });
  return { url: `${GOES_WMS}?${q}`, width, height };
}

/** Satellite brightness → cloud opacity, kept only where the cloud-top product found good-quality cloud. */
export async function cloudTexture(kind: GoesKind, grid: CloudTopGrid, time: string): Promise<{ canvas: HTMLCanvasElement; cloudy: number }> {
  const { url } = imageUrl(kind, grid, time);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`GOES image HTTP ${r.status}`);
  const bmp = await createImageBitmap(await r.blob());
  const canvas = document.createElement('canvas');
  canvas.width = bmp.width;
  canvas.height = bmp.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2d canvas unavailable');
  ctx.drawImage(bmp, 0, 0);
  bmp.close();
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { w, s, e, n } = grid.box;
  const gain = kind === 'vis' ? sunGainFor(sunAltitudeDeg(subsolarPoint(new Date(time)), (w + e) / 2, (s + n) / 2)) : 1;
  cloudAlphaInPlace(img.data, GOES_BANDS[kind], gain);
  const W = canvas.width;
  const H = canvas.height;
  const alpha = new Float32Array(W * H);
  const fx = EDGE_FEATHER_DEG / (e - w);
  const fy = EDGE_FEATHER_DEG / (n - s);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / Math.max(1, W - 1);
      const v = y / Math.max(1, H - 1);
      const edge = smooth(Math.min(u, 1 - u) / fx) * smooth(Math.min(v, 1 - v) / fy);
      alpha[y * W + x] = img.data[(y * W + x) * 4 + 3] * coverAt(grid, x, y, W, H) * edge;
    }
  }
  const soft = boxBlur(boxBlur(alpha, W, H, BLUR_PX), W, H, BLUR_PX);
  const night = nightFactor(sunAltitudeDeg(subsolarPoint(new Date(time)), (w + e) / 2, (s + n) / 2));
  const rgb = DAY_RGB.map((d, i) => Math.round(d + (NIGHT_RGB[i] - d) * night));
  let cloudy = 0;
  for (let i = 0; i < W * H; i++) {
    img.data[i * 4] = rgb[0];
    img.data[i * 4 + 1] = rgb[1];
    img.data[i * 4 + 2] = rgb[2];
    img.data[i * 4 + 3] = Math.round(soft[i]);
    if (img.data[i * 4 + 3] > 0) cloudy++;
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, cloudy: cloudy / (canvas.width * canvas.height) };
}

function report(map: MapLibreMap, detail: string, updatedAt: string | null, error: string | null, count: number | null) {
  reportGaFeed(map, { id: 'goes-clouds', label: 'Satellite clouds (NOAA GOES)', color: '#f8fafc', count, detail, updatedAt, sourceUrl: DOCS, error });
}

/**
 * Latest GOES-19 cloud image from NOAA nowCOAST (visible by day, infrared at night) over all of Georgia, lifted onto
 * one seamless mesh at the GOES-19 ABI cloud-top heights for the same scan time, parallax-corrected; refreshed per scan.
 */
export function addGoesCloudLayer(map: MapLibreMap): void {
  if (bound.has(map)) return;
  bound.add(map);
  const poll = async () => {
    try {
      const [capsRes, topsRes] = await Promise.all([fetch(`${GOES_WMS}?service=WMS&request=GetCapabilities&version=1.3.0`), fetch('/api/ga-cloud-tops')]);
      if (!capsRes.ok) throw new Error(`nowCOAST capabilities HTTP ${capsRes.status}`);
      const tops = (await topsRes.json()) as TopsPayload;
      if (!topsRes.ok || !tops.grid) throw new Error(tops.error ?? `cloud-top heights HTTP ${topsRes.status}`);
      const grid = tops.grid;
      const kind = activeKind(grid);
      const time = latestScanTimes(await capsRes.text())[GOES_BANDS[kind].wms];
      if (!time) throw new Error('no scan time in nowCOAST capabilities');
      const key = `${kind}|${time}|${tops.file}`;
      if (drawn.get(map) !== key) {
        const { canvas, cloudy } = await cloudTexture(kind, grid, time);
        setGaDeckCloudSheet(map, { grid, texture: canvas });
        drawn.set(map, key);
        const b = GOES_BANDS[kind];
        const range = tops.minM != null && tops.maxM != null ? `${Math.round(tops.minM).toLocaleString()}–${Math.round(tops.maxM).toLocaleString()} m` : 'none';
        report(map,
          `${b.label} image (${b.km} km pixels, scan ${time}) placed at GOES-19 cloud-top height (10 km product, scan ${tops.scanStart ?? '?'}; tops ${range} above sea level), moved back along the satellite's line of sight to remove parallax. ${Math.round(cloudy * 100)}% of the Georgia box is cloud. Cloud bases are not measured by the satellite. Heights: ${TOPS_DOCS}`,
          tops.scanEnd ?? time, null, tops.measuredVertices ?? null);
      }
    } catch (err) {
      report(map, 'GOES-19 image at GOES-19 cloud-top height', null, err instanceof Error ? err.message : String(err), null);
    }
  };
  void poll();
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void poll();
  }, POLL_MS);
  map.once('remove', () => window.clearInterval(timer));
}

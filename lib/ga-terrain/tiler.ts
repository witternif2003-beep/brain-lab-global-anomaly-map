/** Georgia 1 m terrain: renders Terrarium PNG tiles from USGS 3DEP 1 m GeoTIFFs, filling gaps from AWS Terrain Tiles. */
import { fromUrl, type GeoTIFF } from 'geotiff';
import { decode, encode } from 'fast-png';
import { lonLatConverter } from './crs';
import index from './sources.json';

export const TILE_SIZE = 256;
/** Below z12 a tile pixel is >30 m, coarser than the smallest 1 m overview; AWS 10 m tiles are served instead. */
export const GA_TERRAIN_MIN_Z = 12;
/** z17 is ≈1.0 m per pixel at Georgia's latitude (30.4°–35.0° N). */
export const GA_TERRAIN_MAX_Z = 17;
export const AWS_MAX_Z = 15;
export const AWS_TERRARIUM = (z: number, x: number, y: number) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;
const EARTH_CIRCUMFERENCE = 2 * Math.PI * 6378137;
const NODATA_BELOW = -1e5;

export interface DemSource {
  p: string; e: number; x0: number; y0: number; rx: number; ry: number;
  w: number; h: number; l: number; n: number | null; pri: number; bb: [number, number, number, number];
}
export interface TerrainIndex { generatedAt: string; base: string; gaBbox: [number, number, number, number]; groups: string[]; sources: DemSource[] }

export const TERRAIN_INDEX = index as unknown as TerrainIndex;

export function tileBounds(z: number, x: number, y: number): [number, number, number, number] {
  const n = 2 ** z;
  const lat = (t: number) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * t) / n))) * 180) / Math.PI;
  return [(x / n) * 360 - 180, lat(y + 1), ((x + 1) / n) * 360 - 180, lat(y)];
}

/** Lon/lat of each pixel centre, row-major. */
export function pixelLonLats(z: number, x: number, y: number, size = TILE_SIZE): Float64Array {
  const n = 2 ** z * size;
  const out = new Float64Array(size * size * 2);
  for (let r = 0; r < size; r++) {
    const lat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (y * size + r + 0.5)) / n))) * 180) / Math.PI;
    for (let c = 0; c < size; c++) {
      const i = (r * size + c) * 2;
      out[i] = ((x * size + c + 0.5) / n) * 360 - 180;
      out[i + 1] = lat;
    }
  }
  return out;
}

export function groundResolution(z: number, lat: number, size = TILE_SIZE): number {
  return (EARTH_CIRCUMFERENCE * Math.cos((lat * Math.PI) / 180)) / (size * 2 ** z);
}

/** Coarsest overview whose pixels are no larger than the output pixel. */
export function overviewLevel(sourceRes: number, outRes: number, levels: number): number {
  let l = 0;
  while (l + 1 < levels && sourceRes * 2 ** (l + 1) <= outRes) l++;
  return l;
}

const intersects = (a: readonly number[], b: readonly number[]) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

export function inGeorgiaBbox(bounds: readonly number[], idx = TERRAIN_INDEX): boolean {
  return intersects(bounds, idx.gaBbox);
}

/** Sources overlapping the tile, highest priority (S1M, then newest project) first. */
export function candidateSources(bounds: readonly number[], idx = TERRAIN_INDEX): DemSource[] {
  return idx.sources.filter((s) => intersects(s.bb, bounds)).sort((a, b) => a.pri - b.pri);
}

export function encodeTerrarium(h: number, out: Uint8Array, i: number): void {
  const v = Math.min(Math.max(h + 32768, 0), 65535.99609375);
  const whole = Math.floor(v);
  out[i] = whole >> 8;
  out[i + 1] = whole & 255;
  out[i + 2] = Math.floor((v - whole) * 256);
  out[i + 3] = 255;
}

export const decodeTerrarium = (r: number, g: number, b: number) => r * 256 + g + b / 256 - 32768;

/** Bilinear sample of a raster window; falls back to the nearest valid neighbour at nodata edges. */
export function sampleBilinear(data: ArrayLike<number>, w: number, h: number, fx: number, fy: number): number | null {
  if (fx < -0.5 || fy < -0.5 || fx > w - 0.5 || fy > h - 0.5) return null;
  const x0 = Math.max(0, Math.min(w - 1, Math.floor(fx)));
  const y0 = Math.max(0, Math.min(h - 1, Math.floor(fy)));
  const x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
  const tx = Math.max(0, Math.min(1, fx - x0)), ty = Math.max(0, Math.min(1, fy - y0));
  const v = [data[y0 * w + x0], data[y0 * w + x1], data[y1 * w + x0], data[y1 * w + x1]];
  const wt = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
  let sum = 0, ws = 0;
  for (let k = 0; k < 4; k++) if (v[k] > NODATA_BELOW && Number.isFinite(v[k])) { sum += v[k] * wt[k]; ws += wt[k]; }
  return ws > 0 ? sum / ws : null;
}

const tiffs = new Map<string, Promise<GeoTIFF>>();
function openTiff(url: string): Promise<GeoTIFF> {
  let t = tiffs.get(url);
  if (!t) {
    t = fromUrl(url);
    t.catch(() => tiffs.delete(url));
    tiffs.set(url, t);
    if (tiffs.size > 256) tiffs.delete(tiffs.keys().next().value!);
  }
  return t;
}

export interface RenderStats { onemeter: number; aws: number; sources: string[]; errors: string[]; level: number }

/** Fills `heights` (NaN = still empty) from one 1 m source; returns how many pixels it filled. */
async function fillFromSource(src: DemSource, base: string, lonlat: Float64Array, heights: Float32Array, outRes: number, stats: RenderStats): Promise<number> {
  const conv = lonLatConverter(src.e);
  const n = heights.length;
  const px = new Float64Array(n).fill(NaN), py = new Float64Array(n).fill(NaN);
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, any = 0;
  for (let i = 0; i < n; i++) {
    if (!Number.isNaN(heights[i])) continue;
    const [X, Y] = conv.forward([lonlat[2 * i], lonlat[2 * i + 1]]);
    const c = (X - src.x0) / src.rx - 0.5, r = (src.y0 - Y) / src.ry - 0.5;
    if (c < -0.5 || r < -0.5 || c > src.w - 0.5 || r > src.h - 0.5) continue;
    px[i] = c; py[i] = r; any++;
    if (c < minX) minX = c; if (c > maxX) maxX = c; if (r < minY) minY = r; if (r > maxY) maxY = r;
  }
  if (!any) return 0;
  const level = overviewLevel(src.rx, outRes, src.l);
  stats.level = Math.max(stats.level, level);
  const tiff = await openTiff(base + src.p);
  const im = await tiff.getImage(level);
  const sx = src.w / im.getWidth(), sy = src.h / im.getHeight();
  const lw = im.getWidth(), lh = im.getHeight();
  const toL = (v: number, s: number) => (v + 0.5) / s - 0.5;
  const wx0 = Math.max(0, Math.floor(toL(minX, sx)) - 1), wy0 = Math.max(0, Math.floor(toL(minY, sy)) - 1);
  const wx1 = Math.min(lw, Math.ceil(toL(maxX, sx)) + 2), wy1 = Math.min(lh, Math.ceil(toL(maxY, sy)) + 2);
  if (wx1 <= wx0 || wy1 <= wy0) return 0;
  const rasters = await im.readRasters({ window: [wx0, wy0, wx1, wy1], samples: [0], interleave: true });
  const data = rasters as unknown as ArrayLike<number>;
  const ww = wx1 - wx0, wh = wy1 - wy0;
  let filled = 0;
  for (let i = 0; i < n; i++) {
    if (Number.isNaN(px[i])) continue;
    const v = sampleBilinear(data, ww, wh, toL(px[i], sx) - wx0, toL(py[i], sy) - wy0);
    if (v !== null) { heights[i] = v; filled++; }
  }
  if (filled) stats.sources.push(src.p.split('/').pop()!.replace(/\.tif$/, ''));
  return filled;
}

async function fillFromAws(z: number, x: number, y: number, heights: Float32Array, size: number, fetcher: typeof fetch): Promise<number> {
  const dz = Math.max(0, z - AWS_MAX_Z);
  const az = z - dz, ax = x >> dz, ay = y >> dz, k = 2 ** dz;
  const res = await fetcher(AWS_TERRARIUM(az, ax, ay), { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`AWS terrarium ${az}/${ax}/${ay} HTTP ${res.status}`);
  const png = decode(new Uint8Array(await res.arrayBuffer()));
  const ch = png.channels, pw = png.width, ph = png.height;
  const elev = new Float32Array(pw * ph);
  for (let i = 0; i < pw * ph; i++) elev[i] = decodeTerrarium(png.data[i * ch], png.data[i * ch + 1], png.data[i * ch + 2]);
  const ox = (x - ax * k) * size / k, oy = (y - ay * k) * size / k, s = pw / size;
  let filled = 0;
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    const i = r * size + c;
    if (!Number.isNaN(heights[i])) continue;
    const v = sampleBilinear(elev, pw, ph, (ox + (c + 0.5) / k) * s - 0.5, (oy + (r + 0.5) / k) * s - 0.5);
    heights[i] = v ?? 0;
    filled++;
  }
  return filled;
}

export async function renderTerrainTile(z: number, x: number, y: number, opts: { fetcher?: typeof fetch; idx?: TerrainIndex } = {}): Promise<{ png: Uint8Array; stats: RenderStats; heights: Float32Array }> {
  const idx = opts.idx ?? TERRAIN_INDEX;
  const size = TILE_SIZE;
  const bounds = tileBounds(z, x, y);
  const lonlat = pixelLonLats(z, x, y, size);
  const heights = new Float32Array(size * size).fill(NaN);
  const stats: RenderStats = { onemeter: 0, aws: 0, sources: [], errors: [], level: 0 };
  const outRes = groundResolution(z, (bounds[1] + bounds[3]) / 2, size);
  if (z >= GA_TERRAIN_MIN_Z && inGeorgiaBbox(bounds, idx)) {
    for (const src of candidateSources(bounds, idx)) {
      if (stats.onemeter >= heights.length) break;
      try {
        stats.onemeter += await fillFromSource(src, idx.base, lonlat, heights, outRes, stats);
      } catch (e) {
        stats.errors.push(`${src.p}: ${(e as Error).message}`);
      }
    }
  }
  if (stats.onemeter < heights.length) stats.aws = await fillFromAws(z, x, y, heights, size, opts.fetcher ?? fetch);
  const rgba = new Uint8Array(size * size * 4);
  for (let i = 0; i < heights.length; i++) encodeTerrarium(heights[i], rgba, i * 4);
  const png = encode({ width: size, height: size, data: rgba, channels: 4, depth: 8 });
  return { png, stats, heights };
}

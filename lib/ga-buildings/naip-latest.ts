/**
 * Newest USDA NAIP aerial photos (flown 2025 onward; Georgia was flown 2025-10 at 0.3 m) served keyless with CORS `*`
 * by Microsoft Planetary Computer's mosaic tiler. A mosaic is a registered STAC search; ids are not stable, so one is
 * registered per page load. Where no 2025+ photo exists the tiler answers 404 and callers fall back to USGS NAIP 2023.
 */
export const PC_DATA_API = 'https://planetarycomputer.microsoft.com/api/data/v1';
export const NAIP_LATEST_SOURCE_URL = 'https://planetarycomputer.microsoft.com/dataset/naip';
export const NAIP_LATEST_SINCE = '2025-01-01T00:00:00Z';
/** Ground resolution of the 2025 Georgia NAIP tiles (STAC `gsd` 0.3). */
export const NAIP_LATEST_GROUND_M = 0.3;
export const NAIP_LATEST_LABEL = 'USDA NAIP 2025+ (Georgia 0.3 m, Oct 2025) via Microsoft Planetary Computer';

export function naipSearchBody(since = NAIP_LATEST_SINCE) {
  return {
    collections: ['naip'],
    'filter-lang': 'cql2-json',
    filter: { op: '>=', args: [{ property: 'datetime' }, since] },
    sortby: [{ field: 'datetime', direction: 'desc' }],
  };
}

export const naipLatestTileUrl = (searchId: string, z: number, x: number, y: number) =>
  `${PC_DATA_API}/mosaic/${searchId}/tiles/WebMercatorQuad/${z}/${x}/${y}?collection=naip&assets=image&asset_bidx=image%7C1%2C2%2C3`;

let searchPromise: Promise<string | null> | null = null;

/** Registers (once per page) the newest-first NAIP mosaic and returns its search id, or null when the tiler is unreachable. */
export function naipLatestSearch(fetchFn: typeof fetch = fetch): Promise<string | null> {
  searchPromise ??= fetchFn(`${PC_DATA_API}/mosaic/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(naipSearchBody()),
  })
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { searchid?: string } | null) => (typeof j?.searchid === 'string' ? j.searchid : null))
    .catch(() => null);
  return searchPromise;
}

export function resetNaipLatestSearch(): void {
  searchPromise = null;
}

/** Web-Mercator tile containing an EPSG:3857 point, plus the point's pixel inside that 256 px tile. */
export function tileOf3857(x: number, y: number, z: number): { tx: number; ty: number; px: number; py: number } {
  const world = 40075016.68557849;
  const n = 2 ** z;
  const fx = ((x + world / 2) / world) * n;
  const fy = ((world / 2 - y) / world) * n;
  const tx = Math.floor(fx);
  const ty = Math.floor(fy);
  return { tx, ty, px: Math.floor((fx - tx) * 256), py: Math.floor((fy - ty) * 256) };
}

/** EPSG:3857 bounds [minX, minY, maxX, maxY] of a tile. */
export function tileBounds3857(z: number, tx: number, ty: number): [number, number, number, number] {
  const world = 40075016.68557849;
  const size = world / 2 ** z;
  const minX = -world / 2 + tx * size;
  const maxY = world / 2 - ty * size;
  return [minX, maxY - size, minX + size, maxY];
}

/** 2×2 tile block that holds a footprint bbox at zoom z, or null when the footprint is larger than a block. */
export function photoBlock(bbox: readonly [number, number, number, number], z: number): { z: number; tx: number; ty: number; bounds: [number, number, number, number] } | null {
  const a = tileOf3857(bbox[0], bbox[3], z);
  const b = tileOf3857(bbox[2], bbox[1], z);
  if (b.tx - a.tx > 1 || b.ty - a.ty > 1) return null;
  const [minX, , , maxY] = tileBounds3857(z, a.tx, a.ty);
  const size = 40075016.68557849 / 2 ** z;
  return { z, tx: a.tx, ty: a.ty, bounds: [minX, maxY - 2 * size, minX + 2 * size, maxY] };
}

const tileCache = new Map<string, Promise<ImageBitmap | null>>();
const TILE_CACHE_MAX = 64;

/** One newest-NAIP tile as an ImageBitmap; null where no 2025+ photo covers it. Small LRU so memory stays bounded. */
export async function naipLatestTile(z: number, tx: number, ty: number): Promise<ImageBitmap | null> {
  const key = `${z}/${tx}/${ty}`;
  const hit = tileCache.get(key);
  if (hit) {
    tileCache.delete(key);
    tileCache.set(key, hit);
    return hit;
  }
  const p = (async () => {
    const id = await naipLatestSearch();
    if (!id) return null;
    let r = await fetch(naipLatestTileUrl(id, z, tx, ty));
    if (r.status === 404 && (await r.clone().text()).includes('Unknown search ID')) {
      resetNaipLatestSearch();
      const again = await naipLatestSearch();
      if (!again) return null;
      r = await fetch(naipLatestTileUrl(again, z, tx, ty));
    }
    if (!r.ok) return null;
    return createImageBitmap(await r.blob());
  })().catch(() => null);
  tileCache.set(key, p);
  while (tileCache.size > TILE_CACHE_MAX) {
    const oldest = tileCache.keys().next().value as string;
    void tileCache.get(oldest)?.then((b) => b?.close());
    tileCache.delete(oldest);
  }
  return p;
}

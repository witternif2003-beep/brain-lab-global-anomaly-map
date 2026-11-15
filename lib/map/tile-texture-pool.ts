import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * MapLibre keeps up to 50 released raster-tile textures per tile size for reuse (Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET).
 * With 3× high-DPI satellite tiles on a phone that pool alone can hold ~70 MB of idle mipmapped textures after a zoom-in.
 */
export const TOUCH_TILE_TEXTURE_POOL = 8;

interface PoolTexture { destroy: () => void }
interface PainterInternals {
  constructor: { MAX_TEXTURE_POOL_SIZE_PER_BUCKET?: number };
  _tileTextures?: Record<string, PoolTexture[]>;
}

/** Caps the reuse pool and frees textures above the cap; returns the cap applied, or null when MapLibre's internals differ. */
export function capTileTexturePool(map: MapLibreMap, cap = TOUCH_TILE_TEXTURE_POOL): number | null {
  const painter = (map as unknown as { painter?: PainterInternals }).painter;
  const Painter = painter?.constructor;
  if (!Painter || typeof Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET !== 'number') return null;
  Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET = Math.min(Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET, cap);
  for (const bucket of Object.values(painter._tileTextures ?? {})) {
    while (bucket.length > Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET) bucket.pop()?.destroy();
  }
  return Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET;
}

/** Sets the reuse-pool cap (raising or lowering it), frees textures above it, and returns the previous cap; null when MapLibre's internals differ. */
export function setTileTexturePool(map: MapLibreMap, cap: number): number | null {
  const painter = (map as unknown as { painter?: PainterInternals }).painter;
  const Painter = painter?.constructor;
  if (!Painter || typeof Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET !== 'number') return null;
  const prev = Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET;
  Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET = Math.max(0, Math.floor(cap));
  for (const bucket of Object.values(painter._tileTextures ?? {})) {
    while (bucket.length > Painter.MAX_TEXTURE_POOL_SIZE_PER_BUCKET) bucket.pop()?.destroy();
  }
  return prev;
}

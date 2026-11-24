import type { Map as MapLibreMap } from 'maplibre-gl';
import { gpuSafeMode } from './crash-guard';
import { isTouchDevice } from './touch-gpu-budget';
import { vramTargetBytes } from './vram-budget';
import { vramSnapshot, vramMeterInstalled } from './vram-meter';

/**
 * MapLibre drapes raster layers over 3D terrain through render-to-texture tiles of terrain tileSize × qualityFactor (default 2,
 * i.e. 1024² RGBA with mipmaps ≈ 5.6 MB each) and keeps up to 150 of them per layer stack. Measured at zoom 22 / pitch 70 on a
 * phone-sized view, 224 of these held 1.2 GB. Dropping the factor to 1 makes each drape 512² (≈ 1.4 MB, a quarter).
 */
export const DRAPE_QUALITY_LOW = 1;
const CHECK_MS = 5_000;

interface DrapeInternals { terrain?: { qualityFactor: number; tileManager: { tileSize: number } } | null; painter?: { renderToTexture?: { rttSize: number } | null; clearRTTPool?: () => void } }

/** Sets the drape size factor on the live terrain and its render-to-texture; returns true when it changed. */
export function setDrapeQuality(map: MapLibreMap, factor: number): boolean {
  const m = map as unknown as DrapeInternals;
  const t = m.terrain;
  const rtt = m.painter?.renderToTexture;
  if (!t || !rtt || t.qualityFactor === factor) return false;
  t.qualityFactor = factor;
  rtt.rttSize = t.tileManager.tileSize * factor;
  m.painter?.clearRTTPool?.();
  map.triggerRepaint();
  return true;
}

/**
 * Destroys the drapes waiting in MapLibre's recycle pool (owned by no tile) and returns how many. MapLibre frees them itself at the
 * end of a frame at rest; a phone probe held still at zoom 16.5 still found 198 pooled (9 layer stacks x 22 terrain tiles, ~263 MB at
 * 512² with mipmaps) and none held by tiles. Tiles that need a drape again allocate a fresh one on their next frame.
 */
export function freeIdleDrapes(map: MapLibreMap): number {
  const p = (map as unknown as { painter?: { _rttObjectRecyclePool?: unknown[]; clearRTTPool?: () => void } }).painter;
  const n = p?._rttObjectRecyclePool?.length ?? 0;
  if (n > 0 && p?.clearRTTPool) p.clearRTTPool();
  return p?.clearRTTPool ? n : 0;
}

/** Touch devices always use low-memory drapes; desktops switch once measured GPU memory reaches the target. */
export function governDrapeMemory(map: MapLibreMap): () => void {
  const touch = isTouchDevice();
  let low = touch;
  let freed = 0;
  const apply = () => {
    if (!low && vramMeterInstalled() && vramSnapshot().bytes >= vramTargetBytes(false, gpuSafeMode())) low = true;
    if (low) setDrapeQuality(map, DRAPE_QUALITY_LOW);
    if (touch && !map.isMoving()) freed += freeIdleDrapes(map);
    window.__gaDrape = { low, factor: (map as unknown as DrapeInternals).terrain?.qualityFactor ?? null, freed };
  };
  const onTerrain = () => apply();
  map.on('terrain', onTerrain);
  map.on('style.load', onTerrain);
  apply();
  const timer = setInterval(apply, CHECK_MS);
  return () => {
    clearInterval(timer);
    map.off('terrain', onTerrain);
    map.off('style.load', onTerrain);
  };
}

declare global {
  interface Window { __gaDrape?: { low: boolean; factor: number | null; freed?: number } }
}

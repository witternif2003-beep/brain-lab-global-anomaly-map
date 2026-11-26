import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * MapLibre 6.13 (`Map._handleTerrainDataEvent`) returns every terrain drape covering a tile to the pool whenever ANY source fires a
 * tile `data` event, so each drape is re-rendered next frame. God's Eye updates animated GeoJSON (simulated cars, telemetry pulses,
 * satellites…) several times a second, mostly for circle/symbol/3D layers that are not draped. A phone probe held at zoom 18 measured
 * 1,512 drape releases and re-renders per 10 s (84 per frame). This guard keeps the release for the terrain source, image sources,
 * style changes and every source that feeds a draped layer, and skips it for sources with no layer in any drape stack.
 * `?drapeguard=off` restores MapLibre's behaviour.
 */
export interface TileDataEvent { dataType?: string; sourceId?: string; tile?: unknown; source?: { type?: string } }

/** Source ids of the layers MapLibre drew into drape stacks on its last frame. */
export function drapedSourceIds(stacks: string[][], layerSource: (layerId: string) => string | undefined): Set<string> {
  const ids = new Set<string>();
  for (const stack of stacks) for (const id of stack) { const s = layerSource(id); if (s) ids.add(s); }
  return ids;
}

/** True when MapLibre's own handler should run: anything except a tile event from a source with no draped layer. */
export function shouldReleaseDrapes(event: TileDataEvent, terrainSourceId: string, draped: Set<string> | null): boolean {
  if (event.dataType === 'style' || !event.tile || !event.sourceId || !draped) return true;
  if (event.sourceId === terrainSourceId || event.source?.type === 'image') return true;
  return draped.has(event.sourceId);
}

interface GuardInternals {
  _handleTerrainDataEvent?: (event: TileDataEvent, terrainSourceId: string) => void;
  painter?: { renderToTexture?: { _stacks?: string[][] } | null };
  style?: { _layers?: Record<string, { source?: string }> };
}

/** Installs the guard on this map instance; returns an uninstall. No-op (returns a no-op) when MapLibre's internals differ. */
export function installDrapeGuard(map: MapLibreMap, search = ''): () => void {
  const m = map as unknown as GuardInternals;
  const original = m._handleTerrainDataEvent;
  if (typeof original !== 'function' || new URLSearchParams(search).get('drapeguard') === 'off') return () => {};
  const stats = { skipped: 0, passed: 0 };
  let cache: Set<string> | null = null;
  const invalidate = () => { cache = null; };
  map.on('render', invalidate);
  m._handleTerrainDataEvent = function (this: unknown, event: TileDataEvent, terrainSourceId: string) {
    if (!cache) {
      const stacks = m.painter?.renderToTexture?._stacks;
      cache = stacks ? drapedSourceIds(stacks, (id) => m.style?._layers?.[id]?.source) : null;
    }
    if (shouldReleaseDrapes(event, terrainSourceId, cache)) { stats.passed++; return original.call(map, event, terrainSourceId); }
    stats.skipped++;
  };
  window.__gaDrapeGuard = stats;
  return () => {
    map.off('render', invalidate);
    m._handleTerrainDataEvent = original;
  };
}

declare global {
  interface Window { __gaDrapeGuard?: { skipped: number; passed: number } }
}

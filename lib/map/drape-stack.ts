import type { Map as MapLibreMap } from 'maplibre-gl';
import { isTouchDevice } from './touch-gpu-budget';

/** Layer types MapLibre 6.13 renders into terrain drapes (render_to_texture.ts LAYERS_TO_TEXTURES). */
export const DRAPED_LAYER_TYPES: ReadonlySet<string> = new Set(['background', 'fill', 'line', 'raster', 'hillshade', 'color-relief']);

/**
 * MapLibre starts a new drape stack every time a draped layer follows a non-draped one (symbol, circle, fill-extrusion, custom…),
 * and each stack holds one 512² drape per terrain tile. God's Eye interleaves them into 9 stacks; a phone probe at zoom 20 held
 * 33 terrain tiles × 9 stacks ≈ 297 drapes (~395 MB) and 517 MB of map textures. Moving every draped layer, in its existing order,
 * below the first non-draped layer gives one stack. Nothing is removed; ground layers still draw in the same relative order, and
 * markers, labels and 3D layers keep theirs above the ground. Returns the [layerId, beforeId] moves that achieve it.
 */
export function drapeStackMoves(layers: ReadonlyArray<{ id: string; type: string }>): Array<[string, string]> {
  const first = layers.findIndex((l) => !DRAPED_LAYER_TYPES.has(l.type));
  if (first < 0) return [];
  const before = layers[first].id;
  return layers.slice(first + 1).filter((l) => DRAPED_LAYER_TYPES.has(l.type)).map((l) => [l.id, before]);
}

/** Phones consolidate by default; `?drapestack=off` keeps the authored order, `?drapestack=on` enables it on desktop. */
export function drapeStackEnabled(touch: boolean, search = ''): boolean {
  const q = new URLSearchParams(search).get('drapestack');
  return q === 'on' || (touch && q !== 'off');
}

/** Keeps the style in one drape stack as layers are added or moved; returns an uninstall. */
export function installDrapeStack(map: MapLibreMap, search = ''): () => void {
  if (!drapeStackEnabled(isTouchDevice(), search)) return () => {};
  const stats = { runs: 0, moves: 0 };
  window.__gaDrapeStack = stats;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let busy = false;
  const run = () => {
    timer = null;
    const layers = map.getStyle()?.layers;
    if (!layers || busy) return;
    const moves = drapeStackMoves(layers);
    if (!moves.length) return;
    busy = true;
    try {
      for (const [id, before] of moves) if (map.getLayer(id) && map.getLayer(before)) map.moveLayer(id, before);
    } finally {
      busy = false;
    }
    stats.runs++;
    stats.moves += moves.length;
  };
  const schedule = () => { if (!busy && !timer) timer = setTimeout(run, 300); };
  map.on('styledata', schedule);
  schedule();
  return () => {
    map.off('styledata', schedule);
    if (timer) clearTimeout(timer);
  };
}

declare global {
  interface Window { __gaDrapeStack?: { runs: number; moves: number } }
}

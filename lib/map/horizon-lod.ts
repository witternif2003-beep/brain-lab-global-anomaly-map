import type { Map as MapLibreMap } from 'maplibre-gl';

/** MapLibre's built-in tile LOD (maplibre-gl 6.13 `defaultCalculateTileZoom`): zoom decays over up to 9.3 levels toward the horizon. */
export const MAPLIBRE_DEFAULT_LOD = { levels: 9.314, ratio: 3 } as const;

export interface HorizonLod { levels: number; ratio: number }

/**
 * Tile LOD for pitched views. Fewer zoom levels on screen keeps distant tiles closer to the centre zoom; the higher tile-count ratio
 * lets MapLibre load the extra tiles that needs instead of lowering every tile's zoom. Phones get a smaller step than desktops
 * (more tiles = more drape textures in GPU memory), and after a recent GPU crash MapLibre's default is used.
 */
export function horizonLod(touch: boolean, crashes = 0): HorizonLod {
  if (crashes > 0) return { ...MAPLIBRE_DEFAULT_LOD };
  return touch ? { levels: 5, ratio: 5 } : { levels: 3, ratio: 8 };
}

/** Applies the LOD to every source now and to sources added later (style swaps, toggled layers). Returns an unsubscribe. */
export function applyHorizonLod(map: MapLibreMap, lod: HorizonLod): () => void {
  const done = new Set<string>();
  const apply = () => {
    const ids = Object.keys(map.getStyle()?.sources ?? {});
    if (ids.every((id) => done.has(id))) return;
    map.setSourceTileLodParams(lod.levels, lod.ratio);
    done.clear();
    ids.forEach((id) => done.add(id));
  };
  const onStyle = () => {
    done.clear();
    apply();
  };
  map.on('style.load', onStyle);
  map.on('sourcedata', apply);
  if (map.isStyleLoaded()) apply();
  window.__gaHorizonLod = lod;
  return () => {
    map.off('style.load', onStyle);
    map.off('sourcedata', apply);
  };
}

declare global {
  interface Window { __gaHorizonLod?: HorizonLod }
}

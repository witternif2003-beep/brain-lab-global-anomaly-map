import type { Map as MapLibreMap, RasterDEMSourceSpecification } from 'maplibre-gl';

export const HILLSHADE_SOURCE = 'terrain-hillshade-dem';
export const HILLSHADE_LAYER = 'terrain-hillshade';
/** Phones read z15 elevation (~4.8 m/px) for shading to stay inside their map memory share; desktop reads the full 1 m pyramid. */
export const HILLSHADE_TOUCH_MAXZOOM = 15;
const BASE_RASTERS = new Set(['sat', 'naip', 'usgstopo', 'trails']);

type StyleLayer = { id: string; type: string };

/** Layer to insert the shading under: just above the basemap imagery, or above the land fills of a vector basemap. */
export function hillshadeBeforeId(layers: StyleLayer[]): string | undefined {
  let lastBase = -1;
  layers.forEach((l, i) => {
    if (BASE_RASTERS.has(l.id)) lastBase = i;
  });
  if (lastBase >= 0) return layers[lastBase + 1]?.id;
  return layers.find((l) => l.type !== 'background' && l.type !== 'fill')?.id;
}

/** Shades the 3D terrain from its own elevation tiles so relief shows on top of the photo or map basemap. */
export function addTerrainHillshade(map: MapLibreMap, dem: RasterDEMSourceSpecification, touch: boolean): void {
  if (!map.getSource(HILLSHADE_SOURCE)) {
    const maxzoom = touch ? Math.min(dem.maxzoom ?? HILLSHADE_TOUCH_MAXZOOM, HILLSHADE_TOUCH_MAXZOOM) : dem.maxzoom;
    map.addSource(HILLSHADE_SOURCE, { ...dem, maxzoom });
  }
  if (map.getLayer(HILLSHADE_LAYER)) return;
  map.addLayer(
    {
      id: HILLSHADE_LAYER,
      type: 'hillshade',
      source: HILLSHADE_SOURCE,
      paint: {
        'hillshade-method': 'combined',
        'hillshade-exaggeration': 1,
        'hillshade-illumination-direction': 315,
        'hillshade-shadow-color': 'rgba(0, 0, 0, 0.85)',
        'hillshade-highlight-color': 'rgba(255, 255, 255, 0.35)',
        'hillshade-accent-color': 'rgba(0, 0, 0, 0.4)',
      },
    },
    hillshadeBeforeId(map.getStyle().layers as StyleLayer[]),
  );
}

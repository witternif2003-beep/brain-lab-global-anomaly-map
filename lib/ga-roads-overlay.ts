import type { Map as MapLibreMap } from 'maplibre-gl';

/** OpenMapTiles `transportation` roads from the OpenFreeMap source, drawn above the LiDAR points so roads stay visible. */
const SOURCE = 'ofm-buildings';
export const GA_ROAD_LAYERS = ['ga-roads-casing', 'ga-roads-line'] as const;

const width = (k: number) => ['interpolate', ['exponential', 1.6], ['zoom'], 8, ['match', ['get', 'class'], ['motorway', 'trunk'], 1.2 * k, 'primary', 0.8 * k, 0.3 * k], 14, ['match', ['get', 'class'], ['motorway', 'trunk'], 4 * k, 'primary', 3 * k, ['secondary', 'tertiary'], 2.2 * k, 1.2 * k], 20, ['match', ['get', 'class'], ['motorway', 'trunk'], 28 * k, 'primary', 22 * k, ['secondary', 'tertiary'], 16 * k, 9 * k]] as never;
const ROAD_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'];

export function addGaRoadOverlay(map: MapLibreMap): void {
  if (!map.getSource(SOURCE)) return;
  const filter = ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', ROAD_CLASSES]]] as never;
  if (!map.getLayer('ga-roads-casing')) {
    map.addLayer({ id: 'ga-roads-casing', type: 'line', source: SOURCE, 'source-layer': 'transportation', minzoom: 8, filter, layout: { 'line-join': 'round', 'line-cap': 'round' }, paint: { 'line-color': '#0b0e14', 'line-opacity': 0.55, 'line-width': width(1.6) } });
  }
  if (!map.getLayer('ga-roads-line')) {
    map.addLayer({
      id: 'ga-roads-line',
      type: 'line',
      source: SOURCE,
      'source-layer': 'transportation',
      minzoom: 8,
      filter,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': ['match', ['get', 'class'], ['motorway', 'trunk'], '#ff7ad9', 'primary', '#7ff7f2', ['secondary', 'tertiary'], '#e2e8f0', '#94a3b8'] as never,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.55, 14, 0.75, 18, 0.85] as never,
        'line-width': width(1),
      },
    });
  }
}

/** Re-stacks the road overlay above layers added later (e.g. LiDAR re-added after a WebGL context restore). */
export function raiseGaRoadOverlay(map: MapLibreMap): void {
  for (const id of GA_ROAD_LAYERS) if (map.getLayer(id)) map.moveLayer(id);
}

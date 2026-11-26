import type { Map as MapLibreMap } from 'maplibre-gl';

/** OpenMapTiles `transportation` roads from the OpenFreeMap source, drawn above the LiDAR points so roads stay visible. */
const SOURCE = 'ofm-buildings';
export const GA_ROAD_LAYERS = ['ga-roads-casing', 'ga-roads-line'] as const;

const FT = 0.3048;
/**
 * Paved width in metres of one OpenMapTiles road line, so at street zoom the overlay covers the road in the imagery.
 * Motorway/trunk lines are one carriageway each way: FHWA's Interstate minimum is 12-ft lanes, a 10-ft right and a 4-ft
 * left shoulder (fhwa.dot.gov/programadmin/interstate.cfm); 3 lanes are assumed for motorways and 2 for trunks.
 * Other classes are two-way lines with typical lane counts. OpenMapTiles has no lane count, so these are class estimates.
 */
export const ROAD_WIDTH_M: Record<string, number> = {
  motorway: (3 * 12 + 10 + 4) * FT,
  trunk: (2 * 12 + 10 + 4) * FT,
  primary: (4 * 12 + 2 * 4) * FT,
  secondary: (2 * 12 + 2 * 4) * FT,
  tertiary: (2 * 11 + 2 * 2) * FT,
  minor: 2 * 10 * FT,
  service: 12 * FT,
};
/** Ground metres per CSS pixel at zoom 16 for MapLibre's 512 px tiles, at Georgia's mid-latitude (32.7°N). */
export const M_PER_PX_Z16 = (40_075_016.686 * Math.cos((32.7 * Math.PI) / 180)) / (512 * 2 ** 16);
export const roadPxAt = (cls: string, zoom: number) => ((ROAD_WIDTH_M[cls] ?? ROAD_WIDTH_M.minor) / M_PER_PX_Z16) * 2 ** (zoom - 16);
const metric = (z: number, k: number) => ['match', ['get', 'class'], ...Object.keys(ROAD_WIDTH_M).flatMap((c) => [c, roadPxAt(c, z) * k]), roadPxAt('minor', z) * k];
/** Pixel widths up to z14 (unchanged), then true ground width from z16 (exponential base 2 keeps it metre-exact between stops). */
const width = (k: number) => ['interpolate', ['exponential', 2], ['zoom'], 8, ['match', ['get', 'class'], ['motorway', 'trunk'], 1.2 * k, 'primary', 0.8 * k, 0.3 * k], 14, ['match', ['get', 'class'], ['motorway', 'trunk'], 4 * k, 'primary', 3 * k, ['secondary', 'tertiary'], 2.2 * k, 1.2 * k], 16, metric(16, k === 1 ? 1 : 1.12), 22, metric(22, k === 1 ? 1 : 1.12)] as never;
export const ROAD_CLASSES = ['motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'minor', 'service'] as const;
/** From this zoom OSM road bridges are drawn as 3D decks (lib/traffic-overlay.ts), so the draped line skips them instead of sagging into the valley under the span. */
export const BRIDGE_DECK_MIN_ZOOM = 13;
export const ROAD_LINE_COLOR: Record<string, string> = { motorway: '#cbd5e1', trunk: '#cbd5e1', primary: '#7ff7f2', secondary: '#e2e8f0', tertiary: '#e2e8f0', minor: '#94a3b8', service: '#94a3b8' };

export function addGaRoadOverlay(map: MapLibreMap): void {
  if (!map.getSource(SOURCE)) return;
  const filter = ['all', ['==', ['geometry-type'], 'LineString'], ['in', ['get', 'class'], ['literal', ROAD_CLASSES]], ['any', ['<', ['zoom'], BRIDGE_DECK_MIN_ZOOM], ['!=', ['get', 'brunnel'], 'bridge']]] as never;
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
        'line-color': ['match', ['get', 'class'], ...Object.entries(ROAD_LINE_COLOR).flat(), '#94a3b8'] as never,
        'line-opacity': ['interpolate', ['linear'], ['zoom'], 8, 0.55, 14, 0.75, 18, 0.85] as never,
        'line-width': width(1),
      },
    });
  }
}

/** Re-stacks the road overlay above layers added later (e.g. LiDAR re-added after a WebGL context restore). */
export function raiseGaRoadOverlay(map: MapLibreMap): void {
  for (const id of [...GA_ROAD_LAYERS, 'ga-traffic-flow-line', 'ga-traffic-flow-ground-line']) if (map.getLayer(id)) map.moveLayer(id);
}

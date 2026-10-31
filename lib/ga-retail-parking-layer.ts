import type { FilterSpecification, Map as MapLibreMap } from 'maplibre-gl';

/** Big-box store and parking-lot points from OpenStreetMap, read from the OpenFreeMap `poi` tiles already loaded for 3D buildings. */
const SOURCE = 'ofm-buildings';
export const GA_RETAIL_LAYERS = ['ga-parking-lots', 'ga-big-box-stores'] as const;

export const BIG_BOX_BRANDS = ['walmart', 'target', 'publix', 'kroger', 'home depot', "lowe's", 'lowe’s', 'costco', "sam's club", 'sam’s club'] as const;
const NON_STORE_CLASSES = ['restaurant', 'fast_food', 'cafe', 'fuel', 'pharmacy', 'bank', 'atm', 'car', 'parking', 'optician'];

const GA_POLYGON = {
  type: 'Polygon',
  coordinates: [[[-85.61, 30.35], [-80.84, 30.35], [-80.84, 35.0], [-85.61, 35.0], [-85.61, 30.35]]],
};

export function bigBoxFilter(): FilterSpecification {
  const name = ['downcase', ['coalesce', ['get', 'name'], '']];
  return [
    'all',
    ['!', ['in', ['get', 'class'], ['literal', NON_STORE_CLASSES]]],
    ['any', ...BIG_BOX_BRANDS.map((b) => ['>=', ['index-of', b, name], 0])],
    ['within', GA_POLYGON],
  ] as unknown as FilterSpecification;
}

export function parkingFilter(): FilterSpecification {
  return ['all', ['==', ['get', 'class'], 'parking'], ['within', GA_POLYGON]] as unknown as FilterSpecification;
}

export function addGaRetailParkingLayers(map: MapLibreMap): void {
  if (!map.getSource(SOURCE)) return;
  if (!map.getLayer('ga-parking-lots')) {
    map.addLayer({
      id: 'ga-parking-lots',
      type: 'circle',
      source: SOURCE,
      'source-layer': 'poi',
      minzoom: 14,
      filter: parkingFilter(),
      paint: {
        'circle-color': '#2563eb',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 2.5, 18, 6] as never,
        'circle-stroke-color': '#e2e8f0',
        'circle-stroke-width': 1,
        'circle-opacity': 0.85,
      },
    });
  }
  if (!map.getLayer('ga-big-box-stores')) {
    map.addLayer({
      id: 'ga-big-box-stores',
      type: 'circle',
      source: SOURCE,
      'source-layer': 'poi',
      minzoom: 12,
      filter: bigBoxFilter(),
      paint: {
        'circle-color': '#f59e0b',
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 12, 4, 18, 10] as never,
        'circle-stroke-color': '#111827',
        'circle-stroke-width': 1.5,
      },
    });
  }
}

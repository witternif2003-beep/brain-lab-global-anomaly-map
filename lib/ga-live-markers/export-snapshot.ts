import type { Map as MapLibreMap } from 'maplibre-gl';

export const GA_AIRCRAFT_EXPORT_SOURCE = 'ga-aircraft-export';
export const GA_AIRCRAFT_EXPORT_LAYER = 'ga-aircraft-export-dots';

type Coord = [number, number];
const providers = new WeakMap<MapLibreMap, () => Coord[]>();

export function registerAircraftSnapshot(map: MapLibreMap, positions: () => Coord[]): () => void {
  providers.set(map, positions);
  return () => providers.delete(map);
}

/**
 * The 32K export captures MapLibre layers only, and the aircraft are drawn by deck.gl. This freezes the
 * EKF-predicted aircraft positions at export start into a MapLibre dot layer so every tile shows the same instant.
 * Returns the cleanup that removes it.
 */
export function freezeAircraftForExport(map: MapLibreMap): () => void {
  const coords = providers.get(map)?.() ?? [];
  if (!coords.length || map.getSource(GA_AIRCRAFT_EXPORT_SOURCE)) return () => {};
  map.addSource(GA_AIRCRAFT_EXPORT_SOURCE, {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: coords.map((c) => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: c } })) },
  });
  map.addLayer({
    id: GA_AIRCRAFT_EXPORT_LAYER,
    type: 'circle',
    source: GA_AIRCRAFT_EXPORT_SOURCE,
    paint: { 'circle-radius': 4.5, 'circle-color': '#e0f2fe', 'circle-stroke-color': '#0369a1', 'circle-stroke-width': 1.5 },
  });
  return () => {
    if (map.getLayer(GA_AIRCRAFT_EXPORT_LAYER)) map.removeLayer(GA_AIRCRAFT_EXPORT_LAYER);
    if (map.getSource(GA_AIRCRAFT_EXPORT_SOURCE)) map.removeSource(GA_AIRCRAFT_EXPORT_SOURCE);
  };
}

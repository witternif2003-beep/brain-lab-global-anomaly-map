import type { GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import type { OsintCountry } from './fbi-osint/load';

const SOURCE = 'fbi-osint-geo';
const BUBBLE = 'fbi-osint-geo-bubble';
const LABEL = 'fbi-osint-geo-label';
export const OSINT_OPEN_EVENT = 'fbi-osint-open';
export interface OsintOpenDetail { cc: string; name: string }

const latest = new WeakMap<MapLibreMap, GeoJSON.FeatureCollection>();
const clickBound = new WeakSet<MapLibreMap>();

function toGeojson(countries: OsintCountry[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: countries.map((c) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [c.lon, c.lat] },
      properties: { cc: c.cc, name: c.name, count: c.count, breakdown: Object.entries(c.bySource).map(([k, v]) => `${k} ${v}`).join(' · ') },
    })),
  };
}

/** Per-country bubbles of FBI-relevant OSINT indicators (IPv4 hosting country or ransomware victim country). Idempotent across style reloads. */
export function addOsintGeoLayer(map: MapLibreMap, attribution: string): void {
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: latest.get(map) ?? { type: 'FeatureCollection', features: [] }, attribution: `FBI OSINT bubbles: country-level only, not exact locations · ${attribution}` });
  if (!map.getLayer(BUBBLE)) {
    map.addLayer({
      id: BUBBLE,
      type: 'circle',
      source: SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['sqrt', ['get', 'count']], 1, 4, 30, 16, 120, 40],
        'circle-color': '#f472b6',
        'circle-opacity': 0.35,
        'circle-stroke-color': '#f472b6',
        'circle-stroke-width': 1.2,
        'circle-pitch-alignment': 'map',
      },
    });
  }
  if (!map.getLayer(LABEL)) {
    map.addLayer({
      id: LABEL,
      type: 'symbol',
      source: SOURCE,
      layout: { 'text-field': ['concat', ['get', 'cc'], ' ', ['to-string', ['get', 'count']]], 'text-size': 10, 'text-allow-overlap': false },
      paint: { 'text-color': '#fdf2f8', 'text-halo-color': '#831843', 'text-halo-width': 1.2 },
    });
  }
  if (clickBound.has(map)) return;
  clickBound.add(map);
  map.on('click', BUBBLE, (e: MapLayerMouseEvent) => {
    const p = e.features?.[0]?.properties as { cc?: string; name?: string } | undefined;
    if (p?.cc) window.dispatchEvent(new CustomEvent<OsintOpenDetail>(OSINT_OPEN_EVENT, { detail: { cc: p.cc, name: p.name ?? p.cc } }));
  });
  map.on('mouseenter', BUBBLE, () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', BUBBLE, () => (map.getCanvas().style.cursor = ''));
}

export function setOsintGeoData(map: MapLibreMap, countries: OsintCountry[]): void {
  const fc = toGeojson(countries);
  latest.set(map, fc);
  (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(fc);
}

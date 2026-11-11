import type { FilterSpecification, GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import { reportGaFeed } from './ga-live-status';

/** Big-box store and parking-lot points from OpenStreetMap, read from the OpenFreeMap `poi` tiles already loaded for 3D buildings. */
const SOURCE = 'ofm-buildings';
export const GA_RETAIL_LAYERS = ['ga-parking-lots', 'ga-big-box-stores'] as const;
/** Statewide index for zooms below OpenFreeMap's z14 POI tiles; built by scripts/build-ga-parking-index.mjs. */
const INDEX = 'ga-parking-index';
const INDEX_URL = '/geo/ga-parking-index.json';
const INDEX_MAX_ZOOM = 14;
export const GA_STORE_LAYERS = ['ga-big-box-stores', `${INDEX}-stores`] as const;
type ParkingIndex = GeoJSON.FeatureCollection<GeoJSON.Point, { k: 'p' | 's'; name?: string }> & { osmBase: string | null };
let indexP: Promise<ParkingIndex> | null = null;
const loadIndex = () =>
  (indexP ??= fetch(INDEX_URL).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<ParkingIndex>;
  }).catch((e) => { indexP = null; throw e; }));

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
        'circle-stroke-width': ['interpolate', ['linear'], ['zoom'], 14, 1, 18, 2] as never,
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
  void addParkingIndex(map);
  if (!bound.has(map)) {
    bound.add(map);
    const once = (e: MapLayerMouseEvent) => {
      const ev = e.originalEvent as MouseEvent & { gaParkingHandled?: boolean };
      if (ev.gaParkingHandled) return false;
      ev.gaParkingHandled = true;
      return true;
    };
    const popup = (kind: 'lot' | 'store') => (e: MapLayerMouseEvent) => {
      const f = e.features?.[0];
      if (f && once(e)) void import('./ga-parking-popup').then((m) => m.openParkingPopup(map, f, [e.lngLat.lng, e.lngLat.lat], kind));
    };
    const tappable: [string, ((e: MapLayerMouseEvent) => void)][] = [
      ['ga-parking-lots', popup('lot')],
      [`${INDEX}-lots`, popup('lot')],
      ['ga-big-box-stores', popup('store')],
      [`${INDEX}-stores`, popup('store')],
      [`${INDEX}-clusters`, (e) => { if (once(e)) zoomIntoCluster(map, e); }],
    ];
    for (const [id, onClick] of tappable) {
      map.on('click', id, onClick);
      map.on('mouseenter', id, () => { map.getCanvas().style.cursor = 'pointer'; });
      map.on('mouseleave', id, () => { map.getCanvas().style.cursor = ''; });
    }
  }
}

function zoomIntoCluster(map: MapLibreMap, e: MapLayerMouseEvent) {
  const f = e.features?.[0];
  const src = map.getSource(INDEX) as GeoJSONSource | undefined;
  if (!f || !src || f.geometry.type !== 'Point') return;
  const center = f.geometry.coordinates as [number, number];
  void src.getClusterExpansionZoom(Number(f.properties?.cluster_id))
    .then((z) => map.easeTo({ center, zoom: Math.min(z + 0.5, INDEX_MAX_ZOOM + 0.5), duration: 600 }))
    .catch(() => {});
}

/** Parking lots and big-box stores statewide below z14, clustered, so every dot is tappable at any zoom. */
async function addParkingIndex(map: MapLibreMap) {
  try {
    const data = await loadIndex();
    if (!map.getStyle() || map.getSource(INDEX) || !map.getSource(SOURCE)) return;
    const lots = data.features.filter((f) => f.properties.k === 'p');
    const storeFeatures = data.features.filter((f) => f.properties.k === 's');
    const attribution = 'Parking & stores: © OpenStreetMap contributors';
    map.addSource(INDEX, { type: 'geojson', data: { type: 'FeatureCollection', features: lots }, cluster: true, clusterMaxZoom: 12, clusterRadius: 42, attribution });
    map.addSource(`${INDEX}-s`, { type: 'geojson', data: { type: 'FeatureCollection', features: storeFeatures }, attribution });
    map.addLayer({
      id: `${INDEX}-clusters`, type: 'circle', source: INDEX, maxzoom: INDEX_MAX_ZOOM, filter: ['has', 'point_count'],
      paint: {
        'circle-color': '#2563eb',
        'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'], 2, 9, 100, 15, 2000, 24] as never,
        'circle-stroke-color': '#e2e8f0',
        'circle-stroke-width': 1.5,
        'circle-opacity': 0.85,
      },
    });
    map.addLayer({
      id: `${INDEX}-count`, type: 'symbol', source: INDEX, maxzoom: INDEX_MAX_ZOOM, filter: ['has', 'point_count'],
      layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 10, 'text-allow-overlap': true },
      paint: { 'text-color': '#f8fafc' },
    });
    map.addLayer({
      id: `${INDEX}-lots`, type: 'circle', source: INDEX, maxzoom: INDEX_MAX_ZOOM, filter: ['!', ['has', 'point_count']],
      paint: { 'circle-color': '#2563eb', 'circle-radius': 4, 'circle-stroke-color': '#e2e8f0', 'circle-stroke-width': 1, 'circle-opacity': 0.85 },
    });
    map.addLayer({
      id: `${INDEX}-stores`, type: 'circle', source: `${INDEX}-s`, maxzoom: INDEX_MAX_ZOOM,
      paint: { 'circle-color': '#f59e0b', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 5, 3, 13, 6] as never, 'circle-stroke-color': '#111827', 'circle-stroke-width': 1.5 },
    });
    const stores = storeFeatures.length;
    reportGaFeed(map, {
      id: 'parking-index', label: 'Parking lots + big-box stores (OSM)', color: '#2563eb', count: data.features.length,
      detail: `${lots.length} lots, ${stores} stores statewide · lots grouped when zoomed out, tap a group to zoom in · tapping a dot reads its live OSM record · age = OSM snapshot`,
      updatedAt: data.osmBase, staleAfterMin: 30 * 1440, sourceUrl: 'https://www.openstreetmap.org/copyright', error: null,
    });
  } catch (e) {
    reportGaFeed(map, { id: 'parking-index', label: 'Parking lots + big-box stores (OSM)', color: '#2563eb', count: null, updatedAt: null, sourceUrl: 'https://www.openstreetmap.org/copyright', error: e instanceof Error ? e.message : String(e) });
  }
}

const bound = new WeakSet<MapLibreMap>();

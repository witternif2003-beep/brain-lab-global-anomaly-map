import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { reportGaFeed } from './ga-live-status';
import { addNightOverlays } from './night-lights-layer';
import { SHADE_EDGES, nightShadeGeoJSON, subsolarPoint, sunAltitudeDeg } from './terminator/solar';

const SOURCE = 'solar-terminator';
const LAYER = `${SOURCE}-shade`;
const REFRESH_MS = 60_000;
const ATLANTA: [number, number] = [-84.388, 33.749];
const bound = new WeakSet<MapLibreMap>();

const fmt = (deg: number, pos: string, neg: string) => `${Math.abs(deg).toFixed(2)}°${deg >= 0 ? pos : neg}`;

/** Day/night terminator shaded as one smooth gradient from sunset to astronomical night, computed from the sun's position. */
export function addTerminatorLayers(map: MapLibreMap): void {
  const now = new Date();
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: nightShadeGeoJSON(now), tolerance: 0 });
  if (!map.getLayer(LAYER)) {
    map.addLayer({
      id: LAYER,
      type: 'fill',
      source: SOURCE,
      paint: {
        'fill-color': '#000000',
        'fill-antialias': false,
        'fill-opacity': ['get', 'opacity'],
      },
    });
  }
  addNightOverlays(map, LAYER);
  if (bound.has(map)) return;
  bound.add(map);
  const refresh = () => {
    const t = new Date();
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(nightShadeGeoJSON(t));
    const sun = subsolarPoint(t);
    const alt = sunAltitudeDeg(sun, ATLANTA[0], ATLANTA[1]);
    reportGaFeed(map, {
      id: 'terminator', label: 'Day/night terminator', color: '#fbbf24', count: SHADE_EDGES.length,
      detail: `subsolar ${fmt(sun.declinationDeg, 'N', 'S')} ${fmt(sun.longitudeDeg, 'E', 'W')} · sun ${alt.toFixed(1)}° at Atlanta · shade ramps from sunset to black at −18° · computed (Astronomical Almanac low-precision formulae), no refraction model beyond the −0.833° sunset limit · night side: NASA Black Marble 2016 city lights (yearly composite, not live), Esri roads and labels`,
      updatedAt: t.toISOString(), sourceUrl: 'https://aa.usno.navy.mil/faq/sun_approx', error: null,
    });
  };
  refresh();
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') refresh();
  }, REFRESH_MS);
  map.once('remove', () => window.clearInterval(timer));
}

import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { reportGaFeed } from './ga-live-status';
import { TWILIGHT_BANDS, subsolarPoint, sunAltitudeDeg, twilightGeoJSON } from './terminator/solar';

const SOURCE = 'solar-terminator';
const REFRESH_MS = 60_000;
const ATLANTA: [number, number] = [-84.388, 33.749];
/** Per-band fill opacity; bands nest, so full astronomical night stacks all four. */
const BAND_OPACITY: Record<string, number> = { sunset: 0.14, civil: 0.1, nautical: 0.1, astronomical: 0.12 };
const bound = new WeakSet<MapLibreMap>();

const fmt = (deg: number, pos: string, neg: string) => `${Math.abs(deg).toFixed(2)}°${deg >= 0 ? pos : neg}`;

/** Day/night terminator with civil, nautical and astronomical twilight bands, computed from the sun's position. */
export function addTerminatorLayers(map: MapLibreMap): void {
  const now = new Date();
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: twilightGeoJSON(now), tolerance: 0 });
  for (const band of TWILIGHT_BANDS) {
    const id = `${SOURCE}-${band.id}`;
    if (map.getLayer(id)) continue;
    map.addLayer({
      id,
      type: 'fill',
      source: SOURCE,
      maxzoom: 8,
      filter: ['==', ['get', 'band'], band.id],
      paint: {
        'fill-color': '#020617',
        'fill-antialias': false,
        'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, BAND_OPACITY[band.id], 7.5, 0],
      },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);
  const refresh = () => {
    const t = new Date();
    (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(twilightGeoJSON(t));
    const sun = subsolarPoint(t);
    const alt = sunAltitudeDeg(sun, ATLANTA[0], ATLANTA[1]);
    reportGaFeed(map, {
      id: 'terminator', label: 'Day/night terminator', color: '#fbbf24', count: TWILIGHT_BANDS.length,
      detail: `subsolar ${fmt(sun.declinationDeg, 'N', 'S')} ${fmt(sun.longitudeDeg, 'E', 'W')} · sun ${alt.toFixed(1)}° at Atlanta · computed (Astronomical Almanac low-precision formulae), no refraction model beyond the −0.833° sunset limit`,
      updatedAt: t.toISOString(), sourceUrl: 'https://aa.usno.navy.mil/faq/sun_approx', error: null,
    });
  };
  refresh();
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') refresh();
  }, REFRESH_MS);
  map.once('remove', () => window.clearInterval(timer));
}

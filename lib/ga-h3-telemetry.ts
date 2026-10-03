import { Popup } from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { reportGaFeed } from './ga-live-status';
import { hitsGaAnomaly } from './ga-anomaly-bulbs';

const API = '/api/ga-telemetry';
const REFRESH_MS = 5 * 60_000;
const SPLIT_ZOOM = 12;
const ATTRIBUTION =
  'Atlanta crime hexagons: Atlanta Police Department Open Data (NIBRS reports, last 30 days), H3 cells with fewer than 5 reports withheld · City of Atlanta only';
const EMPTY = { type: 'FeatureCollection' as const, features: [] };
const RES = [7, 8] as const;

type HexPayload = {
  hex?: Record<string, GeoJSON.FeatureCollection>;
  density?: GeoJSON.FeatureCollection;
  precincts?: { geojson: GeoJSON.FeatureCollection | null };
  window?: { days: number; latestReport?: string | null };
  incidents?: number;
};

const bound = new WeakSet<MapLibreMap>();

/** H3 hexagon density layers for Atlanta Police open crime data (idempotent). */
export function addGaH3Telemetry(map: MapLibreMap): void {
  for (const r of RES) {
    const src = `ga-h3-r${r}`;
    if (!map.getSource(src)) map.addSource(src, { type: 'geojson', data: EMPTY, attribution: ATTRIBUTION });
    const zoom = r === 7 ? { maxzoom: SPLIT_ZOOM } : { minzoom: SPLIT_ZOOM };
    if (!map.getLayer(`${src}-fill`)) {
      map.addLayer({
        id: `${src}-fill`,
        type: 'fill',
        source: src,
        ...zoom,
        paint: {
          'fill-color': [
            'interpolate', ['linear'], ['get', 'count'],
            5, '#1e3a8a', 25, '#7c3aed', 75, '#db2777', 200, '#f97316', 500, '#facc15',
          ],
          'fill-opacity': 0.42,
        },
      });
    }
    if (!map.getLayer(`${src}-line`)) {
      map.addLayer({
        id: `${src}-line`,
        type: 'line',
        source: src,
        ...zoom,
        paint: { 'line-color': '#e0f2fe', 'line-width': 0.6, 'line-opacity': 0.55 },
      });
    }
  }
  if (!map.getSource('ga-h3-density')) map.addSource('ga-h3-density', { type: 'geojson', data: EMPTY });
  if (!map.getLayer('ga-h3-density-heat')) {
    map.addLayer({
      id: 'ga-h3-density-heat',
      type: 'heatmap',
      source: 'ga-h3-density',
      maxzoom: 15,
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'count'], 5, 0.1, 200, 1],
        'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 8, 10, 12, 40, 15, 90],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 8, 0.6, 14, 1.4],
        'heatmap-opacity': 0.55,
      },
    });
  }
  if (!map.getLayer('ga-h3-hotspot')) {
    map.addLayer({
      id: 'ga-h3-hotspot',
      type: 'line',
      source: 'ga-h3-r8',
      minzoom: 10,
      filter: ['>=', ['get', 'giConf'], 95],
      paint: {
        'line-color': ['case', ['>=', ['get', 'giConf'], 99], '#ff1744', '#ff9100'],
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1.2, 15, 3],
      },
    });
  }
  if (!map.getSource('ga-precincts')) map.addSource('ga-precincts', { type: 'geojson', data: EMPTY, attribution: 'APD main precincts (Voronoi service areas, approximate)' });
  if (!map.getLayer('ga-precincts-line')) {
    map.addLayer({
      id: 'ga-precincts-line',
      type: 'line',
      source: 'ga-precincts',
      minzoom: 9,
      paint: { 'line-color': '#00e5ff', 'line-width': 1.4, 'line-dasharray': [3, 2], 'line-opacity': 0.8 },
    });
  }
  if (!map.getLayer('ga-precincts-label')) {
    map.addLayer({
      id: 'ga-precincts-label',
      type: 'symbol',
      source: 'ga-precincts',
      minzoom: 10,
      layout: {
        'text-field': ['concat', ['get', 'name'], '\n', ['to-string', ['get', 'count']], ' reports / 30 d'],
        'text-size': 11,
      },
      paint: { 'text-color': '#e0f2fe', 'text-halo-color': '#001424', 'text-halo-width': 1.5 },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);

  let days = 30;
  const refresh = async () => {
    try {
      const r = await fetch(API);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as HexPayload;
      days = d.window?.days ?? days;
      for (const res of RES) (map.getSource(`ga-h3-r${res}`) as GeoJSONSource | undefined)?.setData(d.hex?.[res] ?? EMPTY);
      (map.getSource('ga-h3-density') as GeoJSONSource | undefined)?.setData(d.density ?? EMPTY);
      (map.getSource('ga-precincts') as GeoJSONSource | undefined)?.setData(d.precincts?.geojson ?? EMPTY);
      reportGaFeed(map, {
        id: 'crime', label: 'APD crime reports (hexes)', color: '#db2777', count: d.incidents ?? null,
        detail: `last ${days} days · City of Atlanta only · cells under 5 hidden`,
        updatedAt: d.window?.latestReport ?? null, sourceUrl: 'https://atlanta-police-opendata-atlantapd.hub.arcgis.com',
      });
    } catch (err) {
      console.warn('[GaH3Telemetry] refresh failed:', err);
    }
  };
  void refresh();
  const timer = setInterval(() => void refresh(), REFRESH_MS);
  map.once('remove', () => {
    clearInterval(timer);
    bound.delete(map);
  });

  for (const r of RES) {
    const layer = `ga-h3-r${r}-fill`;
    map.on('click', layer, (e) => {
      const p = e.features?.[0]?.properties;
      if (!p || hitsGaAnomaly(map, e)) return;
      const box = document.createElement('div');
      box.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45';
      const top = p.topCategory === 'mixed' ? 'no single category with 5+ reports' : `${p.topCategory} (${p.topCategoryCount})`;
      const gi = Number(p.giConf ?? 0);
      const rows: [string, string][] = [
        ['Reports, last ' + days + ' days', String(p.count)],
        ['Most common', top],
        ...(p.giZ !== undefined ? [['Getis-Ord Gi* z', `${Number(p.giZ).toFixed(2)}${gi ? ` (hot spot, ${gi}%)` : ''}`] as [string, string]] : []),
        ['H3 cell', `${p.h3} (res ${p.resolution})`],
      ];
      const h = document.createElement('div');
      h.textContent = 'ATLANTA POLICE OPEN DATA · AGGREGATE';
      h.style.cssText = 'font-weight:800;margin-bottom:4px';
      box.append(h);
      for (const [k, v] of rows) {
        const row = document.createElement('div');
        const b = document.createElement('b');
        b.textContent = `${k}: `;
        row.append(b, v);
        box.append(row);
      }
      const a = document.createElement('a');
      a.href = 'https://atlanta-police-opendata-atlantapd.hub.arcgis.com';
      a.target = '_blank';
      a.rel = 'noreferrer';
      a.textContent = 'Source ↗';
      box.append(a);
      new Popup({ closeButton: true, maxWidth: 'min(280px, 90vw)' }).setLngLat(e.lngLat).setDOMContent(box).addTo(map);
    });
    map.on('mouseenter', layer, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', layer, () => (map.getCanvas().style.cursor = ''));
  }
}

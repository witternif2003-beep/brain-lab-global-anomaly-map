import { Popup } from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { insideRing, loadGaWallRing, type LngLat } from './ga-patrol-3d';
import { reportGaFeed } from './ga-live-status';
import { hitsGaDeck, setGaDeckGroup } from './ga-deck-overlay';
import { colorMatchExpression, GA_TRAFFIC_DEFAULT_COLOR, GA_TRAFFIC_TYPE_COLORS, hexToRgba } from './ga-point-colors';

const API = '/api/ga-traffic';
const REFRESH_MS = 5 * 60_000;
const ITEM = 'https://www.arcgis.com/home/item.html?id=24c16968306b42779776ec24a88574ee';
const ATTRIBUTION =
  'GA traffic events: Georgia DOT 511GA (public ArcGIS view by GEMA, refreshed every 15 min) · road events only, inside the GA wall';
const EMPTY = { type: 'FeatureCollection' as const, features: [] };
const POINTS = 'ga-traffic-points';
const LINES = 'ga-traffic-lines';

const TYPE_COLOR = colorMatchExpression('type', GA_TRAFFIC_TYPE_COLORS, GA_TRAFFIC_DEFAULT_COLOR);

type TrafficPayload = {
  points?: GeoJSON.FeatureCollection;
  lines?: GeoJSON.FeatureCollection;
  summary?: { byType: Record<string, number>; bySeverity: Record<string, number>; fullClosures: number; latestUpdate: string | null };
};

const bound = new WeakSet<MapLibreMap>();

function insideWall(ring: LngLat[], f: GeoJSON.Feature): boolean {
  if (!ring.length) return true;
  const g = f.geometry;
  if (g.type === 'Point') return insideRing(ring, g.coordinates as LngLat);
  if (g.type === 'LineString') return g.coordinates.some((c) => insideRing(ring, c as LngLat));
  return false;
}

function popup(map: MapLibreMap, lngLat: LngLat, p: Record<string, unknown>) {
  const box = document.createElement('div');
  box.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45';
  const h = document.createElement('div');
  h.textContent = `GA 511 · ${String(p.label).toUpperCase()} · ${String(p.severity).toUpperCase()}`;
  h.style.cssText = 'font-weight:800;margin-bottom:4px';
  box.append(h);
  const fmt = (v: unknown) => (typeof v === 'string' && v && v !== 'null' ? new Date(v).toLocaleString() : '');
  const rows: [string, string][] = [
    ['Road', [p.roadway, p.direction].filter(Boolean).join(' · ')],
    ['Details', String(p.description ?? '')],
    ['Lanes', String(p.lanes ?? '')],
    ['Full closure', p.fullClosure === true || p.fullClosure === 'true' ? 'yes' : 'no'],
    ['Started', fmt(p.start)],
    ['Planned end', fmt(p.plannedEnd)],
    ['Updated', fmt(p.lastUpdated)],
  ];
  for (const [k, v] of rows) {
    if (!v) continue;
    const row = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = `${k}: `;
    row.append(b, v);
    box.append(row);
  }
  const a = document.createElement('a');
  a.href = ITEM;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.textContent = 'Source ↗';
  box.append(a);
  new Popup({ closeButton: true, maxWidth: 'min(300px, 90vw)' }).setLngLat(lngLat).setDOMContent(box).addTo(map);
}

/** Live Georgia DOT 511 road events (incidents, closures, roadwork, special events) inside the GA wall (idempotent). */
export function addGaTrafficLayers(map: MapLibreMap): void {
  if (!map.getSource(LINES)) map.addSource(LINES, { type: 'geojson', data: EMPTY, attribution: ATTRIBUTION });
  if (!map.getSource(POINTS)) map.addSource(POINTS, { type: 'geojson', data: EMPTY, attribution: ATTRIBUTION });
  if (!map.getLayer(`${LINES}-line`)) {
    map.addLayer({
      id: `${LINES}-line`,
      type: 'line',
      source: LINES,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': TYPE_COLOR,
        'line-width': ['interpolate', ['linear'], ['zoom'], 6, 2, 14, 6],
        'line-opacity': 0.85,
        'line-dasharray': ['case', ['==', ['get', 'fullClosure'], true], ['literal', [1, 0]], ['literal', [2, 1]]],
      },
    });
  }
  if (!map.getLayer(`${POINTS}-label`)) {
    map.addLayer({
      id: `${POINTS}-label`,
      type: 'symbol',
      source: POINTS,
      minzoom: 9,
      layout: {
        'text-field': ['concat', ['get', 'label'], ' · ', ['get', 'roadway'], ['case', ['==', ['get', 'fullClosure'], true], ' · CLOSED', '']],
        'text-size': 10,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-max-width': 16,
        'symbol-sort-key': ['case', ['==', ['get', 'severity'], 'major'], 0, 1],
      },
      paint: { 'text-color': '#fde68a', 'text-halo-color': '#1c1917', 'text-halo-width': 1.4 },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);

  const refresh = async () => {
    try {
      const [r, ring] = await Promise.all([fetch(API), loadGaWallRing().catch(() => [] as LngLat[])]);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as TrafficPayload;
      const clip = (fc?: GeoJSON.FeatureCollection) => ({ type: 'FeatureCollection' as const, features: (fc?.features ?? []).filter((f) => insideWall(ring, f)) });
      const points = clip(d.points);
      (map.getSource(POINTS) as GeoJSONSource | undefined)?.setData(points);
      (map.getSource(LINES) as GeoJSONSource | undefined)?.setData(clip(d.lines));
      setGaDeckGroup(map, 'traffic', {
        z: 10,
        items: points.features.flatMap((feature) => {
          if (feature.geometry.type !== 'Point') return [];
          const props = feature.properties ?? {};
          const major = props.severity === 'major';
          const color = GA_TRAFFIC_TYPE_COLORS[String(props.type)] ?? GA_TRAFFIC_DEFAULT_COLOR;
          const stroke = props.fullClosure === true || props.fullClosure === 'true' ? '#ffffff' : '#111827';
          return [{
            coord: feature.geometry.coordinates as LngLat,
            radiusPx: major ? 6 : 4,
            icon: 'alert' as const,
            iconPx: major ? 20 : 15,
            fill: hexToRgba(color, 235),
            stroke: hexToRgba(stroke),
            strokePx: major ? 2 : 1,
            props: { ...props },
          }];
        }),
        onClick: popup,
      });
      const types = Object.entries(d.summary?.byType ?? {}).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ');
      reportGaFeed(map, {
        id: 'traffic', label: 'GDOT 511 road events', color: '#f97316', count: points.features.length,
        detail: `${types}${d.summary ? ` · ${d.summary.bySeverity.major ?? 0} major` : ''}`,
        updatedAt: d.summary?.latestUpdate ?? null, sourceUrl: ITEM,
      });
    } catch (err) {
      console.warn('[GaTraffic] refresh failed:', err);
    }
  };
  void refresh();
  const timer = setInterval(() => void refresh(), REFRESH_MS);
  map.once('remove', () => {
    clearInterval(timer);
    bound.delete(map);
  });

  map.on('click', `${LINES}-line`, (e) => {
    if (hitsGaDeck(map, e.point)) return;
    const props = e.features?.[0]?.properties;
    if (props) popup(map, [e.lngLat.lng, e.lngLat.lat], props);
  });
  map.on('mouseenter', `${LINES}-line`, () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', `${LINES}-line`, () => (map.getCanvas().style.cursor = ''));
}

import { Popup, type ExpressionSpecification, type Map as MapLibreMap, type MapLayerMouseEvent } from 'maplibre-gl';
import { reportGaFeed } from './ga-live-status';
import { gaTrafficFlowStatus } from './ga-traffic-flow-layer';
import {
  INCIDENT_CATEGORIES, INCIDENT_ICON_EXPRESSION, INCIDENT_ICON_GROUPS, INCIDENT_LINE_LAYER, INCIDENT_POI_LAYER, INCIDENT_TILE_PATH, MAGNITUDE,
  TOMTOM_INCIDENT_TILES_DOCS_URL, incidentImageId, type IncidentIcon,
} from './ga-traffic-incidents/incidents';

export const GA_TRAFFIC_INCIDENTS_SOURCE = 'ga-traffic-incidents';
export const GA_TRAFFIC_INCIDENTS_LINE = 'ga-traffic-incidents-line';
export const GA_TRAFFIC_INCIDENTS_POI = 'ga-traffic-incidents-poi';
const LABEL = 'Traffic incidents (TomTom)';
const S = 48;

type Shape = 'triangle' | 'cone' | 'circle' | 'square' | 'diamond';
const DRAW: Record<IncidentIcon, { shape: Shape; fill: string; mark: 'bang' | 'bar' | 'bars' | 'dots' | 'query' | 'stripes' }> = {
  accident: { shape: 'triangle', fill: '#ef4444', mark: 'bang' },
  roadworks: { shape: 'cone', fill: '#f97316', mark: 'stripes' },
  closed: { shape: 'circle', fill: '#7f1d1d', mark: 'bar' },
  lane: { shape: 'square', fill: '#fb923c', mark: 'bar' },
  jam: { shape: 'circle', fill: '#dc2626', mark: 'bars' },
  weather: { shape: 'diamond', fill: '#38bdf8', mark: 'bang' },
  breakdown: { shape: 'triangle', fill: '#facc15', mark: 'bang' },
  cluster: { shape: 'circle', fill: '#ff4fd8', mark: 'dots' },
  unknown: { shape: 'diamond', fill: '#94a3b8', mark: 'query' },
};

/** 48×48 canvas glyph (added at pixelRatio 2), so no sprite or glyph font is needed. */
function incidentImage(icon: IncidentIcon): ImageData {
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const { shape, fill, mark } = DRAW[icon];
  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.strokeStyle = '#0b0e14';
  g.fillStyle = fill;
  g.beginPath();
  if (shape === 'triangle') { g.moveTo(24, 4); g.lineTo(44, 42); g.lineTo(4, 42); g.closePath(); }
  else if (shape === 'cone') { g.moveTo(24, 4); g.lineTo(34, 38); g.lineTo(42, 38); g.lineTo(42, 44); g.lineTo(6, 44); g.lineTo(6, 38); g.lineTo(14, 38); g.closePath(); }
  else if (shape === 'circle') g.arc(24, 24, 20, 0, Math.PI * 2);
  else if (shape === 'square') g.roundRect(5, 5, 38, 38, 6);
  else { g.moveTo(24, 3); g.lineTo(45, 24); g.lineTo(24, 45); g.lineTo(3, 24); g.closePath(); }
  g.fill();
  g.stroke();
  const ink = mark === 'bang' && icon === 'breakdown' ? '#0b0e14' : '#ffffff';
  g.fillStyle = ink;
  if (mark === 'bang') { g.fillRect(21.5, shape === 'triangle' ? 16 : 12, 5, 14); g.fillRect(21.5, shape === 'triangle' ? 33 : 31, 5, 5); }
  else if (mark === 'bar') g.fillRect(10, 21, 28, 6);
  else if (mark === 'bars') for (const y of [15, 22, 29]) g.fillRect(12, y, 24, 4);
  else if (mark === 'dots') for (const x of [14, 24, 34]) { g.beginPath(); g.arc(x, 24, 3.5, 0, Math.PI * 2); g.fill(); }
  else if (mark === 'stripes') { g.fillRect(16, 18, 16, 4); g.fillRect(12, 28, 24, 4); }
  else { g.fillRect(21.5, 30, 5, 5); g.fillRect(21.5, 22, 5, 6); g.fillRect(26.5, 13, 5, 11); g.fillRect(16.5, 13, 15, 4); }
  return g.getImageData(0, 0, S, S);
}

const MAGNITUDE_COLOR = ['match', ['to-number', ['get', 'magnitude'], 0], 1, '#fb923c', 2, '#ef4444', 3, '#991b1b', 4, '#7f1d1d', '#94a3b8'] as ExpressionSpecification;

function popup(map: MapLibreMap, e: MapLayerMouseEvent) {
  const p = (e.features?.[0]?.properties ?? {}) as Record<string, unknown>;
  const cat = Number(p.icon_category_0 ?? p.icon_category ?? 0);
  const el = document.createElement('div');
  el.style.cssText = 'font:12px/1.4 system-ui;color:#0b0e14;min-width:180px';
  const rows: Array<[string, string]> = [
    ['Type', INCIDENT_CATEGORIES[cat] ?? 'Unknown'],
    ['Description', String(p.description_0 ?? p.description ?? '—')],
    ['Delay', typeof p.delay === 'number' ? `${Math.round(p.delay / 60)} min` : '—'],
    ['Magnitude', MAGNITUDE[Number(p.magnitude ?? 0)] ?? 'unknown'],
    ['Road', String(p.road_type ?? '—')],
  ];
  if (p.cluster_size) rows.push(['Incidents here', String(p.cluster_size)]);
  for (const [k, v] of rows) {
    const r = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = `${k}: `;
    r.append(b, v);
    el.append(r);
  }
  const src = document.createElement('a');
  src.href = TOMTOM_INCIDENT_TILES_DOCS_URL;
  src.target = '_blank';
  src.rel = 'noopener';
  src.textContent = 'Traffic incidents © TomTom (live)';
  src.style.cssText = 'display:block;margin-top:4px;color:#0369a1';
  el.append(src);
  new Popup({ closeButton: true, maxWidth: 'min(300px, 90vw)' }).setLngLat(e.lngLat).setDOMContent(el).addTo(map);
}

/** Live TomTom incidents statewide from vector incident tiles via the key-hiding proxy: dashed incident stretches plus canvas icons. Off without a key. */
export async function addGaTrafficIncidents(map: MapLibreMap): Promise<void> {
  let live = false;
  try {
    live = (await gaTrafficFlowStatus(map)).mode === 'live';
  } catch {
    live = false;
  }
  if (!live) {
    reportGaFeed(map, { id: 'traffic-incidents', label: LABEL, color: '#ef4444', count: null, updatedAt: null, sourceUrl: TOMTOM_INCIDENT_TILES_DOCS_URL, error: 'off: no TomTom key (set TOMTOM_API_KEY)' });
    return;
  }
  for (const g of [...INCIDENT_ICON_GROUPS.map((x) => x.icon), 'unknown' as const]) {
    const id = incidentImageId(g);
    if (!map.hasImage(id)) map.addImage(id, incidentImage(g), { pixelRatio: 2 });
  }
  if (!map.getSource(GA_TRAFFIC_INCIDENTS_SOURCE)) {
    map.addSource(GA_TRAFFIC_INCIDENTS_SOURCE, { type: 'vector', tiles: [`${location.origin}${INCIDENT_TILE_PATH}`], minzoom: 0, maxzoom: 18, attribution: 'Traffic incidents © TomTom' });
  }
  if (!map.getLayer(GA_TRAFFIC_INCIDENTS_LINE)) {
    map.addLayer({
      id: GA_TRAFFIC_INCIDENTS_LINE,
      type: 'line',
      source: GA_TRAFFIC_INCIDENTS_SOURCE,
      'source-layer': INCIDENT_LINE_LAYER,
      minzoom: 8,
      layout: { 'line-join': 'round', 'line-cap': 'butt' },
      paint: { 'line-color': MAGNITUDE_COLOR, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 2, 14, 4, 18, 7], 'line-dasharray': [1.5, 1], 'line-offset': ['interpolate', ['linear'], ['zoom'], 10, 0, 16, 6] },
    });
  }
  if (!map.getLayer(GA_TRAFFIC_INCIDENTS_POI)) {
    map.addLayer({
      id: GA_TRAFFIC_INCIDENTS_POI,
      type: 'symbol',
      source: GA_TRAFFIC_INCIDENTS_SOURCE,
      'source-layer': INCIDENT_POI_LAYER,
      minzoom: 5,
      layout: { 'icon-image': INCIDENT_ICON_EXPRESSION, 'icon-size': ['interpolate', ['linear'], ['zoom'], 5, 0.7, 12, 1, 16, 1.25], 'icon-allow-overlap': true, 'icon-ignore-placement': true },
    });
  }
  const swatches = INCIDENT_ICON_GROUPS.map((g) => ({ label: g.label, color: g.color }));
  const report = () => {
    const n = map.getLayer(GA_TRAFFIC_INCIDENTS_POI) ? map.queryRenderedFeatures({ layers: [GA_TRAFFIC_INCIDENTS_POI] }).length : 0;
    reportGaFeed(map, { id: 'traffic-incidents', label: LABEL, color: '#ef4444', count: n, detail: 'incident icons in view (clusters count once) · live, tiles cached 120 s', updatedAt: new Date().toISOString(), sourceUrl: TOMTOM_INCIDENT_TILES_DOCS_URL, swatches });
  };
  report();
  map.on('idle', report);
  map.on('click', GA_TRAFFIC_INCIDENTS_POI, (e) => popup(map, e));
  map.on('mouseenter', GA_TRAFFIC_INCIDENTS_POI, () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', GA_TRAFFIC_INCIDENTS_POI, () => (map.getCanvas().style.cursor = ''));
  map.once('remove', () => map.off('idle', report));
}

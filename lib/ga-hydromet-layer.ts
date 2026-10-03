import { Popup } from 'maplibre-gl';
import type { ExpressionSpecification, GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from 'maplibre-gl';
import { insideRing, loadGaWallRing, type LngLat } from './ga-patrol-3d';
import { reportGaFeed } from './ga-live-status';
import { hitsGaDeck, setGaDeckGroup } from './ga-deck-overlay';
import { colorMatchExpression, GA_FLOOD_CATEGORY_COLORS, GA_FLOOD_DEFAULT_COLOR, hexToRgba } from './ga-point-colors';

const API = '/api/ga-hydromet';
const REFRESH_MS = 5 * 60_000;
const ALERTS = 'ga-nws-alerts';
const GAUGES = 'ga-river-gauges';
const EMPTY = { type: 'FeatureCollection' as const, features: [] };

const SEVERITY_COLOR: ExpressionSpecification = [
  'match', ['get', 'severity'], 'Extreme', '#a855f7', 'Severe', '#ef4444', 'Moderate', '#f97316', 'Minor', '#facc15', '#38bdf8',
];
const FLOOD_COLOR = colorMatchExpression('category', GA_FLOOD_CATEGORY_COLORS, GA_FLOOD_DEFAULT_COLOR);
const CATEGORY_TEXT: Record<string, string> = {
  no_flooding: 'Below flood stage', action: 'Action stage', minor: 'Minor flooding', moderate: 'Moderate flooding', major: 'Major flooding',
  low_threshold: 'Below gauge threshold', not_defined: 'No flood stage defined', out_of_service: 'Out of service', obs_not_current: 'Observation not current',
  fcst_not_current: 'No current forecast',
};

interface Payload {
  alerts?: { geojson: GeoJSON.FeatureCollection; summary: { total: number; mapped: number; byEvent: Record<string, number> }; updated: string | null; sourceUrl: string; error: string | null };
  gauges?: { geojson: GeoJSON.FeatureCollection; summary: { total: number; flooding: number; action: number; latestObservation: string | null }; sourceUrl: string; error: string | null };
  generatedAt?: string;
}

const bound = new WeakSet<MapLibreMap>();

function box(title: string, rows: [string, string][], href: string, link: string) {
  const el = document.createElement('div');
  el.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45';
  const h = document.createElement('div');
  h.textContent = title;
  h.style.cssText = 'font-weight:800;margin-bottom:4px';
  el.append(h);
  for (const [k, v] of rows) {
    if (!v) continue;
    const row = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = `${k}: `;
    row.append(b, v);
    el.append(row);
  }
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.textContent = link;
  el.append(a);
  return el;
}

const when = (v: unknown) => (typeof v === 'string' && v && v !== 'null' ? new Date(v).toLocaleString() : '');
const num = (v: unknown, unit: unknown) => (v === null || v === undefined || v === 'null' ? '' : `${Number(v).toFixed(2)} ${String(unit ?? '')}`.trim());

function gaugePopup(map: MapLibreMap, lngLat: LngLat, p: Record<string, unknown>) {
  const el = box(
    `NOAA RIVER GAUGE · ${String(p.lid)}`,
    [
      ['Site', String(p.name)],
      ['Status', CATEGORY_TEXT[String(p.category)] ?? String(p.category)],
      ['Stage', num(p.stage, p.stageUnit)],
      ['Flow', num(p.flow, p.flowUnit)],
      ['Observed', when(p.observedAt)],
      ['Forecast', p.forecastAt ? `${num(p.forecastStage, p.stageUnit)} · ${CATEGORY_TEXT[String(p.forecastCategory)] ?? p.forecastCategory} · ${when(p.forecastAt)}` : ''],
    ],
    `https://water.noaa.gov/gauges/${encodeURIComponent(String(p.lid).toLowerCase())}`,
    'Hydrograph ↗',
  );
  new Popup({ closeButton: true, maxWidth: 'min(300px, 90vw)' }).setLngLat(lngLat).setDOMContent(el).addTo(map);
}

function alertPopup(map: MapLibreMap, e: MapLayerMouseEvent) {
  const p = e.features?.[0]?.properties;
  if (!p) return;
  const el = box(
    `NWS · ${String(p.event).toUpperCase()}`,
    [
      ['Headline', String(p.headline ?? '')],
      ['Severity', `${p.severity} · ${p.urgency} · ${p.certainty}`],
      ['Area', String(p.areaDesc ?? '')],
      ['Onset', when(p.onset)],
      ['Ends', when(p.ends)],
      ['Issued by', String(p.sender ?? '')],
      ['Outline', String(p.geometrySource ?? '')],
    ],
    'https://alerts.weather.gov/search?area=GA',
    'All Georgia alerts ↗',
  );
  new Popup({ closeButton: true, maxWidth: 'min(320px, 90vw)' }).setLngLat(e.lngLat).setDOMContent(el).addTo(map);
}

/** Live NWS alerts and NOAA river-gauge flood status inside the GA wall (idempotent). */
export function addGaHydrometLayers(map: MapLibreMap): void {
  if (!map.getSource(ALERTS))
    map.addSource(ALERTS, { type: 'geojson', data: EMPTY, attribution: 'GA weather alerts: National Weather Service (api.weather.gov)' });
  if (!map.getSource(GAUGES))
    map.addSource(GAUGES, { type: 'geojson', data: EMPTY, attribution: 'GA river gauges: NOAA National Water Prediction Service / USGS (provisional data)' });
  if (!map.getLayer(`${ALERTS}-fill`))
    map.addLayer({ id: `${ALERTS}-fill`, type: 'fill', source: ALERTS, paint: { 'fill-color': SEVERITY_COLOR, 'fill-opacity': 0.16 } });
  if (!map.getLayer(`${ALERTS}-line`))
    map.addLayer({ id: `${ALERTS}-line`, type: 'line', source: ALERTS, paint: { 'line-color': SEVERITY_COLOR, 'line-width': 1.6, 'line-dasharray': [4, 2] } });
  if (!map.getLayer(`${GAUGES}-label`)) {
    map.addLayer({
      id: `${GAUGES}-label`,
      type: 'symbol',
      source: GAUGES,
      minzoom: 9,
      layout: { 'text-field': ['get', 'label'], 'text-size': 10, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-max-width': 14, 'symbol-sort-key': ['-', 0, ['get', 'rank']] },
      paint: { 'text-color': FLOOD_COLOR, 'text-halo-color': '#001424', 'text-halo-width': 1.4 },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);

  const refresh = async () => {
    try {
      const [r, ring] = await Promise.all([fetch(API), loadGaWallRing().catch(() => [] as LngLat[])]);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as Payload;
      (map.getSource(ALERTS) as GeoJSONSource | undefined)?.setData(d.alerts?.geojson ?? EMPTY);
      const gauges = (d.gauges?.geojson.features ?? []).filter(
        (f) => !ring.length || (f.geometry.type === 'Point' && insideRing(ring, f.geometry.coordinates as LngLat)),
      );
      (map.getSource(GAUGES) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: gauges });
      setGaDeckGroup(map, 'gauges', {
        z: 20,
        items: gauges.flatMap((feature) => {
          if (feature.geometry.type !== 'Point') return [];
          const props = feature.properties ?? {};
          const color = GA_FLOOD_CATEGORY_COLORS[String(props.category)] ?? GA_FLOOD_DEFAULT_COLOR;
          return [{
            coord: feature.geometry.coordinates as LngLat,
            radiusPx: Number(props.rank) >= 1 ? 6 : 3.5,
            fill: hexToRgba(color, 230),
            stroke: hexToRgba('#0c4a6e'),
            strokePx: 1,
            props: { ...props },
          }];
        }),
        onClick: gaugePopup,
      });
      if (d.alerts) {
        const events = Object.entries(d.alerts.summary.byEvent).map(([k, v]) => `${v} ${k}`).join(', ');
        reportGaFeed(map, {
          id: 'alerts', label: 'NWS weather alerts', color: '#facc15', count: d.alerts.summary.total,
          detail: events || 'none active', updatedAt: d.alerts.updated ?? d.generatedAt ?? null, sourceUrl: 'https://alerts.weather.gov/search?area=GA', error: d.alerts.error,
        });
      }
      if (d.gauges) {
        reportGaFeed(map, {
          id: 'gauges', label: 'NOAA river gauges', color: '#22c55e', count: gauges.length,
          detail: `${d.gauges.summary.flooding} flooding, ${d.gauges.summary.action} at action stage`,
          updatedAt: d.gauges.summary.latestObservation, sourceUrl: d.gauges.sourceUrl, error: d.gauges.error,
        });
      }
    } catch (err) {
      console.warn('[GaHydromet] refresh failed:', err);
    }
  };
  void refresh();
  const timer = setInterval(() => void refresh(), REFRESH_MS);
  map.once('remove', () => {
    clearInterval(timer);
    bound.delete(map);
  });

  map.on('click', `${ALERTS}-fill`, (e) => {
    if (hitsGaDeck(map, e.point)) return;
    if (map.queryRenderedFeatures(e.point).some((f) => f.layer.id !== `${ALERTS}-fill` && f.layer.type !== 'raster' && f.layer.type !== 'background' && /^(ga-|disney)/.test(f.layer.id))) return;
    alertPopup(map, e);
  });
  map.on('mouseenter', `${ALERTS}-fill`, () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', `${ALERTS}-fill`, () => (map.getCanvas().style.cursor = ''));
}

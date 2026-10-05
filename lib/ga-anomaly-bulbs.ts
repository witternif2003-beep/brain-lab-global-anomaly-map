import { Popup } from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import { insideRing, loadGaWallRing, type LngLat } from './ga-patrol-3d';
import { reportGaFeed } from './ga-live-status';
import { setGaDeckGroup } from './ga-deck-overlay';
import { GA_ANOMALY_LEVEL_COLORS, hexToRgba } from './ga-point-colors';

export const GA_ANOMALY_SOURCE = 'ga-anomaly-bulbs';
const LABEL = `${GA_ANOMALY_SOURCE}-label`;
const REFRESH_MS = 5 * 60_000;
const CORE_PX = 7;
const EMPTY = { type: 'FeatureCollection' as const, features: [] };
const ATTRIBUTION =
  'Anomaly bulbs: rule-based flags on public feeds (APD open data Gi* hotspots, NOAA/NWS gauges and alerts, Georgia DOT 511) · statistical/threshold signals, not findings about any person';

const LEVEL_TEXT = ['', 'LOW', 'GUARDED', 'ELEVATED', 'HIGH'];

type Level = 1 | 2 | 3 | 4;
interface Bulb {
  coord: LngLat;
  level: Level;
  kind: 'crime' | 'gauge' | 'alert' | 'traffic';
  title: string;
  label: string;
  observedAt: string | null;
  confidence: string;
  basis: string;
  action: string;
  sourceName: string;
  sourceUrl: string;
}

type Props = Record<string, unknown>;
type Feature = GeoJSON.Feature<GeoJSON.Geometry, Props>;
type FC = { features?: Feature[] };

interface Telemetry {
  hex?: Record<string, FC>;
  window?: { days: number; latestReport?: string | null };
  sourceUrl?: string;
}
interface Hydromet {
  alerts?: { geojson: FC; updated: string | null };
  gauges?: { geojson: FC; sourceUrl: string };
}
interface Traffic {
  points?: FC;
  sourceUrl?: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));

function centroid(g: GeoJSON.Geometry): LngLat | null {
  if (g.type === 'Point') return g.coordinates as LngLat;
  const ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates.flatMap((p) => p[0]) : null;
  if (!ring?.length) return null;
  let x = 0;
  let y = 0;
  for (const [lng, lat] of ring) {
    x += lng;
    y += lat;
  }
  return [x / ring.length, y / ring.length];
}

const MERGE_KM = 1.0;

function km(a: LngLat, b: LngLat): number {
  const dx = (a[0] - b[0]) * 111.32 * Math.cos(((a[1] + b[1]) / 2) * (Math.PI / 180));
  const dy = (a[1] - b[1]) * 110.57;
  return Math.hypot(dx, dy);
}

interface HotCell {
  c: LngLat;
  level: Level;
  conf: number;
  z: number;
  count: number;
  top: string;
}

/** Single-linkage groups of adjacent same-level cells so one bulb marks one contiguous hotspot. */
function clusterCells(cells: HotCell[]): HotCell[][] {
  const parent = cells.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < cells.length; i++)
    for (let j = i + 1; j < cells.length; j++)
      if (cells[i].level === cells[j].level && km(cells[i].c, cells[j].c) <= MERGE_KM) parent[find(i)] = find(j);
  const groups = new Map<number, HotCell[]>();
  cells.forEach((cell, i) => groups.set(find(i), [...(groups.get(find(i)) ?? []), cell]));
  return [...groups.values()];
}

function crimeBulbs(d: Telemetry): Bulb[] {
  const days = d.window?.days ?? 30;
  const cells = (d.hex?.['8']?.features ?? []).flatMap((f): HotCell[] => {
    const conf = Number(f.properties.giConf ?? 0);
    const c = centroid(f.geometry);
    if (conf < 90 || !c) return [];
    return [{
      c,
      level: conf >= 99 ? 4 : conf >= 95 ? 3 : 2,
      conf,
      z: Number(f.properties.giZ ?? 0),
      count: Number(f.properties.count ?? 0),
      top: str(f.properties.topCategory),
    }];
  });
  return clusterCells(cells).map((g): Bulb => {
    const total = g.reduce((n, x) => n + x.count, 0);
    const w = total || g.length;
    const coord: LngLat = [
      g.reduce((s, x) => s + x.c[0] * (total ? x.count : 1), 0) / w,
      g.reduce((s, x) => s + x.c[1] * (total ? x.count : 1), 0) / w,
    ];
    const peak = g.reduce((a, b) => (b.z > a.z ? b : a));
    return {
      coord,
      level: g[0].level,
      kind: 'crime',
      title: 'ATLANTA CRIME HOTSPOT (AGGREGATE)',
      label: `Hotspot ${peak.conf}% · ${g.length} cell${g.length > 1 ? 's' : ''}`,
      observedAt: d.window?.latestReport ?? null,
      confidence: `${peak.conf}% (Getis-Ord Gi*)`,
      basis: `${g.length > 1 ? `${g.length} adjacent H3 res-8 cells` : '1 H3 res-8 cell'}, ${total} reports over ${days} days; peak Gi* z = ${peak.z.toFixed(2)} (most common there: ${peak.top})`,
      action: 'Review the area in APD open data. Area-level pattern only; not evidence about any person or address.',
      sourceName: 'Atlanta Police Department Open Data',
      sourceUrl: 'https://atlanta-police-opendata-atlantapd.hub.arcgis.com',
    };
  });
}

const FLOOD_LEVEL: Record<string, Level> = { action: 2, minor: 3, moderate: 4, major: 4 };

function gaugeBulbs(d: Hydromet): Bulb[] {
  return (d.gauges?.geojson.features ?? []).flatMap((f): Bulb[] => {
    const p = f.properties;
    const obs = FLOOD_LEVEL[str(p.category)];
    const fc = FLOOD_LEVEL[str(p.forecastCategory)];
    const level = Math.max(obs ?? 0, fc ?? 0) as Level | 0;
    const c = centroid(f.geometry);
    if (!level || !c) return [];
    const forecastOnly = !obs;
    return [{
      coord: c,
      level,
      kind: 'gauge',
      title: `RIVER GAUGE · ${str(p.name).toUpperCase()}`,
      label: `${str(p.lid)} ${forecastOnly ? 'fcst ' : ''}${str(forecastOnly ? p.forecastCategory : p.category)}`,
      observedAt: str(p.observedAt) || null,
      confidence: forecastOnly ? 'NWS forecast category' : 'Observed stage vs NWS flood categories',
      basis: `Stage ${str(p.stage)} ${str(p.stageUnit)}; observed ${str(p.category)}; forecast ${str(p.forecastCategory)}${p.forecastStage ? ` (${str(p.forecastStage)} ${str(p.stageUnit)})` : ''}`,
      action: 'Follow NWS river forecasts; do not drive through flooded roads.',
      sourceName: 'NOAA National Water Prediction Service',
      sourceUrl: `https://water.noaa.gov/gauges/${str(p.lid).toLowerCase()}`,
    }];
  });
}

const ALERT_LEVEL: Record<string, Level> = { Minor: 2, Moderate: 3, Severe: 4, Extreme: 4 };

function alertBulbs(d: Hydromet): Bulb[] {
  return (d.alerts?.geojson.features ?? []).flatMap((f): Bulb[] => {
    const p = f.properties;
    const c = f.geometry ? centroid(f.geometry) : null;
    if (!c) return [];
    return [{
      coord: c,
      level: ALERT_LEVEL[str(p.severity)] ?? 1,
      kind: 'alert',
      title: `NWS · ${str(p.event).toUpperCase()}`,
      label: str(p.event),
      observedAt: str(p.onset) || d.alerts?.updated || null,
      confidence: `NWS certainty: ${str(p.certainty) || 'n/a'}`,
      basis: `${str(p.severity)} severity, ${str(p.urgency)} urgency · ${str(p.areaDesc)}`,
      action: 'Follow the instructions in the NWS alert.',
      sourceName: 'National Weather Service',
      sourceUrl: 'https://alerts.weather.gov/search?area=GA',
    }];
  });
}

function trafficBulbs(d: Traffic): Bulb[] {
  return (d.points?.features ?? []).flatMap((f): Bulb[] => {
    const p = f.properties;
    const incident = p.type === 'incident';
    const major = p.severity === 'major';
    const closure = p.fullClosure === true;
    if (!incident && !(closure && major)) return [];
    const c = centroid(f.geometry);
    if (!c) return [];
    const level: Level = incident ? (major || closure ? 4 : 3) : 3;
    return [{
      coord: c,
      level,
      kind: 'traffic',
      title: `GDOT 511 · ${str(p.label).toUpperCase()}${closure ? ' · FULL CLOSURE' : ''}`,
      label: `${str(p.roadway)}${closure ? ' CLOSED' : ''}`,
      observedAt: str(p.lastUpdated) || null,
      confidence: 'Reported by Georgia DOT 511',
      basis: `${str(p.severity)} severity · ${str(p.direction)} · ${str(p.description)}`,
      action: 'Check 511GA before travel and use alternate routes.',
      sourceName: 'Georgia DOT 511 (public ArcGIS view)',
      sourceUrl: 'https://511ga.org/',
    }];
  });
}

function toFeature(b: Bulb, i: number): GeoJSON.Feature<GeoJSON.Point> {
  return {
    type: 'Feature',
    id: i,
    geometry: { type: 'Point', coordinates: b.coord },
    properties: { ...b, coord: undefined, color: GA_ANOMALY_LEVEL_COLORS[b.level] },
  };
}

function popup(map: MapLibreMap, lngLat: LngLat, p: Record<string, unknown>) {
  const level = Number(p.level);
  const el = document.createElement('div');
  el.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45';
  const h = document.createElement('div');
  h.style.cssText = `font-weight:800;margin-bottom:4px;border-left:4px solid ${GA_ANOMALY_LEVEL_COLORS[level]};padding-left:6px`;
  h.textContent = `${str(p.title)} · ${LEVEL_TEXT[level]}`;
  el.append(h);
  const observed = str(p.observedAt);
  const rows: [string, string][] = [
    ['Source', str(p.sourceName)],
    ['Observed', observed ? new Date(observed).toLocaleString() : 'no timestamp'],
    ['Location', `${lngLat[1].toFixed(4)}, ${lngLat[0].toFixed(4)}`],
    ['Confidence', str(p.confidence)],
    ['Basis', str(p.basis)],
    ['Suggested action', str(p.action)],
  ];
  for (const [k, v] of rows) {
    const row = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = `${k}: `;
    row.append(b, v);
    el.append(row);
  }
  const a = document.createElement('a');
  a.href = str(p.sourceUrl);
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.textContent = 'Open source ↗';
  el.append(a);
  new Popup({ closeButton: true, maxWidth: 'min(340px, 90vw)' }).setLngLat(lngLat).setDOMContent(el).addTo(map);
}

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

const bound = new WeakSet<MapLibreMap>();

/** Fixed-size glowing anomaly indicators flagged from the live public Georgia feeds (idempotent). */
export function addGaAnomalyBulbs(map: MapLibreMap): void {
  if (!map.getSource(GA_ANOMALY_SOURCE))
    map.addSource(GA_ANOMALY_SOURCE, { type: 'geojson', data: EMPTY, attribution: ATTRIBUTION });
  if (!map.getLayer(LABEL)) {
    map.addLayer({
      id: LABEL,
      type: 'symbol',
      source: GA_ANOMALY_SOURCE,
      minzoom: 9,
      layout: { 'text-field': ['get', 'label'], 'text-size': 10, 'text-offset': [0, 1.6], 'text-anchor': 'top', 'text-max-width': 14, 'symbol-sort-key': ['-', 0, ['get', 'level']] },
      paint: { 'text-color': '#f8fafc', 'text-halo-color': ['get', 'color'], 'text-halo-width': 1, 'text-halo-blur': 0.6 },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);

  const refresh = async () => {
    const [t, h, tr, ring] = await Promise.all([
      getJson<Telemetry>('/api/ga-telemetry'),
      getJson<Hydromet>('/api/ga-hydromet'),
      getJson<Traffic>('/api/ga-traffic'),
      loadGaWallRing().catch(() => [] as LngLat[]),
    ]);
    const bulbs = [
      ...(t ? crimeBulbs(t) : []),
      ...(h ? [...gaugeBulbs(h), ...alertBulbs(h)] : []),
      ...(tr ? trafficBulbs(tr) : []),
    ].filter((b) => !ring.length || insideRing(ring, b.coord));
    const features = bulbs.map(toFeature);
    (map.getSource(GA_ANOMALY_SOURCE) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features });
    setGaDeckGroup(map, 'bulbs', {
      z: 30,
      items: bulbs.map((bulb) => ({
        coord: bulb.coord,
        radiusPx: CORE_PX,
        icon: 'beacon' as const,
        iconPx: 22,
        fill: [248, 250, 252, 255],
        stroke: hexToRgba(GA_ANOMALY_LEVEL_COLORS[bulb.level]),
        strokePx: 2.5,
        glow: bulb.level / 4,
        pulse: bulb.level >= 3,
        props: { ...bulb },
      })),
      onClick: popup,
    });
    const byLevel = [4, 3, 2, 1].map((l) => [LEVEL_TEXT[l], bulbs.filter((b) => b.level === l).length] as const).filter(([, n]) => n);
    const failed = [!t && 'crime', !h && 'hydromet', !tr && 'traffic'].filter(Boolean);
    reportGaFeed(map, {
      id: 'anomalies',
      label: 'Anomaly bulbs (rule-based)',
      color: '#f8fafc',
      count: bulbs.length,
      detail: byLevel.map(([k, n]) => `${n} ${k.toLowerCase()}`).join(', ') || 'none flagged',
      updatedAt: new Date().toISOString(),
      sourceUrl: 'https://github.com/witternif2003-beep/brain-lab-global-anomaly-map/blob/devin/1790587184-jurisdiction-cards/lib/ga-anomaly-bulbs.ts',
      error: failed.length ? `feed unavailable: ${failed.join(', ')}` : null,
    });
  };
  void refresh();
  const timer = setInterval(() => void refresh(), REFRESH_MS);

  map.once('remove', () => {
    clearInterval(timer);
    bound.delete(map);
  });
}

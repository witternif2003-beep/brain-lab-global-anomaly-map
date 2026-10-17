import { Popup } from 'maplibre-gl';
import type { GeoJSONFeatureId, GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import { ADDINSIGHT_ATTRIBUTION, ADDINSIGHT_CATALOG, diffFeatures, type BleTrafficPayload } from './ble-traffic/aggregate';
import { reportGaFeed } from './ga-live-status';
import { hitsGaDeck } from './ga-deck-overlay';

const API = '/api/ble-traffic';
const REFRESH_MS = 60_000;
const BINS = 'ble-vehicle-bins';
const LINKS = 'ble-vehicle-links';
const FEED = { id: 'ble-vehicles', label: 'Bluetooth vehicle detectors (Canberra, ACT)', color: '#22d3ee', sourceUrl: ADDINSIGHT_CATALOG };
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

type IdFeature = GeoJSON.Feature & { id: GeoJSONFeatureId };

export interface BleFlushStats {
  diffSize: number;
  flushMs: number;
  at: number;
}

declare global {
  interface Window {
    __gaBle?: BleFlushStats;
  }
}

const bound = new WeakSet<MapLibreMap>();
const shown = new WeakMap<MapLibreMap, Record<string, Map<GeoJSONFeatureId, IdFeature>>>();

async function apply(map: MapLibreMap, id: string, next: IdFeature[]): Promise<number> {
  const src = map.getSource(id) as GeoJSONSource | undefined;
  if (!src) return 0;
  const state = shown.get(map) ?? {};
  shown.set(map, state);
  const prev = state[id] ?? new Map<GeoJSONFeatureId, IdFeature>();
  const diff = diffFeatures(prev, next);
  if (diff.size) await src.updateData(diff);
  state[id] = new Map(next.map((f) => [f.id, f]));
  return diff.size;
}

function popup(map: MapLibreMap, lngLat: [number, number], title: string, rows: [string, string][]) {
  const box = document.createElement('div');
  box.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45';
  const h = document.createElement('div');
  h.textContent = title;
  h.style.cssText = 'font-weight:800;margin-bottom:4px';
  box.append(h);
  for (const [k, v] of rows) {
    if (!v) continue;
    const row = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = `${k}: `;
    row.append(b, v);
    box.append(row);
  }
  const a = document.createElement('a');
  a.href = ADDINSIGHT_CATALOG;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.textContent = 'Source ↗ ACT Government open data (CC BY 4.0)';
  box.append(a);
  new Popup({ closeButton: true, maxWidth: 'min(300px, 90vw)' }).setLngLat(lngLat).setDOMContent(box).addTo(map);
}

const time = (iso: unknown) => (typeof iso === 'string' && iso ? new Date(iso).toLocaleString() : '');

/** Live ACT Government Bluetooth vehicle detectors: device counts per H3 cell (k ≥ 3) and road-link speeds; no device identifiers (idempotent). */
export function addBleVehicleLayers(map: MapLibreMap): void {
  if (!map.getSource(BINS)) map.addSource(BINS, { type: 'geojson', data: EMPTY, attribution: `${ADDINSIGHT_ATTRIBUTION} · device counts per H3 cell, cells under 3 devices withheld` });
  if (!map.getSource(LINKS)) map.addSource(LINKS, { type: 'geojson', data: EMPTY, attribution: ADDINSIGHT_ATTRIBUTION });
  shown.delete(map);
  if (!map.getLayer(`${LINKS}-line`)) {
    map.addLayer({
      id: `${LINKS}-line`,
      type: 'line',
      source: LINKS,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': [
          'case',
          ['==', ['get', 'closed'], true], '#a855f7',
          ['==', ['get', 'speedKmh'], null], '#64748b',
          ['interpolate', ['linear'], ['get', 'score'], 0, '#22c55e', 2, '#facc15', 4, '#f97316', 7, '#dc2626'],
        ],
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 5],
        'line-opacity': 0.9,
        'line-dasharray': ['case', ['==', ['get', 'speedKmh'], null], ['literal', [1, 1.5]], ['literal', [1, 0]]],
      },
    });
  }
  if (!map.getLayer(`${BINS}-fill`)) {
    map.addLayer({
      id: `${BINS}-fill`,
      type: 'fill',
      source: BINS,
      paint: {
        'fill-color': ['interpolate', ['linear'], ['get', 'density'], 0, '#0e7490', 20, '#22d3ee', 60, '#a5f3fc'],
        'fill-opacity': 0.45,
        'fill-outline-color': '#67e8f9',
      },
    });
  }
  if (!map.getLayer(`${BINS}-label`)) {
    map.addLayer({
      id: `${BINS}-label`,
      type: 'symbol',
      source: BINS,
      minzoom: 11,
      layout: { 'text-field': ['to-string', ['get', 'count']], 'text-size': 10, 'text-allow-overlap': false },
      paint: { 'text-color': '#ecfeff', 'text-halo-color': '#083344', 'text-halo-width': 1.2 },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);

  const refresh = async () => {
    try {
      const r = await fetch(API);
      const d = (await r.json()) as BleTrafficPayload & { error?: string };
      if (!r.ok || d.error) throw new Error(d.error ?? `HTTP ${r.status}`);
      const t0 = performance.now();
      const sizes = await Promise.all([
        apply(map, BINS, d.binFeatures.features as IdFeature[]),
        apply(map, LINKS, d.linkFeatures.features as IdFeature[]),
      ]);
      window.__gaBle = { diffSize: sizes[0] + sizes[1], flushMs: Math.round((performance.now() - t0) * 10) / 10, at: Date.now() };
      const devices = d.bins.reduce((a, b) => a + b.count, 0);
      reportGaFeed(map, {
        ...FEED,
        count: devices,
        detail: `devices detected in the latest 5 min across ${d.bins.length} H3 cells (${d.suppressed.bins} cells under ${d.k} withheld) · ${d.links.reporting}/${d.links.total} road links with travel times · counts only, no device IDs · refresh 1 min`,
        updatedAt: d.sourceUpdatedAt,
      });
    } catch (err) {
      reportGaFeed(map, { ...FEED, count: null, updatedAt: null, error: String(err instanceof Error ? err.message : err) });
    }
  };
  void refresh();
  const timer = setInterval(() => void refresh(), REFRESH_MS);
  map.on('style.load', () => shown.delete(map));
  map.once('remove', () => {
    clearInterval(timer);
    bound.delete(map);
    shown.delete(map);
  });

  map.on('click', `${LINKS}-line`, (e: MapLayerMouseEvent) => {
    if (hitsGaDeck(map, e.point)) return;
    const p = e.features?.[0]?.properties;
    if (!p) return;
    const speed = p.speedKmh === null || p.speedKmh === undefined || p.speedKmh === 'null' ? '' : `${p.speedKmh} km/h`;
    popup(map, [e.lngLat.lng, e.lngLat.lat], `BLUETOOTH TRAVEL TIME · ${String(p.direction)}`, [
      ['Road', String(p.name)],
      ['Speed', speed || 'not enough matched devices this interval'],
      ['Travel time', p.travelTimeS !== null && p.travelTimeS !== 'null' && p.travelTimeS !== undefined ? `${p.travelTimeS} s (free flow ${p.freeFlowS} s)` : ''],
      ['Delay', p.delayS !== null && p.delayS !== 'null' && p.delayS !== undefined ? `${p.delayS} s` : ''],
      ['Closed', p.closed === true || p.closed === 'true' ? 'yes' : ''],
      ['Interval', time(p.last_updated)],
    ]);
  });
  map.on('click', `${BINS}-fill`, (e: MapLayerMouseEvent) => {
    if (hitsGaDeck(map, e.point)) return;
    const p = e.features?.[0]?.properties;
    if (!p) return;
    popup(map, [e.lngLat.lng, e.lngLat.lat], 'BLUETOOTH DEVICES · H3 CELL', [
      ['Devices (5 min)', String(p.count)],
      ['Density', `${p.density} per km²`],
      ['Detector sites', String(p.sites)],
      ['Interval', time(p.last_updated)],
      ['Privacy', 'counts only · cells under 3 devices withheld'],
    ]);
  });
  for (const id of [`${LINKS}-line`, `${BINS}-fill`]) {
    map.on('mouseenter', id, () => (map.getCanvas().style.cursor = 'pointer'));
    map.on('mouseleave', id, () => (map.getCanvas().style.cursor = ''));
  }
}

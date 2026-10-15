import { Popup } from 'maplibre-gl';
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from 'maplibre-gl';
import { hitsGaDeck } from './ga-deck-overlay';
import { reportGaFeed } from './ga-live-status';
import { isTouchDevice } from './map/touch-gpu-budget';

const SOURCE = 'ga-clouds';
const REFRESH_MS = 5 * 60_000;
const EMPTY = { type: 'FeatureCollection' as const, features: [] };
/** Sky-cover class → slab opacity (more of the sky covered draws a denser cloud). */
const COVER_OPACITY: [string, number][] = [['FEW', 0.28], ['SCT', 0.42], ['BKN', 0.6], ['OVC', 0.78]];
const COVER_TEXT: Record<string, string> = { FEW: 'Few (1–2/8 of sky)', SCT: 'Scattered (3–4/8)', BKN: 'Broken (5–7/8)', OVC: 'Overcast (8/8)', VV: 'Sky obscured (vertical visibility)' };

interface Payload { geojson?: GeoJSON.FeatureCollection; stations?: number; latestObservation?: string | null; sourceUrl?: string; generatedAt?: string; error?: string }

const bound = new WeakSet<MapLibreMap>();
const latest = new WeakMap<MapLibreMap, GeoJSON.FeatureCollection>();

function popup(map: MapLibreMap, e: MapLayerMouseEvent) {
  const p = e.features?.[0]?.properties as Record<string, unknown> | undefined;
  if (!p) return;
  const el = document.createElement('div');
  el.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45;max-width:260px';
  const rows: [string, string][] = [
    ['Station', `${p.station} ${p.name ?? ''}`.trim()],
    ['Cover', COVER_TEXT[String(p.reported)] ?? String(p.cover)],
    ['Cloud base', `${Number(p.baseFt).toLocaleString()} ft (${Number(p.baseM).toLocaleString()} m) above ground`],
    ['Observed', p.observed ? new Date(String(p.observed)).toLocaleString() : ''],
    ['METAR', String(p.raw ?? '')],
    ['Drawn as', '8 km disc over the station, 300 m thick (METARs report base, not tops)'],
  ];
  for (const [k, v] of rows) {
    if (!v) continue;
    const row = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = `${k}: `;
    row.append(b, v);
    el.append(row);
  }
  const a = document.createElement('a');
  a.href = `https://aviationweather.gov/data/metar/?ids=${encodeURIComponent(String(p.station))}`;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.textContent = 'NOAA AWC METAR ↗';
  el.append(a);
  new Popup({ maxWidth: '280px' }).setLngLat(e.lngLat).setDOMContent(el).addTo(map);
}

/** Live METAR cloud layers over Georgia as 3D slabs at their measured base height above ground (idempotent). */
export function addGaCloudLayers(map: MapLibreMap): void {
  if (!map.getSource(SOURCE)) map.addSource(SOURCE, { type: 'geojson', data: latest.get(map) ?? EMPTY });
  for (const [cover, opacity] of COVER_OPACITY) {
    const id = `${SOURCE}-${cover.toLowerCase()}`;
    if (map.getLayer(id)) continue;
    map.addLayer({
      id,
      type: 'fill-extrusion',
      source: SOURCE,
      minzoom: 6,
      filter: ['==', ['get', 'cover'], cover],
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'baseM'], 0, '#e2e8f0', 1500, '#f8fafc', 6000, '#ffffff'],
        'fill-extrusion-base': ['get', 'baseM'],
        'fill-extrusion-height': ['get', 'topM'],
        'fill-extrusion-opacity': opacity,
        'fill-extrusion-vertical-gradient': true,
      },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);

  const refresh = async () => {
    try {
      const r = await fetch(`/api/ga-clouds${isTouchDevice() ? '?lite=1' : ''}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as Payload;
      const fc = d.geojson ?? EMPTY;
      latest.set(map, fc);
      (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(fc);
      const byCover = fc.features.reduce<Record<string, number>>((m, f) => ((m[String(f.properties?.cover)] = (m[String(f.properties?.cover)] ?? 0) + 1), m), {});
      reportGaFeed(map, {
        id: 'clouds', label: 'Cloud layers (METAR)', color: '#e2e8f0', count: fc.features.length,
        detail: `${d.stations ?? 0} stations · ${COVER_OPACITY.map(([c]) => `${byCover[c] ?? 0} ${c}`).join(', ')}`,
        updatedAt: d.latestObservation ?? d.generatedAt ?? null, sourceUrl: d.sourceUrl ?? 'https://aviationweather.gov/data/api/', error: d.error ?? null,
      });
    } catch (err) {
      console.warn('[GaClouds] refresh failed:', err);
    }
  };
  void refresh();
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void refresh();
  }, REFRESH_MS);
  map.once('remove', () => window.clearInterval(timer));
  for (const [cover] of COVER_OPACITY) {
    const id = `${SOURCE}-${cover.toLowerCase()}`;
    map.on('click', id, (e) => {
      if (hitsGaDeck(map, e.point)) return;
      popup(map, e);
    });
  }
}

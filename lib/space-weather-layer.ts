import { Popup } from 'maplibre-gl';
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from 'maplibre-gl';
import { reportGaFeed } from './ga-live-status';

const API = '/api/space-weather';
const REFRESH_MS = 5 * 60_000;
const AURORA = 'space-aurora';
const EMPTY = { type: 'FeatureCollection' as const, features: [] };

interface Payload {
  generatedAt?: string;
  aurora?: { geojson: GeoJSON.FeatureCollection; observationTime: string | null; forecastTime: string | null; maxProbability: number; sourceUrl: string; error: string | null };
  kp?: { latest: { kp: number; time: string } | null; error: string | null };
  scales?: { current: { R: string; S: string; G: string } | null };
  solarWind?: { speedKmS: number | null; densityCm3: number | null; btNt: number | null; bzNt: number | null; time: string | null; source: string | null };
  donki?: {
    flares: number; cmes: number; storms: number; sourceUrl: string; error: string | null;
    strongestFlare: { class: string | null; peak: string | null; region: number | null; link: string | null } | null;
    fastestCme: { speedKmS: number; start: string | null; link: string | null } | null;
    strongestStorm: { maxKp: number; start: string | null; link: string | null } | null;
  };
}

const bound = new WeakSet<MapLibreMap>();
const latest = new WeakMap<MapLibreMap, Payload>();
const when = (v: string | null | undefined) => (v ? new Date(v).toLocaleString() : '');
const fmt = (v: number | null | undefined, unit: string, digits = 1) => (v === null || v === undefined ? '' : `${v.toFixed(digits)} ${unit}`);

function readout(d: Payload, probability: number | null): HTMLElement {
  const el = document.createElement('div');
  el.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45;max-width:260px';
  const rows: [string, string][] = [
    ['Aurora chance here', probability === null ? '' : `${probability}%`],
    ['Aurora forecast for', when(d.aurora?.forecastTime)],
    ['Planetary Kp', d.kp?.latest ? `${d.kp.latest.kp.toFixed(2)} (${when(d.kp.latest.time)})` : ''],
    ['NOAA scales now', d.scales?.current ? `${d.scales.current.R} radio · ${d.scales.current.S} radiation · ${d.scales.current.G} geomagnetic` : ''],
    ['Solar wind', [fmt(d.solarWind?.speedKmS, 'km/s', 0), fmt(d.solarWind?.densityCm3, 'p/cm³')].filter(Boolean).join(' · ')],
    ['IMF Bt / Bz', [fmt(d.solarWind?.btNt, 'nT'), fmt(d.solarWind?.bzNt, 'nT')].filter(Boolean).join(' / ')],
    ['Strongest flare (7 d)', d.donki?.strongestFlare ? `${d.donki.strongestFlare.class ?? '?'} at ${when(d.donki.strongestFlare.peak)}${d.donki.strongestFlare.region ? ` · AR ${d.donki.strongestFlare.region}` : ''}` : ''],
    ['Fastest CME (7 d)', d.donki?.fastestCme ? `${Math.round(d.donki.fastestCme.speedKmS)} km/s, ${when(d.donki.fastestCme.start)}` : ''],
    ['Geomagnetic storms (7 d)', d.donki ? `${d.donki.storms}${d.donki.strongestStorm ? `, max Kp ${d.donki.strongestStorm.maxKp}` : ''}` : ''],
  ];
  const h = document.createElement('div');
  h.textContent = 'Space weather';
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
  for (const [href, text] of [[d.aurora?.sourceUrl, 'NOAA SWPC'], [d.donki?.sourceUrl, 'NASA DONKI']] as const) {
    if (!href) continue;
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noreferrer';
    a.textContent = text;
    a.style.marginRight = '8px';
    el.append(a);
  }
  return el;
}

/** NOAA OVATION aurora oval on the globe plus a NOAA/NASA space-weather readout (idempotent). */
export function addSpaceWeatherLayers(map: MapLibreMap): void {
  if (!map.getSource(AURORA)) map.addSource(AURORA, { type: 'geojson', data: latest.get(map)?.aurora?.geojson ?? EMPTY });
  if (!map.getLayer(AURORA)) {
    map.addLayer({
      id: AURORA,
      type: 'heatmap',
      source: AURORA,
      maxzoom: 7,
      paint: {
        'heatmap-weight': ['interpolate', ['linear'], ['get', 'p'], 3, 0.15, 30, 0.7, 90, 1],
        'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 0, 0.7, 6, 1.6],
        'heatmap-radius': ['interpolate', ['exponential', 2], ['zoom'], 0, 4, 3, 18, 6, 90],
        'heatmap-color': [
          'interpolate', ['linear'], ['heatmap-density'],
          0, 'rgba(0,0,0,0)', 0.15, 'rgba(34,197,94,0.25)', 0.45, 'rgba(74,222,128,0.6)', 0.75, 'rgba(250,204,21,0.75)', 1, 'rgba(239,68,68,0.85)',
        ],
        'heatmap-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.85, 6, 0.6, 7, 0],
      },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);

  const refresh = async () => {
    try {
      const r = await fetch(API);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as Payload;
      latest.set(map, d);
      (map.getSource(AURORA) as GeoJSONSource | undefined)?.setData(d.aurora?.geojson ?? EMPTY);
      const kp = d.kp?.latest ? `Kp ${d.kp.latest.kp.toFixed(1)}` : 'Kp n/a';
      const g = d.scales?.current ? ` · ${d.scales.current.R}/${d.scales.current.S}/${d.scales.current.G}` : '';
      const wind = d.solarWind?.speedKmS ? ` · wind ${Math.round(d.solarWind.speedKmS)} km/s` : '';
      reportGaFeed(map, {
        id: 'spaceweather', label: 'Space weather (NOAA/NASA)', color: '#4ade80', count: d.aurora?.geojson.features.length ?? null,
        detail: `${kp}${g}${wind} · aurora max ${d.aurora?.maxProbability ?? 0}% · ${d.donki?.flares ?? 0} flares, ${d.donki?.cmes ?? 0} CMEs in 7 d`,
        updatedAt: d.aurora?.observationTime ?? d.generatedAt ?? null, sourceUrl: 'https://www.swpc.noaa.gov/', error: d.aurora?.error ?? d.donki?.error ?? null,
      });
    } catch (err) {
      console.warn('[SpaceWeather] refresh failed:', err);
    }
  };
  void refresh();
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void refresh();
  }, REFRESH_MS);
  map.once('remove', () => window.clearInterval(timer));

  map.on('click', (e: MapLayerMouseEvent) => {
    if (map.getZoom() >= 5) return;
    const d = latest.get(map);
    if (!d) return;
    const hit = map.queryRenderedFeatures(e.point).find((f) => f.layer.id !== AURORA && f.layer.type !== 'raster' && f.layer.type !== 'background');
    if (hit) return;
    const near = (d.aurora?.geojson.features ?? []).find((f) => {
      const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
      return Math.abs(lat - e.lngLat.lat) <= 0.5 && Math.abs(((lng - e.lngLat.lng + 540) % 360) - 180) <= 0.5;
    });
    if (!near) return;
    new Popup({ maxWidth: '280px' }).setLngLat(e.lngLat).setDOMContent(readout(d, Number(near.properties?.p ?? 0))).addTo(map);
  });
}

import { Popup } from 'maplibre-gl';
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from 'maplibre-gl';
import { teardropPx } from './ga-precip/teardrop-mesh';
import { sparkle } from './ga-precip/drop-colors';
import { hitsGaDeck, setGaDeckPrecip, setGaDeckRain } from './ga-deck-overlay';
import { DEFAULT_BASE_M, dropletPositions, seedDroplets, type Droplets, type RainCell } from './ga-precip/droplets';
import { reportGaFeed } from './ga-live-status';
import { qualityTouch } from './map/touch-gpu-budget';
import { precipColor, type PrecipPhase, type PrecipSummary } from './ga-precip/precip-cells';

/** Observed rain, snow and hail on the ground over Georgia from NOAA MRMS (type + rate + last-hour total), refreshed every 2 min. */
export const PRECIP_SOURCE = 'ga-precip';
export const PRECIP_LAYER = 'ga-precip-fill';
const REFRESH_MS = 2 * 60_000;
const DOCS = 'https://www.nssl.noaa.gov/projects/mrms/operational/tables.php';
const EMPTY = { type: 'FeatureCollection' as const, features: [] };
const COLORS = { rain: '#38bdf8', snow: '#e0e7ff', hail: '#f472b6' } as const;

interface Payload {
  geojson?: GeoJSON.FeatureCollection; summary?: PrecipSummary; observedAt?: string; qpeAt?: string | null; cellDeg?: number; nativeCellDeg?: number;
  sourceUrl?: string; docsUrl?: string; generatedAt?: string; error?: string | null;
}

const state = new WeakMap<MapLibreMap, { observedAt: string | null; qpeAt: string | null; cellDeg: number }>();
const bound = new WeakSet<MapLibreMap>();
const mm2in = (mm: number) => (mm / 25.4).toFixed(2);
const km = (deg: number) => (deg * 111.32).toFixed(1);

function popup(map: MapLibreMap, e: MapLayerMouseEvent) {
  if (hitsGaDeck(map, e.point)) return;
  const p = e.features?.[0]?.properties as Record<string, unknown> | undefined;
  if (!p) return;
  const s = state.get(map);
  const rate = Number(p.rateMmH), qpe = Number(p.qpe1hMm), cell = s?.cellDeg ?? 0;
  const rows: [string, string][] = [
    ['Type', `${p.kind} (NOAA MRMS flag ${p.flag})`],
    ['Rate', `${rate} mm/h (${mm2in(rate)} in/h), highest in this cell group${p.phase === 'snow' ? ', liquid-equivalent' : ''}`],
    ['Last hour', `${qpe} mm (${mm2in(qpe)} in), radar-only estimate`],
    ['Grid', `${cell}° cells (~${km(cell)} km); native MRMS grid 0.01° (~1.1 km); ${p.cells} native cells here`],
    ['Observed', s?.observedAt ? new Date(s.observedAt).toLocaleString() : ''],
    ['Note', 'Radar estimate near the ground, not a gauge reading; rain/snow/hail type is MRMS’s automated classification; falling drops are drawn as 3D teardrops, an artistic shape (real raindrops are round or flat-bottomed)'],
  ];
  const el = document.createElement('div');
  el.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45;max-width:270px';
  for (const [k, v] of rows) {
    if (!v) continue;
    const row = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = `${k}: `;
    row.append(b, v);
    el.append(row);
  }
  const a = document.createElement('a');
  a.href = DOCS;
  a.target = '_blank';
  a.rel = 'noreferrer';
  a.textContent = 'NOAA MRMS products ↗';
  el.append(a);
  new Popup({ maxWidth: '290px' }).setLngLat(e.lngLat).setDOMContent(el).addTo(map);
}

const rainBase = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('rainbase') === 'on';
/** Drawn drops in view: 32,768 on every device (≈0.8 MB of vertex data), per the user's 32K requirement. */
const dropBudget = () => 32_768;
const STREAK_PX = 14;
const dropDots = () => typeof location !== 'undefined' && new URLSearchParams(location.search).get('drop') === 'dot';
const cells = new WeakMap<MapLibreMap, RainCell[]>();
const drops = new WeakMap<MapLibreMap, Droplets>();

function toCells(fc: GeoJSON.FeatureCollection): RainCell[] {
  return fc.features.flatMap((f) => {
    if (f.geometry.type !== 'Polygon') return [];
    const r = f.geometry.coordinates[0];
    const p = f.properties ?? {};
    return [{ west: r[0][0], north: r[0][1], east: r[1][0], south: r[2][1], rateMmH: Number(p.rateMmH) || 0, phase: (p.phase as RainCell['phase']) ?? 'rain', baseM: Number(p.baseM) || DEFAULT_BASE_M }];
  });
}


function reseed(map: MapLibreMap) {
  if (new URLSearchParams(location.search).get('rain') === 'off') return;
  const list = cells.get(map) ?? [];
  const b = map.getBounds();
  const cache = new Map<string, number>();
  const groundAt = (lng: number, lat: number) => {
    const k = `${lng.toFixed(3)},${lat.toFixed(3)}`;
    let g = cache.get(k);
    if (g === undefined) cache.set(k, (g = map.queryTerrainElevation([lng, lat]) ?? 0));
    return g;
  };
  // A tilted view reaches the horizon; spread over all of it the drops near the camera vanish, so seed around the map centre only
  // (half-width = 2 screen widths, at least 600 m), clipped to what is on screen.
  const c = map.getCenter();
  const mpp = (40_075_016 * Math.cos((c.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
  const halfM = Math.max(600, 2 * map.getCanvas().clientWidth * mpp);
  const dLat = halfM / 111_320, dLng = halfM / (111_320 * Math.cos((c.lat * Math.PI) / 180));
  const view = { west: Math.max(b.getWest(), c.lng - dLng), south: Math.max(b.getSouth(), c.lat - dLat), east: Math.min(b.getEast(), c.lng + dLng), north: Math.min(b.getNorth(), c.lat + dLat) };
  const d = seedDroplets(list, view, dropBudget(), groundAt);
  drops.set(map, d);
  const src = new Float32Array(d.n * 3), dst = new Float32Array(d.n * 3);
  const colors = new Uint8Array(d.n * 4);
  const meshScales = new Float32Array(d.n * 3), headRadii = new Float32Array(d.n);
  const dots = dropDots();
  for (let i = 0; i < d.n; i++) {
    const tear = !dots && !d.snow[i];
    meshScales.fill(tear ? 1 : 0, i * 3, i * 3 + 3);
    headRadii[i] = tear ? 0 : 1.6;
  }
  const rain = { n: d.n, src, dst, colors, scale: 1, meshScales, headRadii };
  const tick = () => {
    const c = map.getCenter();
    const mpp = (40_075_016 * Math.cos((c.lat * Math.PI) / 180)) / (512 * 2 ** map.getZoom());
    const t = performance.now() / 1000;
    dropletPositions(d, t, STREAK_PX * mpp, map.getTerrain()?.exaggeration ?? 1, src, dst);
    rain.scale = teardropPx(map.getZoom()) * mpp;
    sparkle(d, t, colors);
    rain.src = src; rain.dst = dst;
    return d.n > 0;
  };
  tick();
  setGaDeckRain(map, rain, tick);
  if (typeof window !== 'undefined') window.__gaRain = { drawn: d.n, realPerDrawn: Math.round(d.realPerDrawn), cells: list.length, halfKm: Math.round(halfM / 100) / 10 };
}

declare global {
  interface Window { __gaRain?: { drawn: number; realPerDrawn: number; cells: number; halfKm: number } }
}

/** Adds the rain/snow/hail layer (visible by default) and keeps it refreshed (idempotent). */
export function addGaPrecipLayer(map: MapLibreMap): void {
  if (!map.getSource(PRECIP_SOURCE)) map.addSource(PRECIP_SOURCE, { type: 'geojson', data: EMPTY, attribution: 'Rain/snow: NOAA MRMS' });
  if (!map.getLayer(PRECIP_LAYER)) {
    map.addLayer({
      id: PRECIP_LAYER,
      type: 'fill',
      source: PRECIP_SOURCE,
      minzoom: 4,
      paint: {
        'fill-color': [
          'match', ['get', 'phase'],
          'snow', ['interpolate', ['linear'], ['get', 'rateMmH'], 0.1, '#eef2ff', 2.5, '#c7d2fe', 7.6, '#a5b4fc'],
          'hail', ['interpolate', ['linear'], ['get', 'rateMmH'], 0.1, '#f9a8d4', 16, '#ec4899', 50, '#be185d'],
          ['interpolate', ['linear'], ['get', 'rateMmH'], 0.1, '#7dd3fc', 2.5, '#22c55e', 7.6, '#eab308', 16, '#f97316', 50, '#dc2626'],
        ],
        // The user asked for rain in the sky, not on the ground: the fill stays as an invisible tap target unless ?rainbase=on.
        'fill-opacity': rainBase() ? ['interpolate', ['linear'], ['get', 'rateMmH'], 0.1, 0.28, 7.6, 0.5, 50, 0.7] : 0,
        'fill-antialias': false,
      },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);
  map.on('click', PRECIP_LAYER, (e) => popup(map, e));
  map.on('moveend', () => reseed(map));

  const refresh = async () => {
    try {
      const r = await fetch(`/api/ga-precip${qualityTouch() ? '?lite=1' : ''}`);
      const d = (await r.json()) as Payload;
      if (!r.ok || !d.geojson) throw new Error(d.error ?? `HTTP ${r.status}`);
      state.set(map, { observedAt: d.observedAt ?? null, qpeAt: d.qpeAt ?? null, cellDeg: d.cellDeg ?? 0 });
      (map.getSource(PRECIP_SOURCE) as GeoJSONSource | undefined)?.setData(d.geojson);
      cells.set(map, toCells(d.geojson));
      reseed(map);
      if (rainBase()) setGaDeckPrecip(map, d.geojson.features.flatMap((f) => (f.geometry.type === 'Polygon'
        ? [{ polygon: f.geometry.coordinates[0] as [number, number][], color: precipColor(String(f.properties?.phase) as PrecipPhase, Number(f.properties?.rateMmH)) }]
        : [])));
      const s = d.summary;
      reportGaFeed(map, {
        id: 'precip', label: 'Rain / snow / hail (NOAA MRMS)', color: COLORS.rain, count: d.geojson.features.length,
        detail: s ? `${s.cells.toLocaleString()} native 0.01° cells wet · peak ${s.peakRateMmH} mm/h · peak last-hour ${s.peakQpe1hMm} mm · drawn as ${d.cellDeg}° cells` : undefined,
        updatedAt: d.observedAt ?? d.generatedAt ?? null, sourceUrl: d.sourceUrl ?? DOCS, error: d.error ?? null, staleAfterMin: 10,
        swatches: s ? [
          { label: 'rain', color: COLORS.rain, count: s.byPhase.rain },
          { label: 'snow', color: COLORS.snow, count: s.byPhase.snow },
          { label: 'hail', color: COLORS.hail, count: s.byPhase.hail },
        ] : undefined,
      });
    } catch (err) {
      reportGaFeed(map, { id: 'precip', label: 'Rain / snow / hail (NOAA MRMS)', color: COLORS.rain, count: null, updatedAt: null, sourceUrl: DOCS, error: err instanceof Error ? err.message : String(err), staleAfterMin: 10 });
    }
  };
  void refresh();
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void refresh();
  }, REFRESH_MS);
  map.once('remove', () => window.clearInterval(timer));
}

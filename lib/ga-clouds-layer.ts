import { Popup } from 'maplibre-gl';
import type { GeoJSONSource, MapLayerMouseEvent, Map as MapLibreMap } from 'maplibre-gl';
import { hitsGaDeck, setGaDeckClouds } from './ga-deck-overlay';
import { radarCloudPuffs } from './ga-clouds/cloud-puffs';
import { reportGaFeed } from './ga-live-status';

const isTouch = () => typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
const SOURCE = 'ga-clouds';
const REFRESH_MS = 5 * 60_000;
const EMPTY = { type: 'FeatureCollection' as const, features: [] };
/** Sky-cover class → slab opacity (more of the sky covered draws a denser cloud). */
const COVER_OPACITY: [string, number][] = [['FEW', 0.28], ['SCT', 0.42], ['BKN', 0.6], ['OVC', 0.78]];
const COVER_TEXT: Record<string, string> = { FEW: 'Few (1–2/8 of sky)', SCT: 'Scattered (3–4/8)', BKN: 'Broken (5–7/8)', OVC: 'Overcast (8/8)', VV: 'Sky obscured (vertical visibility)' };

interface ModelPayload { geojson?: GeoJSON.FeatureCollection; validTime?: string | null; gridPoints?: number; sourceUrl?: string; error?: string | null }
interface Payload { geojson?: GeoJSON.FeatureCollection; model?: ModelPayload; stations?: number; latestObservation?: string | null; sourceUrl?: string; generatedAt?: string; error?: string }

const MODEL_SOURCE = 'ga-clouds-model';
/** HRRR max cloud cover band → opacity. */
const MODEL_BANDS: [string, number][] = [['low', 0.22], ['mid', 0.36], ['high', 0.52]];
const MODEL_DOCS = 'https://open-meteo.com/en/docs/gfs-api';

const RADAR_SOURCE = 'ga-clouds-radar';
const RADAR_REFRESH_MS = 2 * 60_000;
/** Composite reflectivity band → [opacity, sunlit colour, night colour]; the extrusions are invisible tap targets for the cloud puffs drawn in deck.gl. */
const RADAR_BANDS: [string, number, string, string][] = [
  ['light', 0.6, '#ffffff', '#c9d6e8'],
  ['moderate', 0.7, '#f1f5f9', '#b4c4dc'],
  ['heavy', 0.8, '#dbe3ec', '#9db0cc'],
  ['intense', 0.9, '#c3cedb', '#8499bd'],
];
const RADAR_BAND_TEXT: Record<string, string> = { light: '18–29 dBZ (light)', moderate: '30–44 dBZ (moderate)', heavy: '45–54 dBZ (heavy)', intense: '55+ dBZ (intense, likely hail)' };
const RADAR_DOCS = 'https://www.nssl.noaa.gov/projects/mrms/';
/** Puff budget: overlapping spheres per radar map (cells merge 2×2 above it). */
const MAX_PUFFS = { touch: 9_000, desktop: 30_000 };
interface RadarPayload { geojson?: GeoJSON.FeatureCollection; observedAt?: string; generatedAt?: string; sourceUrl?: string; cellDeg?: number; metarStations?: number; error?: string | null }

const bound = new WeakSet<MapLibreMap>();
const latestRadar = new WeakMap<MapLibreMap, GeoJSON.FeatureCollection>();
const radarTime = new WeakMap<MapLibreMap, string | null>();
const radarCell = new WeakMap<MapLibreMap, number>();

/** True ground height (m above sea level) from the loaded DEM, without the drawn exaggeration; 0 before tiles load. */
function groundM(map: MapLibreMap, lng: number, lat: number): number {
  const terrain = map.getTerrain();
  if (!terrain) return 0;
  const e = map.queryTerrainElevation([lng, lat]);
  return e !== null && Number.isFinite(e) ? e / (terrain.exaggeration || 1) : 0;
}

/** Rebuilds the cumulus puffs from the latest radar blocks; returns the puff count. */
function rebuildPuffs(map: MapLibreMap): number {
  const fc = latestRadar.get(map);
  const cellDeg = radarCell.get(map);
  if (!fc || !cellDeg) return 0;
  const puffs = radarCloudPuffs(fc, { cellDeg, groundM: (lng, lat) => groundM(map, lng, lat), maxPuffs: isTouch() ? MAX_PUFFS.touch : MAX_PUFFS.desktop });
  setGaDeckClouds(map, puffs);
  return puffs.length;
}
const latest = new WeakMap<MapLibreMap, GeoJSON.FeatureCollection>();
const latestModel = new WeakMap<MapLibreMap, GeoJSON.FeatureCollection>();
const modelTime = new WeakMap<MapLibreMap, string | null>();

function rowsPopup(map: MapLibreMap, e: MapLayerMouseEvent, rows: [string, string][], href: string, linkText: string) {
  const el = document.createElement('div');
  el.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45;max-width:260px';
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
  a.textContent = linkText;
  el.append(a);
  new Popup({ maxWidth: '280px' }).setLngLat(e.lngLat).setDOMContent(el).addTo(map);
}

function modelPopup(map: MapLibreMap, e: MapLayerMouseEvent) {
  const p = e.features?.[0]?.properties as Record<string, unknown> | undefined;
  if (!p) return;
  const t = modelTime.get(map);
  rowsPopup(map, e, [
    ['Model', 'NOAA HRRR 3 km (forecast, not an observation)'],
    ['Valid', t ? new Date(t).toLocaleString() : ''],
    ['Cloud base', `${Number(p.baseM).toLocaleString()} m above ground (${p.baseHpa} hPa)`],
    ['Cloud top', `${Number(p.topM).toLocaleString()} m above ground (${p.topHpa} hPa)`],
    ['Max cover', `${p.maxCover}% of the 0.5° cell`],
    ['Grid point', `${p.lat}, ${p.lng}`],
  ], MODEL_DOCS, 'Open-Meteo HRRR (CC BY 4.0) ↗');
}

function radarPopup(map: MapLibreMap, e: MapLayerMouseEvent) {
  const p = e.features?.[0]?.properties as Record<string, unknown> | undefined;
  if (!p) return;
  const t = radarTime.get(map);
  rowsPopup(map, e, [
    ['Radar', 'NOAA MRMS multi-radar mosaic (observed)'],
    ['Scanned', t ? new Date(t).toLocaleString() : ''],
    ['Echo top', `${Number(p.topM).toLocaleString()} m above sea level (highest 18 dBZ return)`],
    ['Reflectivity', `${RADAR_BAND_TEXT[String(p.band)] ?? ''}, peak ${p.dbz} dBZ`],
    ['Cloud base', p.baseStation ? `${Number(p.baseM).toLocaleString()} m, lowest base reported at ${p.baseStation}` : 'no METAR base within 100 km; drawn from the ground'],
    ['Note', 'Radar sees rain, snow and hail in the cloud, not thin cloud without precipitation'],
  ], RADAR_DOCS, 'NOAA MRMS ↗');
}

function popup(map: MapLibreMap, e: MapLayerMouseEvent) {
  const p = e.features?.[0]?.properties as Record<string, unknown> | undefined;
  if (!p) return;
  const fromModel = p.topSource === 'model';
  rowsPopup(map, e, [
    ['Station', `${p.station} ${p.name ?? ''}`.trim()],
    ['Cover', COVER_TEXT[String(p.reported)] ?? String(p.cover)],
    ['Cloud base', `${Number(p.baseFt).toLocaleString()} ft (${Number(p.baseM).toLocaleString()} m) above ground, measured`],
    ['Cloud top', fromModel ? `${Number(p.topM).toLocaleString()} m above ground, from the NOAA HRRR model layer containing this base` : 'not reported; drawn 300 m thick'],
    ['Observed', p.observed ? new Date(String(p.observed)).toLocaleString() : ''],
    ['METAR', String(p.raw ?? '')],
    ['Drawn as', '8 km disc over the station (METARs report base, not extent or tops)'],
  ], `https://aviationweather.gov/data/metar/?ids=${encodeURIComponent(String(p.station))}`, 'NOAA AWC METAR ↗');
}

/** Radar-shaped 3D clouds (NOAA MRMS) over Georgia; the METAR disc and HRRR grid-cell layers stay loaded but hidden (idempotent). */
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
      layout: { visibility: 'none' },
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
  if (!map.getSource(MODEL_SOURCE)) map.addSource(MODEL_SOURCE, { type: 'geojson', data: latestModel.get(map) ?? EMPTY });
  for (const [band, opacity] of MODEL_BANDS) {
    const id = `${MODEL_SOURCE}-${band}`;
    if (map.getLayer(id)) continue;
    map.addLayer({
      id,
      type: 'fill-extrusion',
      source: MODEL_SOURCE,
      minzoom: 5,
      layout: { visibility: 'none' },
      filter: ['==', ['get', 'band'], band],
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'topM'], 0, '#cbd5e1', 3000, '#e2e8f0', 8000, '#f8fafc', 12000, '#ffffff'],
        'fill-extrusion-base': ['get', 'baseM'],
        'fill-extrusion-height': ['get', 'topM'],
        'fill-extrusion-opacity': opacity,
        'fill-extrusion-vertical-gradient': true,
      },
    });
  }
  if (!map.getSource(RADAR_SOURCE)) map.addSource(RADAR_SOURCE, { type: 'geojson', data: latestRadar.get(map) ?? EMPTY });
  for (const [band, , day, night] of RADAR_BANDS) {
    const id = `${RADAR_SOURCE}-${band}`;
    if (map.getLayer(id)) continue;
    map.addLayer({
      id,
      type: 'fill-extrusion',
      source: RADAR_SOURCE,
      minzoom: 4,
      filter: ['==', ['get', 'band'], band],
      paint: {
        'fill-extrusion-color': ['interpolate', ['linear'], ['get', 'night'], 0, day, 1, night],
        'fill-extrusion-base': ['get', 'baseM'],
        'fill-extrusion-height': ['get', 'topM'],
        'fill-extrusion-opacity': 0,
        'fill-extrusion-vertical-gradient': true,
      },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);

  const refreshRadar = async () => {
    try {
      const r = await fetch(`/api/ga-radar-clouds${isTouch() ? '?lite=1' : ''}`);
      const d = (await r.json()) as RadarPayload;
      if (!r.ok || !d.geojson) throw new Error(d.error ?? `HTTP ${r.status}`);
      latestRadar.set(map, d.geojson);
      radarTime.set(map, d.observedAt ?? null);
      radarCell.set(map, d.cellDeg ?? 0);
      (map.getSource(RADAR_SOURCE) as GeoJSONSource | undefined)?.setData(d.geojson);
      const puffs = rebuildPuffs(map);
      const byBand = d.geojson.features.reduce<Record<string, number>>((m, f) => ((m[String(f.properties?.band)] = (m[String(f.properties?.band)] ?? 0) + 1), m), {});
      const peak = d.geojson.features.reduce((m, f) => Math.max(m, Number(f.properties?.topM) || 0), 0);
      reportGaFeed(map, {
        id: 'radar-clouds', label: 'Radar clouds (NOAA MRMS)', color: '#f8fafc', count: d.geojson.features.length,
        detail: `${d.cellDeg ?? ''}° cells · ${puffs.toLocaleString()} cloud puffs · highest echo top ${peak.toLocaleString()} m · ${RADAR_BANDS.map(([b]) => `${byBand[b] ?? 0} ${b}`).join(', ')}`,
        updatedAt: d.observedAt ?? d.generatedAt ?? null, sourceUrl: d.sourceUrl ?? RADAR_DOCS, error: d.error ?? null,
      });
    } catch (err) {
      reportGaFeed(map, { id: 'radar-clouds', label: 'Radar clouds (NOAA MRMS)', color: '#f8fafc', count: null, updatedAt: null, sourceUrl: RADAR_DOCS, error: err instanceof Error ? err.message : String(err) });
    }
  };
  void refreshRadar();
  const radarTimer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void refreshRadar();
  }, RADAR_REFRESH_MS);
  map.once('remove', () => window.clearInterval(radarTimer));
  let regroundTimer = 0;
  map.on('data', (e) => {
    if (e.dataType !== 'source' || !('sourceId' in e) || e.sourceId !== map.getTerrain()?.source) return;
    window.clearTimeout(regroundTimer);
    regroundTimer = window.setTimeout(() => rebuildPuffs(map), 3_000);
  });
  for (const [band] of RADAR_BANDS) {
    map.on('click', `${RADAR_SOURCE}-${band}`, (e) => {
      if (hitsGaDeck(map, e.point)) return;
      if (map.queryRenderedFeatures(e.point, { layers: COVER_OPACITY.map(([c]) => `${SOURCE}-${c.toLowerCase()}`) }).length) return;
      radarPopup(map, e);
    });
  }

  const refresh = async () => {
    try {
      const r = await fetch(`/api/ga-clouds${isTouch() ? '?lite=1' : ''}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d = (await r.json()) as Payload;
      const fc = d.geojson ?? EMPTY;
      latest.set(map, fc);
      (map.getSource(SOURCE) as GeoJSONSource | undefined)?.setData(fc);
      const mfc = d.model?.geojson ?? EMPTY;
      latestModel.set(map, mfc);
      modelTime.set(map, d.model?.validTime ?? null);
      (map.getSource(MODEL_SOURCE) as GeoJSONSource | undefined)?.setData(mfc);
      const refined = fc.features.filter((f) => f.properties?.topSource === 'model').length;
      const byCover = fc.features.reduce<Record<string, number>>((m, f) => ((m[String(f.properties?.cover)] = (m[String(f.properties?.cover)] ?? 0) + 1), m), {});
      reportGaFeed(map, {
        id: 'clouds', label: 'Cloud layers (METAR + HRRR)', color: '#e2e8f0', count: fc.features.length + mfc.features.length,
        detail: `${d.stations ?? 0} stations · ${COVER_OPACITY.map(([c]) => `${byCover[c] ?? 0} ${c}`).join(', ')} · ${refined} with model tops · ${mfc.features.length} HRRR layers${d.model?.error ? ` (model: ${d.model.error})` : ''}`,
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
  for (const [band] of MODEL_BANDS) {
    map.on('click', `${MODEL_SOURCE}-${band}`, (e) => {
      if (hitsGaDeck(map, e.point)) return;
      if (map.queryRenderedFeatures(e.point, { layers: [...COVER_OPACITY.map(([c]) => `${SOURCE}-${c.toLowerCase()}`), ...RADAR_BANDS.map(([b]) => `${RADAR_SOURCE}-${b}`)] }).length) return;
      modelPopup(map, e);
    });
  }
}

import { Popup, type GeoJSONSource, type Map as MapLibreMap, type MapLayerMouseEvent, type RasterTileSource } from 'maplibre-gl';
import { HLS, VIIRS, daysBack, gibsDomainsUrl, gibsTileTemplate, isBlankTile, latestDomainDate, lngLatToTile, type GibsProduct } from './ga-gibs-daily/gibs';
import type { SceneCollection } from './ga-gibs-daily/sentinel2';
import { reportGaFeed } from './ga-live-status';

const GIBS_POLL_MS = 30 * 60_000;
const S2_POLL_MS = 15 * 60_000;
const HLS_DAYS = 6;
const VIIRS_LOOKBACK = 4;
const PROBE: [number, number, number] = [-84.39, 33.75, 6];
// Covers the body read too; slow phones busy decoding other feeds need well over 30 s. GIBS calls get no timeout:
// they queue behind the map's own GIBS tile requests, and a stuck call only delays this feed.
const FETCH_TIMEOUT_MS = 120_000;
const GIBS_DOCS = 'https://nasa-gibs.github.io/gibs-api-docs/';
const S2_DOCS = 'https://registry.opendata.aws/sentinel-2-l2a-cogs/';

const VIIRS_ID = 'gibs-viirs';
const hlsId = (p: number, i: number) => `gibs-hls-${p}-${i}`;
const S2_ID = 'ga-sentinel2-scenes';

const active = new WeakMap<MapLibreMap, boolean>();
const bound = new WeakSet<MapLibreMap>();
const dates = new WeakMap<MapLibreMap, { viirs: string | null; hls: (string | null)[] }>();

const isoDay = (t = Date.now()) => new Date(t).toISOString().slice(0, 10);

function beforeId(map: MapLibreMap): string | undefined {
  return map.getStyle().layers.find((l) => !['background', 'raster', 'hillshade', 'color-relief'].includes(l.type))?.id;
}

async function latestDate(p: GibsProduct): Promise<string | null> {
  const r = await fetch(gibsDomainsUrl(p, isoDay(Date.now() - 20 * 86_400_000)));
  if (!r.ok) throw new Error(`GIBS domains HTTP ${r.status}`);
  return latestDomainDate(await r.text());
}

/** Newest day whose VIIRS tile over Atlanta actually holds imagery (GIBS lists today before the pass is processed). */
async function newestImagedViirs(end: string): Promise<string | null> {
  const [lng, lat, z] = PROBE;
  const [x, y] = lngLatToTile(lng, lat, z);
  for (const d of daysBack(end, VIIRS_LOOKBACK)) {
    const r = await fetch(gibsTileTemplate(VIIRS, d).replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(x)));
    if (!r.ok) continue;
    if (!isBlankTile((await r.arrayBuffer()).byteLength)) return d;
  }
  return null;
}

function upsertRaster(map: MapLibreMap, id: string, p: GibsProduct, date: string, minzoom: number, opacity: unknown, before?: string) {
  const tiles = [gibsTileTemplate(p, date)];
  const src = map.getSource(id) as RasterTileSource | undefined;
  if (src) src.setTiles(tiles);
  else map.addSource(id, { type: 'raster', tiles, tileSize: 256, maxzoom: p.maxzoom, attribution: 'Daily imagery: NASA GIBS / EOSDIS' });
  if (!map.getLayer(id)) {
    map.addLayer({ id, type: 'raster', source: id, minzoom, paint: { 'raster-opacity': opacity as never, 'raster-fade-duration': 0 } }, before);
  }
}

async function refreshGibs(map: MapLibreMap) {
  if (!active.get(map)) return;
  const prev = dates.get(map) ?? { viirs: null, hls: [] };
  const errors: string[] = [];
  try {
    const end = await latestDate(VIIRS);
    const d = end ? await newestImagedViirs(end) : null;
    if (!active.get(map)) return;
    if (d) {
      upsertRaster(map, VIIRS_ID, VIIRS, d, 0, ['interpolate', ['linear'], ['zoom'], 9, 1, 11, 0], beforeId(map));
      prev.viirs = d;
    } else errors.push(`no imaged VIIRS day in the last ${VIIRS_LOOKBACK}`);
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  }
  const hlsDates: (string | null)[] = [];
  for (let p = 0; p < HLS.length; p++) {
    try {
      const end = await latestDate(HLS[p]);
      if (!active.get(map)) return;
      if (!end) continue;
      hlsDates[p] = end;
      // Oldest first, so the newest pass is drawn on top; days with no pass over a tile are transparent.
      daysBack(end, HLS_DAYS).reverse().forEach((d, i) => upsertRaster(map, hlsId(p, i), HLS[p], d, 7, ['interpolate', ['linear'], ['zoom'], 7, 0, 8, 1, 14, 1, 15, 0], beforeId(map)));
    } catch (e) {
      errors.push(`${HLS[p].label}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
  prev.hls = hlsDates;
  dates.set(map, prev);
  const hlsText = HLS.map((h, p) => `${h.label} ${hlsDates[p] ? `${daysBack(hlsDates[p]!, HLS_DAYS).pop()}…${hlsDates[p]}` : 'n/a'}`).join(' · ');
  reportGaFeed(map, {
    id: 'nasa-daily', label: 'NASA daily satellite (GIBS)', color: '#22d3ee', count: prev.viirs ? 1 : null,
    detail: `${VIIRS.label} for ${prev.viirs ?? 'n/a'} (UTC pass date; one pass per day, ~250–375 m) · ${hlsText} (30 m, newest pass on top, blank where no pass or cloud-masked)`,
    updatedAt: prev.viirs, staleAfterMin: 3 * 1440, sourceUrl: GIBS_DOCS,
    error: errors.length ? errors.join('; ') : null,
  });
}

function sceneHtml(p: Record<string, unknown>): HTMLElement {
  const root = document.createElement('div');
  root.style.cssText = 'font:12px ui-monospace,monospace;color:#0f172a;max-width:300px';
  const row = (k: string, v: string) => {
    const d = document.createElement('div');
    const b = document.createElement('b');
    b.textContent = `${k}: `;
    d.append(b, v);
    root.append(d);
  };
  const h = document.createElement('div');
  h.style.cssText = 'font-weight:800;margin-bottom:4px';
  h.textContent = 'Sentinel-2 L2A scene';
  root.append(h);
  row('Scene', String(p.id));
  row('Captured (UTC)', String(p.datetime));
  row('Cloud cover', p.cloud == null || p.cloud === 'null' ? 'not reported' : `${p.cloud}%`);
  if (p.platform) row('Satellite', String(p.platform));
  if (p.tile) row('MGRS tile', String(p.tile));
  if (typeof p.thumb === 'string' && p.thumb) {
    const img = document.createElement('img');
    img.src = p.thumb;
    img.alt = `Preview of ${String(p.id)}`;
    img.style.cssText = 'width:100%;margin:6px 0;border-radius:4px';
    root.append(img);
  }
  const links = document.createElement('div');
  for (const [label, href] of [['10 m true-colour GeoTIFF', p.visual], ['STAC record', p.stac]] as const) {
    if (typeof href !== 'string' || !href) continue;
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = label;
    a.style.cssText = 'margin-right:10px;color:#1d4ed8';
    links.append(a);
  }
  root.append(links);
  const note = document.createElement('div');
  note.style.cssText = 'margin-top:4px;color:#475569';
  note.textContent = 'Footprint and preview only; the full-resolution 10 m image is the GeoTIFF link. Source: Copernicus Sentinel data via Element 84 Earth Search.';
  root.append(note);
  return root;
}

async function refreshScenes(map: MapLibreMap) {
  if (!active.get(map)) return;
  try {
    const r = await fetch('/api/ga/sentinel2', { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
    const body = (await r.json()) as SceneCollection & { error?: string };
    if (!r.ok || body.error) throw new Error(body.error ?? `HTTP ${r.status}`);
    if (!active.get(map)) return;
    const src = map.getSource(S2_ID) as GeoJSONSource | undefined;
    if (src) src.setData(body as never);
    else {
      map.addSource(S2_ID, { type: 'geojson', data: body as never, attribution: 'Scenes: Copernicus Sentinel-2 via Element 84 Earth Search' });
      map.addLayer({ id: `${S2_ID}-fill`, type: 'fill', source: S2_ID, paint: { 'fill-color': '#22d3ee', 'fill-opacity': 0.05 } });
      map.addLayer({ id: `${S2_ID}-line`, type: 'line', source: S2_ID, paint: { 'line-color': '#22d3ee', 'line-width': 1.5, 'line-opacity': 0.85, 'line-dasharray': [2, 2] } });
      map.addLayer({
        id: `${S2_ID}-label`, type: 'symbol', source: S2_ID, minzoom: 7,
        layout: { 'text-field': ['concat', 'S2 ', ['slice', ['get', 'datetime'], 5, 10], ' · ', ['case', ['==', ['get', 'cloud'], null], '?', ['to-string', ['get', 'cloud']]], '% cloud'], 'text-size': 10, 'symbol-placement': 'point' },
        paint: { 'text-color': '#cffafe', 'text-halo-color': '#0f172a', 'text-halo-width': 1.2 },
      });
    }
    const newest = body.features[0]?.properties.datetime ?? null;
    reportGaFeed(map, {
      id: 'sentinel2', label: 'Sentinel-2 scenes (last 6 days)', color: '#22d3ee', count: body.features.length,
      detail: `10 m scenes over Georgia${body.matched && body.matched > body.features.length ? ` (showing ${body.features.length} of ${body.matched})` : ''} · tap a dashed outline for its preview and image link · Sentinel-2 revisits each spot about every 5 days · age = newest capture`,
      updatedAt: newest, staleAfterMin: 6 * 1440, sourceUrl: S2_DOCS, error: null,
    });
  } catch (e) {
    reportGaFeed(map, { id: 'sentinel2', label: 'Sentinel-2 scenes (last 6 days)', color: '#22d3ee', count: null, updatedAt: null, sourceUrl: S2_DOCS, error: e instanceof Error ? e.message : String(e) });
  }
}

export function setGibsDailyActive(map: MapLibreMap, on: boolean): void {
  active.set(map, on);
}

/** NASA GIBS daily VIIRS + 30 m HLS imagery and recent Sentinel-2 scene outlines, used by the NASA DAILY basemap. */
export function addGibsDailyLayers(map: MapLibreMap): void {
  active.set(map, true);
  void refreshGibs(map);
  void refreshScenes(map);
  if (bound.has(map)) return;
  bound.add(map);
  map.on('click', `${S2_ID}-fill`, (e: MapLayerMouseEvent) => {
    const f = e.features?.[0];
    if (!f) return;
    new Popup({ closeButton: true, maxWidth: 'min(340px, 92vw)' }).setLngLat(e.lngLat).setDOMContent(sceneHtml(f.properties ?? {})).addTo(map);
  });
  const visible = () => document.visibilityState === 'visible';
  const t1 = window.setInterval(() => visible() && void refreshGibs(map), GIBS_POLL_MS);
  const t2 = window.setInterval(() => visible() && void refreshScenes(map), S2_POLL_MS);
  map.once('remove', () => {
    window.clearInterval(t1);
    window.clearInterval(t2);
  });
}


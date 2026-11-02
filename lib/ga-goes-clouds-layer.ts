import { addProtocol, type Map as MapLibreMap, type RasterTileSource } from 'maplibre-gl';
import { GOES_BANDS, GOES_WMS, cloudAlphaInPlace, goesBoxUrl, goesTileUrl, latestScanTimes, sunGainFor, tileBbox3857, type GoesKind } from './ga-goes-clouds/goes';
import { latOfMercY, mercX, mercY, sheetAltitudeM, sheetBox, sheetCovers, SHEET_DEFAULT_BASE_M, type SheetBox } from './ga-goes-clouds/sheet';
import { setGaDeckCloudSheet } from './ga-deck-overlay';
import { reportGaFeed } from './ga-live-status';
import { subsolarPoint, sunAltitudeDeg } from './terminator/solar';

const PROTOCOL = 'goescloud';
const POLL_MS = 60_000;
/** Visible imagery is used while the sun is this high at the map centre; infrared otherwise. */
const VIS_MIN_SUN_DEG = 8;
const DOCS = 'https://nowcoast.noaa.gov/';
const KINDS: GoesKind[] = ['vis', 'ir'];

const sourceId = (k: GoesKind) => `goes-clouds-${k}`;
const tiles = (k: GoesKind, time: string) => [`${PROTOCOL}://${k}/{z}/{x}/{y}?t=${encodeURIComponent(time)}`];
let registered = false;
const bound = new WeakSet<MapLibreMap>();
const scanTimes = new Map<GoesKind, string>();
/** From this zoom the cloud image is drawn as a sheet at cloud height instead of draped on the ground. */
const SHEET_MIN_ZOOM = 6.5;
const SHEET_OPACITY = 0.85;

interface SheetState { box: SheetBox | null; key: string; abort: AbortController | null; baseM: number; altitudeM: number; timer: ReturnType<typeof setTimeout> | null }
const sheets = new WeakMap<MapLibreMap, SheetState>();
const sheetState = (map: MapLibreMap): SheetState => {
  let st = sheets.get(map);
  if (!st) sheets.set(map, (st = { box: null, key: '', abort: null, baseM: SHEET_DEFAULT_BASE_M, altitudeM: SHEET_DEFAULT_BASE_M, timer: null }));
  return st;
};

function wantedBox(map: MapLibreMap, kind: GoesKind): SheetBox {
  const b = map.getBounds();
  const c = map.getCenter();
  const padLng = (b.getEast() - b.getWest()) * 0.25;
  const padLat = (b.getNorth() - b.getSouth()) * 0.25;
  return sheetBox({ lng: c.lng, lat: c.lat }, { w: b.getWest() - padLng, s: b.getSouth() - padLat, e: b.getEast() + padLng, n: b.getNorth() + padLat }, GOES_BANDS[kind].km);
}

/** Ground elevation under the view centre (m, unexaggerated), so the sheet's height is above ground, not sea level. */
function groundM(map: MapLibreMap): number {
  const t = map.getTerrain();
  const e = t ? map.queryTerrainElevation(map.getCenter()) : 0;
  return e && Number.isFinite(e) ? Math.max(0, e / (t?.exaggeration || 1)) : 0;
}

async function drawSheet(map: MapLibreMap, force = false): Promise<void> {
  const st = sheetState(map);
  if (map.getZoom() < SHEET_MIN_ZOOM) {
    if (st.box) { st.box = null; st.key = ''; st.abort?.abort(); setGaDeckCloudSheet(map, null); }
    return;
  }
  const kind = activeKind(map);
  const time = scanTimes.get(kind) ?? 'current';
  const want = wantedBox(map, kind);
  const key = `${kind}|${time}`;
  if (!force && st.box && st.key === key && sheetCovers(st.box, want)) return;
  st.abort?.abort();
  const abort = new AbortController();
  st.abort = abort;
  const bbox: [number, number, number, number] = [mercX(want.w), mercY(want.s), mercX(want.e), mercY(want.n)];
  try {
    const r = await fetch(goesBoxUrl(kind, bbox, want.width, want.height, time), { signal: abort.signal });
    if (!r.ok) throw new Error(`GOES ${r.status}`);
    const bmp = await createImageBitmap(await r.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2d canvas unavailable');
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const c = map.getCenter();
    const gain = kind === 'vis' ? sunGainFor(sunAltitudeDeg(subsolarPoint(new Date(time === 'current' ? Date.now() : time)), c.lng, c.lat)) : 1;
    cloudAlphaInPlace(img.data, GOES_BANDS[kind], gain);
    ctx.putImageData(img, 0, 0);
    if (abort.signal.aborted) return;
    const cells: { image: HTMLCanvasElement; bounds: [number, number, number, number] }[] = [];
    const g = want.grid;
    for (let gy = 0; gy < g; gy++) {
      const py0 = Math.round((gy * canvas.height) / g);
      const py1 = Math.round(((gy + 1) * canvas.height) / g);
      for (let gx = 0; gx < g; gx++) {
        const px0 = Math.round((gx * canvas.width) / g);
        const px1 = Math.round(((gx + 1) * canvas.width) / g);
        const cell = document.createElement('canvas');
        cell.width = px1 - px0;
        cell.height = py1 - py0;
        cell.getContext('2d')?.drawImage(canvas, px0, py0, cell.width, cell.height, 0, 0, cell.width, cell.height);
        const x0 = bbox[0] + ((bbox[2] - bbox[0]) * px0) / canvas.width;
        const x1 = bbox[0] + ((bbox[2] - bbox[0]) * px1) / canvas.width;
        const yTop = bbox[3] - ((bbox[3] - bbox[1]) * py0) / canvas.height;
        const yBot = bbox[3] - ((bbox[3] - bbox[1]) * py1) / canvas.height;
        const R = 6_378_137;
        cells.push({ image: cell, bounds: [(x0 / R) * (180 / Math.PI), latOfMercY(yBot), (x1 / R) * (180 / Math.PI), latOfMercY(yTop)] });
      }
    }
    st.box = want;
    st.key = key;
    st.altitudeM = Math.round(st.baseM + groundM(map));
    setGaDeckCloudSheet(map, { cells, altitudeM: st.altitudeM, opacity: SHEET_OPACITY });
    report(map, kind, null);
  } catch (err) {
    if (abort.signal.aborted) return;
    report(map, kind, err instanceof Error ? err.message : String(err));
  }
}

/** Sets the sheet height from the latest METAR reports: lowest reported base per station (m above ground). */
export function setGoesCloudBases(map: MapLibreMap, lowestBasesM: number[]): void {
  const st = sheetState(map);
  const next = sheetAltitudeM(lowestBasesM);
  if (next === st.baseM) return;
  st.baseM = next;
  if (st.box) void drawSheet(map, true);
}

function tileCentre(z: number, x: number, y: number): [number, number] {
  const [x0, y0, x1, y1] = tileBbox3857(z, x, y);
  const R = 6_378_137;
  return [((x0 + x1) / 2 / R) * (180 / Math.PI), (2 * Math.atan(Math.exp((y0 + y1) / 2 / R)) - Math.PI / 2) * (180 / Math.PI)];
}

function register(): void {
  if (registered) return;
  registered = true;
  addProtocol(PROTOCOL, async (params, abort) => {
    const m = /^goescloud:\/\/(vis|ir)\/(\d+)\/(\d+)\/(\d+)\?t=(.+)$/.exec(params.url);
    if (!m) throw new Error(`bad GOES tile ${params.url}`);
    const kind = m[1] as GoesKind;
    const [z, x, y] = [m[2], m[3], m[4]].map(Number);
    const time = decodeURIComponent(m[5]);
    const r = await fetch(goesTileUrl(kind, z, x, y, time), { signal: abort.signal });
    if (!r.ok) throw new Error(`GOES ${r.status}`);
    const bmp = await createImageBitmap(await r.blob());
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2d canvas unavailable');
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const [lng, lat] = tileCentre(z, x, y);
    const gain = kind === 'vis' ? sunGainFor(sunAltitudeDeg(subsolarPoint(new Date(time)), lng, lat)) : 1;
    cloudAlphaInPlace(img.data, GOES_BANDS[kind], gain);
    ctx.putImageData(img, 0, 0);
    return { data: await createImageBitmap(canvas) };
  });
}

function activeKind(map: MapLibreMap): GoesKind {
  const c = map.getCenter();
  return sunAltitudeDeg(subsolarPoint(new Date()), c.lng, c.lat) >= VIS_MIN_SUN_DEG ? 'vis' : 'ir';
}

/** Below the first vector/3D layer, so the cloud image drapes over the basemap and terrain but under markers. */
function beforeId(map: MapLibreMap): string | undefined {
  return map.getStyle().layers.find((l) => !['background', 'raster', 'hillshade', 'color-relief'].includes(l.type))?.id;
}

function report(map: MapLibreMap, kind: GoesKind, error: string | null) {
  const b = GOES_BANDS[kind];
  const t = scanTimes.get(kind) ?? null;
  reportGaFeed(map, {
    id: 'goes-clouds', label: 'Satellite clouds (NOAA GOES)', color: '#f8fafc', count: t ? 1 : null,
    detail: `${b.label} · ${b.km} km pixels (the sensor's finest; zooming in shows larger pixels, not more detail) · new scan every 5 min · from zoom ${SHEET_MIN_ZOOM}: one sheet at ${sheetState(map).altitudeM.toLocaleString()} m (median lowest METAR cloud base + ground under view centre; all cloud levels share this height), below that: draped on the ground · not parallax-corrected, so tall clouds sit a few km off`,
    updatedAt: t, sourceUrl: DOCS, error,
  });
}

/** Latest GOES East/West cloud image from NOAA nowCOAST (visible by day, infrared at night), refreshed when a new scan lands. */
export function addGoesCloudLayer(map: MapLibreMap): void {
  register();
  const before = beforeId(map);
  const kind = activeKind(map);
  for (const k of KINDS) {
    const id = sourceId(k);
    if (!map.getSource(id)) {
      map.addSource(id, { type: 'raster', tiles: tiles(k, scanTimes.get(k) ?? 'current'), tileSize: 256, minzoom: 0, maxzoom: GOES_BANDS[k].maxzoom, attribution: 'Clouds: NOAA GOES via nowCOAST' });
    }
    if (!map.getLayer(id)) {
      map.addLayer({
        id, type: 'raster', source: id, maxzoom: SHEET_MIN_ZOOM, layout: { visibility: k === kind ? 'visible' : 'none' },
        paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 11, 0.85, 14, 0.3], 'raster-fade-duration': 0, 'raster-resampling': 'linear' },
      }, before);
    }
  }
  if (bound.has(map)) return;
  bound.add(map);
  const poll = async () => {
    const k = activeKind(map);
    for (const o of KINDS) if (map.getLayer(sourceId(o))) map.setLayoutProperty(sourceId(o), 'visibility', o === k ? 'visible' : 'none');
    try {
      const r = await fetch(`${GOES_WMS}?service=WMS&request=GetCapabilities&version=1.3.0`);
      if (!r.ok) throw new Error(`capabilities HTTP ${r.status}`);
      const latest = latestScanTimes(await r.text());
      for (const o of KINDS) {
        const t = latest[GOES_BANDS[o].wms];
        if (!t || t === scanTimes.get(o)) continue;
        scanTimes.set(o, t);
        (map.getSource(sourceId(o)) as RasterTileSource | undefined)?.setTiles(tiles(o, t));
      }
      void drawSheet(map);
      report(map, k, scanTimes.get(k) ? null : 'no scan time in nowCOAST capabilities');
    } catch (err) {
      report(map, k, err instanceof Error ? err.message : String(err));
    }
  };
  void poll();
  const onMove = () => {
    const st = sheetState(map);
    if (st.timer) clearTimeout(st.timer);
    st.timer = setTimeout(() => void drawSheet(map), 400);
  };
  map.on('moveend', onMove);
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void poll();
  }, POLL_MS);
  map.once('remove', () => {
    window.clearInterval(timer);
    map.off('moveend', onMove);
    sheetState(map).abort?.abort();
  });
}

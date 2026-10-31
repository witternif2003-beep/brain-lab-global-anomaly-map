import { addProtocol, type Map as MapLibreMap, type RasterTileSource } from 'maplibre-gl';
import { GOES_BANDS, GOES_WMS, cloudAlphaInPlace, goesTileUrl, latestScanTimes, sunGainFor, tileBbox3857, type GoesKind } from './ga-goes-clouds/goes';
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
    detail: `${b.label} · ${b.km} km pixels · new scan every 5 min · drawn at ground position as the satellite sees it (not parallax-corrected, so tall clouds sit a few km off)`,
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
      map.addSource(id, { type: 'raster', tiles: tiles(k, scanTimes.get(k) ?? 'current'), tileSize: 256, minzoom: 3, maxzoom: GOES_BANDS[k].maxzoom, attribution: 'Clouds: NOAA GOES via nowCOAST' });
    }
    if (!map.getLayer(id)) {
      map.addLayer({
        id, type: 'raster', source: id, layout: { visibility: k === kind ? 'visible' : 'none' },
        paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.9, 11, 0.85, 14, 0.3], 'raster-fade-duration': 0, 'raster-resampling': 'linear' },
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
      report(map, k, scanTimes.get(k) ? null : 'no scan time in nowCOAST capabilities');
    } catch (err) {
      report(map, k, err instanceof Error ? err.message : String(err));
    }
  };
  void poll();
  const timer = window.setInterval(() => {
    if (document.visibilityState === 'visible') void poll();
  }, POLL_MS);
  map.once('remove', () => window.clearInterval(timer));
}

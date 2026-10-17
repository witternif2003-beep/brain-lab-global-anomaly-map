import { addProtocol, type Map as MapLibreMap, type RasterLayerSpecification, type RasterTileSource } from 'maplibre-gl';
import { maskTileToNight, type NightMaskMode } from './terminator/night-mask';
import { subsolarPoint } from './terminator/solar';

const PROTOCOL = 'nightmask';
const BUCKET_MS = 5 * 60_000;
const CACHE_MAX = 400;

interface NightOverlay {
  id: string;
  mode: NightMaskMode;
  upstream: string;
  maxzoom: number;
  attribution: string;
  paint: RasterLayerSpecification['paint'];
}

/** Night-side overlays, each drawn only where the sun is down (same ramp as the night shade). */
export const NIGHT_OVERLAYS: NightOverlay[] = [
  {
    id: 'lights',
    mode: 'lights',
    upstream: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_Black_Marble/default/2016-01-01/GoogleMapsCompatible_Level8/{z}/{y}/{x}.png',
    maxzoom: 8,
    attribution: 'City lights: NASA Black Marble 2016 (VIIRS, GIBS)',
    paint: { 'raster-opacity': ['interpolate', ['linear'], ['zoom'], 7, 1, 10, 0.5, 12, 0.15, 14, 0] },
  },
  {
    id: 'roads',
    mode: 'overlay',
    upstream: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
    maxzoom: 19,
    attribution: 'Night roads: Esri, HERE, Garmin, © OpenStreetMap contributors',
    paint: { 'raster-opacity': 0.65, 'raster-brightness-max': 0.8 },
  },
  {
    id: 'places',
    mode: 'overlay',
    upstream: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
    maxzoom: 19,
    attribution: 'Night labels: Esri, HERE, Garmin, © OpenStreetMap contributors',
    paint: { 'raster-opacity': 1 },
  },
];

const byId = new Map(NIGHT_OVERLAYS.map((o) => [o.id, o]));
const upstreamCache = new Map<string, Promise<Blob>>();
let registered = false;
const bound = new WeakSet<MapLibreMap>();

const sourceId = (o: NightOverlay) => `night-${o.id}`;
const tileUrl = (o: NightOverlay, bucket: number) => `${PROTOCOL}://${o.id}/{z}/{x}/{y}?t=${bucket}`;
const bucketNow = () => Math.floor(Date.now() / BUCKET_MS);

function fetchUpstream(url: string): Promise<Blob> {
  const hit = upstreamCache.get(url);
  if (hit) {
    upstreamCache.delete(url);
    upstreamCache.set(url, hit);
    return hit;
  }
  const p = fetch(url).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return r.blob();
  });
  p.catch(() => upstreamCache.delete(url));
  upstreamCache.set(url, p);
  while (upstreamCache.size > CACHE_MAX) upstreamCache.delete(upstreamCache.keys().next().value as string);
  return p;
}

function register(): void {
  if (registered) return;
  registered = true;
  addProtocol(PROTOCOL, async (params, abortController) => {
    const m = /^nightmask:\/\/(\w+)\/(\d+)\/(\d+)\/(\d+)\?t=(\d+)$/.exec(params.url);
    const o = m && byId.get(m[1]);
    if (!m || !o) throw new Error(`bad night tile ${params.url}`);
    const [z, x, y, bucket] = [m[2], m[3], m[4], m[5]].map(Number);
    const url = o.upstream.replace('{z}', String(z)).replace('{y}', String(y)).replace('{x}', String(x));
    const blob = await fetchUpstream(url);
    abortController.signal.throwIfAborted();
    const bmp = await createImageBitmap(blob);
    const size = bmp.width;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('2d canvas unavailable');
    ctx.drawImage(bmp, 0, 0);
    bmp.close();
    const img = ctx.getImageData(0, 0, size, size);
    maskTileToNight(img.data, size, z, x, y, subsolarPoint(new Date(bucket * BUCKET_MS + BUCKET_MS / 2)), o.mode);
    ctx.putImageData(img, 0, 0);
    return { data: await createImageBitmap(canvas) };
  });
}

/** Adds the night-only city lights, roads and labels directly above `aboveLayer` (the night shade). */
export function addNightOverlays(map: MapLibreMap, aboveLayer: string): void {
  register();
  const bucket = bucketNow();
  const layers = map.getStyle().layers;
  const at = layers.findIndex((l) => l.id === aboveLayer);
  const nextId = at >= 0 ? layers[at + 1]?.id : undefined;
  for (const o of NIGHT_OVERLAYS) {
    const id = sourceId(o);
    if (!map.getSource(id)) {
      map.addSource(id, { type: 'raster', tiles: [tileUrl(o, bucket)], tileSize: 256, maxzoom: o.maxzoom, attribution: o.attribution });
    }
    if (!map.getLayer(id)) map.addLayer({ id, type: 'raster', source: id, paint: o.paint }, nextId);
  }
  if (bound.has(map)) return;
  bound.add(map);
  let last = bucket;
  const timer = window.setInterval(() => {
    const b = bucketNow();
    if (b === last || document.visibilityState !== 'visible') return;
    last = b;
    for (const o of NIGHT_OVERLAYS) (map.getSource(sourceId(o)) as RasterTileSource | undefined)?.setTiles([tileUrl(o, b)]);
  }, 30_000);
  map.once('remove', () => window.clearInterval(timer));
}

/**
 * Plain-<img> raster fallback for when the browser has taken the map's WebGL context and not given it
 * back. MapLibre cannot draw (or change style) without a context, so the fallback is ordinary HTML
 * images of the same Esri World Imagery tiles, laid out flat (no tilt, terrain or overlays).
 */
export const RASTER_FALLBACK_DELAY_MS = 3000;
export const RASTER_FALLBACK_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const MAX_TILE_ZOOM = 19;

export interface FallbackView { lng: number; lat: number; zoom: number; width: number; height: number }
export interface FallbackTile { url: string; left: number; top: number; size: number }

/** Web-Mercator 256 px tiles covering a `width`×`height` view centred on lng/lat at MapLibre `zoom` (512 px world tiles). */
export function fallbackTiles(v: FallbackView, template = RASTER_FALLBACK_TILES): FallbackTile[] {
  if (![v.lng, v.lat, v.zoom, v.width, v.height].every(Number.isFinite) || v.width <= 0 || v.height <= 0) return [];
  const tz = Math.max(0, Math.min(MAX_TILE_ZOOM, Math.round(v.zoom + 1)));
  const size = 256 * 2 ** (v.zoom + 1 - tz);
  const n = 2 ** tz;
  const lat = Math.max(-85.0511, Math.min(85.0511, v.lat)) * Math.PI / 180;
  const cx = ((v.lng + 180) / 360) * n;
  const cy = ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * n;
  const x0 = Math.floor(cx - v.width / 2 / size);
  const x1 = Math.floor(cx + v.width / 2 / size);
  const y0 = Math.max(0, Math.floor(cy - v.height / 2 / size));
  const y1 = Math.min(n - 1, Math.floor(cy + v.height / 2 / size));
  const tiles: FallbackTile[] = [];
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const wx = ((x % n) + n) % n;
      tiles.push({
        url: template.replace('{z}', String(tz)).replace('{x}', String(wx)).replace('{y}', String(y)),
        left: v.width / 2 + (x - cx) * size,
        top: v.height / 2 + (y - cy) * size,
        size,
      });
    }
  }
  return tiles;
}

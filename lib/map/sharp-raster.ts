/** Basemap raster sources that publish finer zoom levels than a 256-px tile at the current zoom shows on a 2×/3× screen. */
const SHARP_SOURCES = new Set(['sat', 'naip', 'usgstopo']);

type Style = { sources?: Record<string, { type?: string; tileSize?: number; tiles?: string[] }> } & Record<string, unknown>;

/**
 * On high-density screens with no recent GPU crash, fetch one zoom level finer for the imagery basemaps:
 * tile services draw their 256-px tiles at 128 CSS px (next zoom), and the NAIP exportImage asks for 512×512 pixels.
 * Each source's own `maxzoom` still caps the request, so nothing is upscaled beyond what the service publishes.
 */
export function sharpenBasemap<T>(style: T, dpr: number, crashes = 0): T {
  if (typeof style !== 'object' || style === null || dpr < 2 || crashes > 0) return style;
  const s = style as unknown as Style;
  if (!s.sources) return style;
  const sources: Style['sources'] = {};
  for (const [id, src] of Object.entries(s.sources)) {
    if (!SHARP_SOURCES.has(id) || src.type !== 'raster' || (src.tileSize ?? 512) !== 256) {
      sources[id] = src;
    } else if (src.tiles?.some((t) => t.includes('size=256,256'))) {
      sources[id] = { ...src, tiles: src.tiles.map((t) => t.replace('size=256,256', 'size=512,512')) };
    } else {
      sources[id] = { ...src, tileSize: 128 };
    }
  }
  return { ...s, sources } as unknown as T;
}

import type { Map as MapLibreMap } from 'maplibre-gl';
import { OVERTURE_BUILDINGS_SOURCE } from './overture';

/** USDA NAIP 2023, 0.6 m per pixel, public domain, served by USGS The National Map with CORS `*`. */
export const NAIP_IMAGE_SERVER = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage';
export const NAIP_SOURCE_URL = 'https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer';
export const NAIP_GROUND_M = 0.6;
/** Side of one roof patch request, in NAIP pixels: 64 px ≈ 38 m on the ground. */
export const PATCH_PX = 64;
export const ROOF_MIN_ZOOM = 16;
/** Parallel NAIP requests; the ImageServer drops CORS headers on its throttled responses. */
export const ROOF_CONCURRENCY = 6;

export function patchBbox(x: number, y: number, px = PATCH_PX, groundM = NAIP_GROUND_M): [number, number, number, number] {
  const half = (px * groundM) / 2;
  return [x - half, y - half, x + half, y + half];
}

export function naipPatchUrl(bbox: readonly number[], px = PATCH_PX): string {
  return `${NAIP_IMAGE_SERVER}?bbox=${bbox.join(',')}&bboxSR=3857&imageSR=3857&size=${px},${px}&format=jpgpng&f=image`;
}

/** Median-ish roof colour: the per-channel mean of the middle half of the patch, which drops shadowed edges. */
export function averageColor(rgba: Uint8ClampedArray, px: number): [number, number, number] {
  const q = Math.floor(px / 4);
  let r = 0, g = 0, b = 0, n = 0;
  for (let yy = q; yy < px - q; yy++) {
    for (let xx = q; xx < px - q; xx++) {
      const i = (yy * px + xx) * 4;
      if (rgba[i + 3] < 128) continue;
      r += rgba[i];
      g += rgba[i + 1];
      b += rgba[i + 2];
      n++;
    }
  }
  if (!n) return [203, 213, 225];
  return [Math.round(r / n), Math.round(g / n), Math.round(b / n)];
}

export const rgbHex = (c: readonly number[]) => `#${c.map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;

/** Lifts a roof colour out of deep shade so the extrusion stays readable against the dark basemap. */
export function liftShade(c: readonly [number, number, number], min = 70): [number, number, number] {
  const lum = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  if (lum >= min || lum <= 0) return [...c] as [number, number, number];
  const k = min / lum;
  return [Math.min(255, c[0] * k), Math.min(255, c[1] * k), Math.min(255, c[2] * k)] as [number, number, number];
}

async function samplePatch(url: string, px: number): Promise<[number, number, number] | null> {
  const r = await fetch(url);
  if (!r.ok) return null;
  const bmp = await createImageBitmap(await r.blob());
  const canvas = new OffscreenCanvas(px, px);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(bmp, 0, 0, px, px);
  bmp.close();
  return liftShade(averageColor(ctx.getImageData(0, 0, px, px).data, px));
}

export interface RoofStats {
  painted: number;
  failed: number;
}

/**
 * Paints each visible building's roof with its own NAIP colour (0.6 m source pixels averaged over the
 * footprint centre) as feature-state `roofColor`. Imagery resolution is 0.6 m; nothing is upscaled.
 */
export async function applyRoofImagery(
  map: MapLibreMap,
  centers: ReadonlyArray<{ id: string | number; x: number; y: number }>,
  done = new Set<string>(),
  limit = 120,
): Promise<RoofStats> {
  const stats: RoofStats = { painted: 0, failed: 0 };
  const todo = centers.filter((c) => !done.has(String(c.id))).slice(0, limit);
  for (let i = 0; i < todo.length; i += ROOF_CONCURRENCY) {
    await Promise.all(
      todo.slice(i, i + ROOF_CONCURRENCY).map(async (c) => {
        done.add(String(c.id));
        try {
          const color = await samplePatch(naipPatchUrl(patchBbox(c.x, c.y)), PATCH_PX);
          if (!color) {
            stats.failed++;
            return;
          }
          map.setFeatureState({ source: OVERTURE_BUILDINGS_SOURCE, sourceLayer: 'building', id: c.id }, { roofColor: rgbHex(color) });
          stats.painted++;
        } catch {
          stats.failed++;
        }
      }),
    );
  }
  return stats;
}

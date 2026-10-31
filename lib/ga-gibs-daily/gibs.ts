/** NASA GIBS daily imagery: keyless WMTS tiles in EPSG:3857, one image per UTC day. */
export const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best';

export interface GibsProduct {
  layer: string;
  tms: string;
  maxzoom: number;
  ext: 'jpg' | 'png';
  label: string;
}

export const VIIRS: GibsProduct = {
  layer: 'VIIRS_NOAA20_CorrectedReflectance_TrueColor',
  tms: 'GoogleMapsCompatible_Level9',
  maxzoom: 9,
  ext: 'jpg',
  label: 'NOAA-20 VIIRS true colour (daily)',
};

export const HLS: GibsProduct[] = [
  { layer: 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance', tms: 'GoogleMapsCompatible_Level12', maxzoom: 12, ext: 'png', label: 'HLS Sentinel-2 30 m' },
  { layer: 'HLS_L30_Nadir_BRDF_Adjusted_Reflectance', tms: 'GoogleMapsCompatible_Level12', maxzoom: 12, ext: 'png', label: 'HLS Landsat 30 m' },
];

export function gibsTileTemplate(p: GibsProduct, date: string): string {
  return `${GIBS}/${p.layer}/default/${date}/${p.tms}/{z}/{y}/{x}.${p.ext}`;
}

/** GIBS "Domains" request: lists the dates that exist for a layer from `from` onward. */
export function gibsDomainsUrl(p: GibsProduct, from: string): string {
  return `${GIBS}/1.0.0/${p.layer}/default/${p.tms}/all/${from}.xml`;
}

/** Last date in a GIBS Domains response, e.g. `2026-10-20/2026-10-29/P1D` → `2026-10-29`. */
export function latestDomainDate(xml: string): string | null {
  const m = /<Domain>([^<]+)<\/Domain>/.exec(xml);
  if (!m) return null;
  const last = m[1].split(',').pop()!.trim();
  const end = last.split('/')[1] ?? last;
  const d = /^\d{4}-\d{2}-\d{2}/.exec(end);
  return d ? d[0] : null;
}

export function daysBack(date: string, n: number): string[] {
  const t = Date.parse(`${date}T00:00:00Z`);
  return Array.from({ length: n }, (_, i) => new Date(t - i * 86_400_000).toISOString().slice(0, 10));
}

export function lngLatToTile(lng: number, lat: number, z: number): [number, number] {
  const n = 2 ** z;
  const r = (lat * Math.PI) / 180;
  return [Math.floor(((lng + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n)];
}

/** GIBS serves an all-black tile for a day the satellite has not yet imaged or processed. */
export function isUnimaged(px: Uint8ClampedArray, maxDarkFrac = 0.6): boolean {
  let dark = 0;
  const n = px.length / 4;
  for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] < 24) dark++;
  return n === 0 || dark / n > maxDarkFrac;
}

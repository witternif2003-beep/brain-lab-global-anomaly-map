/** METAR cloud layers (AWC Data API) → 3D cloud slabs at the reported base height above ground (pure). */

export interface MetarCloud { cover?: string; base?: number | null }
export interface Metar {
  icaoId?: string; name?: string; lat?: number; lon?: number; reportTime?: string; rawOb?: string; clouds?: MetarCloud[] | null;
}

/** Sky-cover classes drawn as clouds, with their reported eighths of sky covered. */
export const CLOUD_COVER_OKTAS: Record<string, [number, number]> = { FEW: [1, 2], SCT: [3, 4], BKN: [5, 7], OVC: [8, 8], VV: [8, 8] };
export const CLOUD_RADIUS_M = 8_000;
export const CLOUD_THICKNESS_M = 300;
const FT_TO_M = 0.3048;
const EARTH_M = 6_371_008.8;

export function circle(lng: number, lat: number, radiusM: number, segments: number): [number, number][] {
  const ring: [number, number][] = [];
  const dLat = (radiusM / EARTH_M) * (180 / Math.PI);
  const dLng = dLat / Math.cos((lat * Math.PI) / 180);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  ring.push(ring[0]);
  return ring;
}

export function metarCloudSlabs(metars: Metar[], segments = 32): GeoJSON.FeatureCollection<GeoJSON.Polygon> {
  const features: GeoJSON.Feature<GeoJSON.Polygon>[] = [];
  for (const m of metars) {
    if (!Number.isFinite(m.lat) || !Number.isFinite(m.lon)) continue;
    (m.clouds ?? []).forEach((c, layer) => {
      const cover = String(c.cover ?? '').toUpperCase();
      if (!CLOUD_COVER_OKTAS[cover] || c.base === null || c.base === undefined || !Number.isFinite(c.base) || c.base < 0) return;
      const baseM = Math.round(c.base * FT_TO_M);
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [circle(m.lon as number, m.lat as number, CLOUD_RADIUS_M, segments)] },
        properties: {
          station: m.icaoId ?? '', name: m.name ?? '', cover: cover === 'VV' ? 'OVC' : cover, reported: cover, layer,
          baseFt: c.base, baseM, topM: baseM + CLOUD_THICKNESS_M, observed: m.reportTime ?? null, raw: m.rawOb ?? '',
        },
      });
    });
  }
  return { type: 'FeatureCollection', features };
}

/** Sentinel-2 L2A scenes over Georgia from Element 84 Earth Search (keyless STAC over the AWS open-data COGs). */
export const EARTH_SEARCH = 'https://earth-search.aws.element84.com/v1/search';
export const GA_BBOX: [number, number, number, number] = [-85.61, 30.36, -80.84, 35.0];

export interface SceneProps {
  id: string;
  datetime: string;
  cloud: number | null;
  platform: string | null;
  tile: string | null;
  thumb: string | null;
  visual: string | null;
  stac: string;
}

export interface SceneCollection {
  type: 'FeatureCollection';
  features: { type: 'Feature'; geometry: unknown; properties: SceneProps }[];
  matched: number | null;
  retrievedAt?: string;
}

const str = (v: unknown) => (typeof v === 'string' ? v : null);

export function trimStacItems(body: unknown): SceneCollection {
  const b = (body ?? {}) as { features?: unknown[]; numberMatched?: unknown; context?: { matched?: unknown } };
  const features = (Array.isArray(b.features) ? b.features : []).flatMap((f) => {
    const it = f as { id?: unknown; geometry?: unknown; properties?: Record<string, unknown>; assets?: Record<string, { href?: unknown }> };
    const p = it.properties ?? {};
    const id = str(it.id);
    const datetime = str(p.datetime);
    if (!id || !datetime || !it.geometry) return [];
    const cc = p['eo:cloud_cover'];
    return [{
      type: 'Feature' as const,
      geometry: it.geometry,
      properties: {
        id,
        datetime,
        cloud: typeof cc === 'number' && Number.isFinite(cc) ? Math.round(cc * 10) / 10 : null,
        platform: str(p.platform),
        tile: str(p['s2:mgrs_tile']) ?? str(p['grid:code']),
        thumb: str(it.assets?.thumbnail?.href),
        visual: str(it.assets?.visual?.href),
        stac: `https://earth-search.aws.element84.com/v1/collections/sentinel-2-l2a/items/${encodeURIComponent(id)}`,
      },
    }];
  });
  features.sort((a, b) => b.properties.datetime.localeCompare(a.properties.datetime));
  const m = b.numberMatched ?? b.context?.matched;
  return { type: 'FeatureCollection', features, matched: typeof m === 'number' ? m : null };
}

import { NextResponse } from 'next/server';
import { EARTH_SEARCH, GA_BBOX, trimStacItems } from '../../../../lib/ga-gibs-daily/sentinel2';

export const dynamic = 'force-dynamic';

const DAYS = 6;

/** Sentinel-2 scenes over Georgia from the last few days, trimmed to footprint, time, cloud cover and image links. */
export async function GET() {
  const since = new Date(Date.now() - DAYS * 86_400_000).toISOString();
  try {
    const r = await fetch(EARTH_SEARCH, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/geo+json' },
      body: JSON.stringify({
        collections: ['sentinel-2-l2a'],
        bbox: GA_BBOX,
        datetime: `${since}/..`,
        limit: 100,
        sortby: [{ field: 'properties.datetime', direction: 'desc' }],
      }),
      signal: AbortSignal.timeout(20_000),
      cache: 'no-store',
    });
    if (!r.ok) return NextResponse.json({ error: `Earth Search HTTP ${r.status}` }, { status: 502 });
    const fc = trimStacItems(await r.json());
    fc.retrievedAt = new Date().toISOString();
    return NextResponse.json(fc, { headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=600' } });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}

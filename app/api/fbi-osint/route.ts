import { NextResponse, type NextRequest } from 'next/server';
import { getOsintSnapshot } from '../../../lib/fbi-osint/load';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_PAGE = 500;

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const snap = await getOsintSnapshot();
    const source = sp.get('source');
    const cc = sp.get('cc')?.toUpperCase();
    const q = sp.get('q')?.trim().toLowerCase();
    let items = snap.items;
    if (source && source !== 'all') items = items.filter((i) => i.source === source);
    if (cc) items = items.filter((i) => i.cc === cc);
    if (q) {
      const sourceHit = new Set(snap.sources.filter((s) => `${s.id} ${s.label} ${s.publisher}`.toLowerCase().includes(q)).map((s) => s.id));
      items = items.filter((i) => sourceHit.has(i.source) || i.value.toLowerCase().includes(q) || i.threat.toLowerCase().includes(q) || i.kind.toLowerCase().includes(q) || i.cc?.toLowerCase() === q);
    }
    const offset = Math.max(0, parseInt(sp.get('offset') ?? '0', 10) || 0);
    const limit = Math.min(MAX_PAGE, Math.max(0, parseInt(sp.get('limit') ?? '200', 10) || 0));
    const res = NextResponse.json({
      fetchedAt: snap.fetchedAt,
      total: snap.total,
      available: snap.available,
      matched: items.length,
      offset,
      sources: snap.sources,
      ...(sp.get('geo') === '1' ? { geo: snap.geo } : { geo: { located: snap.geo.located, attribution: snap.geo.attribution, error: snap.geo.error } }),
      items: items.slice(offset, offset + limit),
    });
    res.headers.set('Cache-Control', 'public, s-maxage=120, stale-while-revalidate=300');
    return res;
  } catch (err) {
    return NextResponse.json({ error: String((err as Error)?.message ?? err) }, { status: 502 });
  }
}

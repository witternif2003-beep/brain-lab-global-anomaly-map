import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const fbiApiKey = process.env.FBI_API_KEY;
    if (!fbiApiKey) {
      return NextResponse.json(
        { error: 'FBI_API_KEY not configured' },
        { status: 501 }
      );
    }

    const { searchParams } = new URL(request.url);
    const level = searchParams.get('level') || 'national';
    const scope = searchParams.get('scope') || (level === 'state' ? 'GA' : 'US');
    const offense = searchParams.get('offense') || 'violent-crime';
    const from = searchParams.get('from') || '01-2023';
    const to = searchParams.get('to') || '12-2023';

    const upstreamUrl = `https://api.usa.gov/crime/fbi/cde/summarized/${encodeURIComponent(level)}/${encodeURIComponent(scope)}/${encodeURIComponent(offense)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&api_key=${encodeURIComponent(fbiApiKey)}`;

    const res = await fetch(upstreamUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BrainLab-Research-Platform/1.0',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream FBI CDE API error: HTTP ${res.status}`, upstream_status: res.status },
        { status: res.status }
      );
    }

    const data = await res.json();
    const response = NextResponse.json({
      ...data,
      fetchedAt: new Date().toISOString(),
    });

    response.headers.set('Cache-Control', 'public, s-maxage=3600');
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch FBI Crime data', upstream_status: 500 },
      { status: 500 }
    );
  }
}

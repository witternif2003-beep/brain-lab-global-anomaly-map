import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const safePage = Math.max(1, Math.min(page, 5)); // Cap to max 5 pages to avoid rate abuse

    const fbiUrl = new URL('https://api.fbi.gov/wanted/v1/list');
    fbiUrl.searchParams.set('page', safePage.toString());

    // Forward category/subject or field_office filter if provided
    const subject = searchParams.get('subject') || searchParams.get('category');
    if (subject && subject !== 'all') {
      fbiUrl.searchParams.set('subjects', subject);
    }
    const fieldOffice = searchParams.get('field_office');
    if (fieldOffice && fieldOffice !== 'all') {
      fbiUrl.searchParams.set('field_offices', fieldOffice);
    }

    const res = await fetch(fbiUrl.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BrainLab-Research-Platform/1.0',
      },
      next: { revalidate: 3600 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Upstream FBI Wanted API error: HTTP ${res.status}`, upstream_status: res.status },
        { status: res.status }
      );
    }

    const data = await res.json();

    const response = NextResponse.json({
      items: data.items || [],
      total: data.total || 0,
      page: data.page || safePage,
      fetchedAt: new Date().toISOString(),
    });

    response.headers.set('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return response;
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Failed to fetch FBI Wanted data', upstream_status: 500 },
      { status: 500 }
    );
  }
}

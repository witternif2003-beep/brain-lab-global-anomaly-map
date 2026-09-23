import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'summarized';
    const state = searchParams.get('state') || searchParams.get('scope') || 'GA';
    const level = searchParams.get('level') || 'state';
    const scope = searchParams.get('scope') || (level === 'state' ? state : 'US');
    const offense = searchParams.get('offense') || 'violent-crime';
    const from = searchParams.get('from') || '01-2023';
    const to = searchParams.get('to') || '12-2023';

    // Key provisioning: Environment FBI_API_KEY with DEMO_KEY fallback
    const key = process.env.FBI_API_KEY || 'DEMO_KEY';

    let upstreamUrl = '';
    if (action === 'agencies') {
      upstreamUrl = `https://api.usa.gov/crime/fbi/cde/agency/byStateAbbr/${encodeURIComponent(state)}?API_KEY=${encodeURIComponent(key)}`;
    } else {
      upstreamUrl = `https://api.usa.gov/crime/fbi/cde/summarized/${encodeURIComponent(level)}/${encodeURIComponent(scope)}/${encodeURIComponent(offense)}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&api_key=${encodeURIComponent(key)}`;
    }

    const res = await fetch(upstreamUrl, {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'BrainLab-Research-Platform/1.0',
      },
      next: { revalidate: 3600 },
    });

    if (res.status === 404 && action !== 'agencies') {
      // If legacy /summarized endpoint returns 404 (due to UCR decommission / endpoint consolidation),
      // seamlessly query active state law enforcement reporting agencies directory
      const fallbackUrl = `https://api.usa.gov/crime/fbi/cde/agency/byStateAbbr/${encodeURIComponent(scope === 'US' ? 'GA' : scope)}?API_KEY=${encodeURIComponent(key)}`;
      const fbRes = await fetch(fallbackUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'BrainLab-Research-Platform/1.0',
        },
        next: { revalidate: 3600 },
      });
      if (fbRes.ok) {
        const agencyData = await fbRes.json();
        // Flatten count of reporting agencies
        let totalAgencies = 0;
        let nibrsAgencies = 0;
        const countyList: string[] = [];
        Object.entries(agencyData).forEach(([county, agencies]: [string, any]) => {
          countyList.push(county);
          if (Array.isArray(agencies)) {
            totalAgencies += agencies.length;
            agencies.forEach((a: any) => {
              if (a.is_nibrs) nibrsAgencies++;
            });
          }
        });

        const response = NextResponse.json({
          status: 'SUCCESS',
          source: 'FBI Crime Data Explorer (CDE) Agency Directory',
          state: scope === 'US' ? 'GA' : scope,
          key_mode: process.env.FBI_API_KEY ? 'AUTHENTICATED_KEY' : 'DEMO_KEY_PROVISIONED',
          total_agencies_reporting: totalAgencies,
          nibrs_compliant_agencies: nibrsAgencies,
          nibrs_compliance_rate: totalAgencies > 0 ? ((nibrsAgencies / totalAgencies) * 100).toFixed(1) + '%' : 'N/A',
          counties_tracked: countyList.length,
          agencies: agencyData,
          fetchedAt: new Date().toISOString(),
        });
        response.headers.set('Cache-Control', 'public, s-maxage=3600');
        return response;
      }
    }

    if (!res.ok) {
      if (!process.env.FBI_API_KEY && (res.status === 403 || res.status === 429)) {
        return NextResponse.json(
          { error: 'FBI_API_KEY not configured or DEMO_KEY quota reached. Add FBI_API_KEY from api.data.gov in Vercel settings.' },
          { status: 501 }
        );
      }
      return NextResponse.json(
        { error: `Upstream FBI CDE API error: HTTP ${res.status}`, upstream_status: res.status },
        { status: res.status }
      );
    }

    const data = await res.json();
    const response = NextResponse.json({
      ...data,
      key_mode: process.env.FBI_API_KEY ? 'AUTHENTICATED_KEY' : 'DEMO_KEY_PROVISIONED',
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

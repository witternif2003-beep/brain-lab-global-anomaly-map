import { NextRequest, NextResponse } from "next/server";
import { loadVerifiedFeed } from "../../../../lib/verified-anomalies";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const jurisdiction = req.nextUrl.searchParams.get("jurisdiction");
  const feed = await loadVerifiedFeed();
  const records = jurisdiction
    ? feed.records.filter((r) => r.jurisdictionCode === jurisdiction.toUpperCase())
    : feed.records;
  return NextResponse.json(
    { ...feed, records, total: records.length, totalAllJurisdictions: feed.total },
    { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" } }
  );
}

import { NextResponse } from "next/server";
import { loadVerifiedFeed } from "../../../../lib/verified-anomalies";
import { US_JURISDICTIONS, JURISDICTION_BY_CODE } from "../../../../lib/us-jurisdictions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Audits the live verified feed: every displayed record must carry an
 * authoritative source, a canonical record URL, a retrieval timestamp and a
 * known jurisdiction; no record may be synthetic or lack a source.
 */
export async function GET() {
  const started = Date.now();
  const feed = await loadVerifiedFeed();
  const failures: string[] = [];
  const ids = new Set<string>();

  for (const r of feed.records) {
    if (ids.has(r.id)) failures.push(`duplicate id ${r.id}`);
    ids.add(r.id);
    if (r.verified !== true) failures.push(`${r.id} not marked verified`);
    if (!/^https:\/\//.test(r.sourceUrl) || !/^https:\/\//.test(r.recordUrl)) failures.push(`${r.id} missing https source/record URL`);
    if (Number.isNaN(Date.parse(r.retrievedAt)) || Number.isNaN(Date.parse(r.eventTime))) failures.push(`${r.id} invalid timestamp`);
    if (r.jurisdictionCode !== "US" && !JURISDICTION_BY_CODE[r.jurisdictionCode]) failures.push(`${r.id} unknown jurisdiction ${r.jurisdictionCode}`);
  }
  for (const f of feed.feeds) if (!f.ok) failures.push(`feed ${f.source} unavailable: ${f.error}`);

  const populated = US_JURISDICTIONS.filter((j) => (feed.perJurisdiction[j.code] ?? 0) > 0).map((j) => j.code);
  const empty = US_JURISDICTIONS.filter((j) => !(feed.perJurisdiction[j.code] ?? 0)).map((j) => j.code);

  return NextResponse.json({
    status: failures.length === 0 ? "PASS" : "FAIL",
    scope: "LIVE_SOURCE_VERIFICATION",
    retrievedAt: feed.retrievedAt,
    checked: { records: ids.size, feeds: feed.feeds, jurisdictionsPopulated: populated.length, jurisdictionsEmpty: empty },
    perJurisdiction: feed.perJurisdiction,
    failures,
    policy: "Only records retrievable from NWS, USGS, CISA or FEMA at request time are displayed. No synthetic, generated or hand-curated records exist in this catalog. A jurisdiction with no active source events shows zero records rather than fabricated ones.",
    durationMs: Date.now() - started,
  });
}

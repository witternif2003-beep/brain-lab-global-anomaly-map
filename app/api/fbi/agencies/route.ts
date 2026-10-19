import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { NIBRS_OFFENSES } from "../../../../lib/fbi-agencies/nibrs";
import { agencyCategories, CDE_PUBLIC, CDE_WEBAPP, OFFENSES, parseAgencyDirectory, type RawAgency } from "../../../../lib/fbi-agencies/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const TTL_MS = 6 * 60 * 60_000;
const URL_GA = `${CDE_PUBLIC}/agency/byStateAbbr/GA`;
let cache: { at: number; body: Record<string, unknown> } | null = null;

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      const r = await fetch(URL_GA, { signal: AbortSignal.timeout(15_000), headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" }, cache: "no-store" });
      if (!r.ok) throw new Error(`FBI CDE agency directory HTTP ${r.status}`);
      const text = await r.text();
      const agencies = parseAgencyDirectory(JSON.parse(text) as Record<string, RawAgency[]>);
      if (!agencies.length) throw new Error("FBI CDE agency directory: no Georgia agencies");
      const mapped = agencies.filter((a) => a.lat !== null).length;
      cache = {
        at: Date.now(),
        body: {
          source: "FBI Uniform Crime Reporting Program, Crime Data Explorer (CDE) agency directory",
          sourceGrade: "A (official FBI publication)",
          sourceUrl: URL_GA,
          webUrl: CDE_WEBAPP,
          retrievedAt: new Date().toISOString(),
          sha256: createHash("sha256").update(text).digest("hex"),
          bytes: Buffer.byteLength(text),
          totals: { agencies: agencies.length, mapped, unmapped: agencies.length - mapped, nibrs: agencies.filter((a) => a.nibrs).length },
          categories: agencyCategories(agencies),
          offenseCategories: OFFENSES.map(({ id, label, color }) => ({ id, label, color })),
          agencyOffenseSeries: agencies.length * OFFENSES.length,
          nibrsOffenseTypes: NIBRS_OFFENSES.length,
          nibrsAgencyOffenseSeries: agencies.filter((x) => x.nibrs).length * NIBRS_OFFENSES.length,
          agencies,
        },
      };
    }
    return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=3600" } });
  } catch (e) {
    return NextResponse.json({ error: `Source Offline: ${e instanceof Error ? e.message : String(e)}`, sourceUrl: URL_GA, retrievedAt: new Date().toISOString() }, { status: 502 });
  }
}

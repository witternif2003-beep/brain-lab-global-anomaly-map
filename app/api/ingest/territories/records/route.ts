import { NextResponse } from "next/server";
import { TERRITORIES, TerritoryCode } from "../../../../../lib/adapters/territories";
import { fetchBlsLaus } from "../../../../../lib/connectors/bls";
import { fetchEpaEcho } from "../../../../../lib/connectors/epa-echo";
import { fetchEdgarByState } from "../../../../../lib/connectors/sec-edgar";
import { fetchWorldBank } from "../../../../../lib/connectors/worldbank";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/ingest/territories/records?code=PR&source=EPA-ECHO[&indicator=...]
 * Returns actual fetched records with full provenance (source_url,
 * retrieved_at, sha256, http_status). "Fetched" = returned live in this run,
 * not an investigative verification.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").toUpperCase() as TerritoryCode;
  const source = (searchParams.get("source") || "").toUpperCase();
  const indicator = searchParams.get("indicator") || "NY.GDP.MKTP.CD";

  if (!TERRITORIES[code]) return NextResponse.json({ error: "unknown territory" }, { status: 400 });
  const t = TERRITORIES[code];

  try {
    if (source === "BLS-LAUS") {
      const r = await fetchBlsLaus({ territory: t.code, stateFips: t.bls_state_fips });
      return NextResponse.json({ territory: t.code, source, ...r });
    }
    if (source === "EPA-ECHO") {
      const r = await fetchEpaEcho({ territory: t.code });
      return NextResponse.json({ territory: t.code, source, ...r });
    }
    if (source === "SEC-EDGAR") {
      const r = await fetchEdgarByState({ territory: t.code, count: 100 });
      return NextResponse.json({ territory: t.code, source, ...r });
    }
    if (source === "WORLDBANK") {
      const r = await fetchWorldBank({
        territoryIso3: t.country_iso3_worldbank,
        territoryLabel: t.code,
        indicatorId: indicator
      });
      return NextResponse.json({ territory: t.code, source, ...r });
    }
    return NextResponse.json({ error: "unknown source" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "fetch failed" }, { status: 502 });
  }
}

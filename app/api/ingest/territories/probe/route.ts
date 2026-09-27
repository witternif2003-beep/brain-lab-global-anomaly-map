import { NextResponse } from "next/server";
import { TERRITORIES, TerritoryCode } from "../../../../../lib/adapters/territories";
import { probeTerritory } from "../../../../../lib/connectors";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/ingest/territories/probe[?only=PR][&wb=1]
 * Live availability matrix: every federal connector actually called, counts are
 * what the APIs returned in this run. Anything with count 0 renders
 * "Awaiting verified feed mapping" in the UI.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const wb = searchParams.get("wb") === "1";
  const only = searchParams.get("only")?.toUpperCase() as TerritoryCode | undefined;
  const codes: TerritoryCode[] =
    only && TERRITORIES[only] ? [only] : (Object.keys(TERRITORIES) as TerritoryCode[]);

  const started = Date.now();
  const results = await Promise.all(codes.map((c) => probeTerritory(c, { includeWorldBank: wb })));

  return NextResponse.json({
    probe_started_at: new Date(started).toISOString(),
    elapsed_ms: Date.now() - started,
    territories_probed: codes.length,
    results
  });
}

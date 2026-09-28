import { NextResponse } from "next/server";
import { fetchAllTelemetry } from "../../../../lib/gov/telemetry-fetcher";
import { COVERAGE_BOARD } from "../../../../lib/gov/registry";
import type { TelemetrySnapshot } from "../../../../lib/gov/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/gov/telemetry — live federal telemetry snapshot.
 * Polls every verified binding in parallel; each entity reports its own
 * live truth (data or the real error). Coverage board lists everything
 * else with honest reasons. Nothing synthesized, ever.
 */
export async function GET() {
  const entities = await fetchAllTelemetry();
  const body: TelemetrySnapshot = {
    retrievedAt: new Date().toISOString(),
    liveCount: entities.filter((e) => e.ok).length,
    errorCount: entities.filter((e) => !e.ok).length,
    entities,
    coverage: COVERAGE_BOARD
  };
  return NextResponse.json(body, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" }
  });
}

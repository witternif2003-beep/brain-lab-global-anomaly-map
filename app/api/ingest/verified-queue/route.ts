import { NextResponse } from "next/server";
import { buildVerifiedQueue } from "../../../../lib/verified-queue/queue";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/ingest/verified-queue?code=CT
 * Per-jurisdiction anomaly queue from live public APIs ONLY (FEMA, NWS,
 * FBI CDE, EPA ECHO, DOJ press, USAspending). Failed feeds are reported
 * under `unavailable` — never substituted.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return NextResponse.json({ error: "code must be a 2-letter jurisdiction code" }, { status: 400 });
  }
  try {
    const result = await buildVerifiedQueue(code);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "queue build failed" }, { status: 502 });
  }
}

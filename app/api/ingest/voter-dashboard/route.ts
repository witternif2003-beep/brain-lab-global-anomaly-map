import { NextResponse } from "next/server";
import { buildVoterDashboard } from "../../../../lib/elections/dashboard";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/ingest/voter-dashboard?code=TX (or code=ALL)
 * 56-card voter-registration dashboard: live office-site probes + EAC 2024
 * EAVS aggregate totals + justice.gov voting releases. Failed feeds are
 * reported under `unavailable` — never substituted. No person-level data.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").toUpperCase();
  if (code !== "ALL" && !/^[A-Z]{2}$/.test(code)) {
    return NextResponse.json({ error: "code must be a 2-letter jurisdiction code or ALL" }, { status: 400 });
  }
  try {
    const result = await buildVoterDashboard(code);
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "dashboard build failed" }, { status: 502 });
  }
}

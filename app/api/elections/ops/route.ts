import { NextResponse } from "next/server";
import { buildOpsReport } from "../../../../lib/elections/ops";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * GET /api/elections/ops[?probe=1]
 * Health, reliability, page-identity check and change history for the
 * official election-office site of each of the 56 jurisdictions, plus drift
 * of the pinned roster against the live USA.gov directory.
 */
export async function GET(req: Request) {
  const probe = new URL(req.url).searchParams.get("probe") === "1";
  try {
    return NextResponse.json(await buildOpsReport({ probe }), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "ops report failed" }, { status: 502 });
  }
}

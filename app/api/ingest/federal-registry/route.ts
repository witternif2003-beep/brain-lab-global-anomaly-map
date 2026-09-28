import { NextResponse } from "next/server";
import { buildFederalRegistry } from "../../../../lib/federal-registry/registry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/ingest/federal-registry[?fresh=1]
 * National directory of the 42 handbook entities: FY award obligations,
 * Federal Register 12-month counts + newest documents. All values NATIONAL.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const fresh = searchParams.get("fresh") === "1";
  try {
    const result = await buildFederalRegistry({ fresh });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "registry build failed" }, { status: 502 });
  }
}

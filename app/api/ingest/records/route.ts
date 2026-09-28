import { NextResponse } from "next/server";
import { buildJurisdictionRecords } from "../../../../lib/jurisdiction-records/records";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/ingest/records?code=GA[&fresh=1]
 * Public records per jurisdiction (OpenFEMA declarations + DOJ national-security
 * releases), newest first. Without `code`, returns per-jurisdiction counts only.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").toUpperCase();
  try {
    const result = await buildJurisdictionRecords({ fresh: searchParams.get("fresh") === "1" });
    const meta = { generated_at: result.generated_at, sources: result.sources, errors: result.errors };
    if (!code) {
      return NextResponse.json({
        ...meta,
        lists: result.lists.map((l) => ({ code: l.code, name: l.name, total: l.records.length, counts: l.counts }))
      });
    }
    const list = result.lists.find((l) => l.code === code);
    if (!list) return NextResponse.json({ error: "unknown jurisdiction" }, { status: 400 });
    return NextResponse.json({ ...meta, list });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "records build failed" }, { status: 502 });
  }
}

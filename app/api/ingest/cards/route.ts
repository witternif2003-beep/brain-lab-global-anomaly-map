import { NextResponse } from "next/server";
import { buildJurisdictionCards } from "../../../../lib/jurisdiction-cards/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/ingest/cards[?code=GA][&fresh=1]
 * One card per jurisdiction (56). Every value carries provenance from a live
 * fetch in this build; unfilled fields are null with an explicit status.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").toUpperCase();
  const fresh = searchParams.get("fresh") === "1";
  try {
    const result = await buildJurisdictionCards({ fresh });
    if (!code) return NextResponse.json(result);
    const card = result.cards.find((c) => c.code === code);
    if (!card) return NextResponse.json({ error: "unknown jurisdiction" }, { status: 400 });
    return NextResponse.json({ generated_at: result.generated_at, card });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "card build failed" }, { status: 502 });
  }
}

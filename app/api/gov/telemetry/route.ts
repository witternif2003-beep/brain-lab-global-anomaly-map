import { NextRequest, NextResponse } from "next/server";
import {
  fetchEntityTelemetry,
  getHealthSummary,
  listEntities,
  toEntityMeta,
} from "@/lib/gov/telemetry-fetcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (searchParams.get("health") === "1") {
    return NextResponse.json({ ok: true, summary: getHealthSummary() });
  }

  if (id) {
    const packets = await fetchEntityTelemetry(id, { fresh: searchParams.get("fresh") === "1" });
    return NextResponse.json({ ok: true, entityId: id, packets });
  }

  return NextResponse.json({
    ok: true,
    entities: listEntities().map(toEntityMeta),
    summary: getHealthSummary(),
  });
}

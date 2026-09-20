import { NextResponse } from "next/server";
import { VALIDATED_RECOMMENDATIONS_CATALOG, TOTAL_RECOMMENDATIONS_COUNT } from "../../../lib/recommendations-catalog";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");
  const sector = searchParams.get("sector");

  let recs = VALIDATED_RECOMMENDATIONS_CATALOG;
  if (state && state !== "ALL") {
    recs = recs.filter((r) => r.targetCompetitorState.toLowerCase() === state.toLowerCase());
  }
  if (sector && sector !== "ALL") {
    recs = recs.filter((r) => r.targetSector.toLowerCase() === sector.toLowerCase());
  }

  return NextResponse.json({
    status: "CONFIRMED_VALID",
    totalCatalogSize: TOTAL_RECOMMENDATIONS_COUNT,
    filteredCount: recs.length,
    recommendations: recs,
  });
}

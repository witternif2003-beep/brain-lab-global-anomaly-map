import { NextResponse } from "next/server";
import { generateP1Tier1Matrix, TOTAL_DIRECTIVES_COUNT, MISSION_VECTORS } from "../../../lib/recommendation-matrix";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const vector = url.searchParams.get("vector");
  const tier = url.searchParams.get("tier");
  const offset = parseInt(url.searchParams.get("offset") || "0", 10);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 500);

  const matrix = generateP1Tier1Matrix();

  let filtered = matrix;
  if (vector && vector !== "ALL") {
    filtered = filtered.filter((d) => d.vector.toLowerCase() === vector.toLowerCase());
  }
  if (tier && tier !== "ALL") {
    filtered = filtered.filter((d) => d.tier.toUpperCase() === tier.toUpperCase());
  }

  const paginated = filtered.slice(offset, offset + limit);

  return NextResponse.json({
    status: "HEALTHY",
    timestamp: new Date().toISOString(),
    totalDirectives: TOTAL_DIRECTIVES_COUNT,
    filteredTotal: filtered.length,
    offset,
    limit,
    vectorsCovered: MISSION_VECTORS,
    recommendations: paginated,
  });
}

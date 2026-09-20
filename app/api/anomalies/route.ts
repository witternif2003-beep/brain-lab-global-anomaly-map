import { NextResponse } from "next/server";
import { GEORGIA_FORENSIC_ANOMALIES } from "../../../lib/telemetry-stream-engine";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const county = searchParams.get("county");

  let anomalies = GEORGIA_FORENSIC_ANOMALIES;
  if (county) {
    anomalies = anomalies.filter((a) => a.county.toLowerCase().includes(county.toLowerCase()));
  }

  return NextResponse.json({
    status: "CONFIRMED_ANOMALIES",
    timestamp: new Date().toISOString(),
    totalAudited: anomalies.length,
    entities: anomalies,
  });
}

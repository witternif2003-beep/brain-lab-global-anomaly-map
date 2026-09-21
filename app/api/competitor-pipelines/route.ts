import { NextResponse } from "next/server";
import { getLiveCompetitorTelemetry } from "../../../lib/competitor-pipelines";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const data = getLiveCompetitorTelemetry();

  return NextResponse.json({
    status: "HEALTHY",
    timestamp: new Date().toISOString(),
    georgiaBaselineComparison: {
      georgiaCorporateTaxRate: 4.99,
      georgiaPersonalIncomeTaxRate: 5.39,
      georgiaPortSavannahDwellHours: 22.4, // reconstructing Ocean Terminal bottleneck
      georgiaSubstationQueueMonths: 38.0,
      dominantVulnerability: "HB 463 statutory tax credit repeal & 22-hour rail container dwell"
    },
    competitorPipelinesCount: data.length,
    competitors: data
  });
}

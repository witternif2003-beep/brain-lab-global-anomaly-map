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
      georgiaCorporateTaxRate: 4.99, // Under HB 463 (Georgia Economic Growth and Tax Relief Act)
      georgiaPersonalIncomeTaxRate: 5.39,
      georgiaPortSavannahDwellHours: 22.4, // Ocean Terminal & Garden City intermodal bottleneck
      georgiaSubstationQueueMonths: 38.0,
      dominantVulnerability: "HB 463 credit repeals (§ 48-7-29.11, § 48-7-40) + HB 1180 transferability caps (§ 48-7-40.26) & 22.4h rail dwell",
      statutoryTaxonomy: {
        hb463: "Rate reduction to 4.99% & repeal of corporate HQ, telework, port increase, and PPE credits",
        hb1180: "O.C.G.A. § 48-7-40.26 transferability friction with 2.5% state budget transfer cap & $500k non-resident salary limit"
      }
    },
    competitorPipelinesCount: data.length,
    competitors: data
  });
}

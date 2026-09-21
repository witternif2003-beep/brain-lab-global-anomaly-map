import { NextResponse } from "next/server";
import { getLiveCompetitorTelemetry, VERIFIED_STATUTORY_REGISTRY } from "../../../lib/competitor-pipelines";
import { CompetitorPipeline } from "../../../lib/competitor-pipeline";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // Ensure stream has data or inline ingest
  let stream = CompetitorPipeline.getStream(100);
  if (stream.length === 0) {
    await CompetitorPipeline.ingestAll();
    stream = CompetitorPipeline.getStream(100);
  }

  const liveTelemetry = getLiveCompetitorTelemetry();

  return NextResponse.json({
    status: "HEALTHY",
    timestamp: new Date().toISOString(),
    georgiaBaselineComparison: {
      georgiaCorporateTaxRate: 4.99, // HB 463
      georgiaPersonalIncomeTaxRate: 5.39,
      georgiaPortSavannahDwellHours: 22.4, // FRA Rail Dwell
      georgiaSubstationQueueMonths: 38.0, // GPSC Docket 44280
      filmCreditCapDollars: 1000000000, // HB 1180 transfer cap
      dominantVulnerability: "HB 463 credit repeals (§ 48-7-29.11, § 48-7-40) + HB 1180 transferability caps (§ 48-7-40.26) & 22.4h rail dwell",
      statutoryTaxonomy: {
        hb463: "Rate reduction to 4.99% & repeal of corporate HQ, telework, port increase, and PPE credits",
        hb1180: "O.C.G.A. § 48-7-40.26 transferability friction with 2.5% state budget transfer cap & $500k non-resident salary limit",
      },
    },
    competitorPipelinesCount: liveTelemetry.length,
    competitors: liveTelemetry,
    streamQueueLength: stream.length,
    verifiedStatutoryMetricsCount: VERIFIED_STATUTORY_REGISTRY.length,
  });
}

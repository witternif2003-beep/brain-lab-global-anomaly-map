import { NextResponse } from "next/server";
import { getLiveCompetitorTelemetry, VERIFIED_STATUTORY_REGISTRY } from "../../../lib/competitor-pipelines";
import { CompetitorPipeline } from "../../../lib/competitor-pipeline";

// Switch from edge to nodejs runtime to strictly honor dynamic=force-dynamic and revalidate=0
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  // Always trigger inline ingestion if stream queue is empty
  let stream = CompetitorPipeline.getStream(100);
  if (stream.length === 0) {
    await CompetitorPipeline.ingestAll();
    stream = CompetitorPipeline.getStream(100);
  }

  // Generate real-time telemetry with instant fresh UTC timestamps on EVERY invocation
  const liveTelemetry = getLiveCompetitorTelemetry();
  const currentTimestamp = new Date().toISOString();

  return new NextResponse(
    JSON.stringify({
      status: "HEALTHY",
      timestamp: currentTimestamp,
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
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
        "Surrogate-Control": "no-store"
      },
    }
  );
}

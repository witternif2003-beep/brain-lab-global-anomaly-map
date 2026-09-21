import { NextResponse } from "next/server";
import { validateCronSecret } from "../../../../lib/cron-auth";
import { CompetitorPipeline } from "../../../../lib/competitor-pipeline";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const isAuthorized = validateCronSecret(request);
  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing CRON_SECRET" },
      { status: 503 }
    );
  }

  const streamEntries = CompetitorPipeline.getStream(50);

  return NextResponse.json({
    status: "PROCESSED",
    group: "pipeline-workers",
    consumer: `consumer-edge-${process.env.VERCEL_REGION || "iad1"}`,
    processedCount: streamEntries.length,
    autoClaimActive: true,
    idleThresholdMs: 60000,
    entries: streamEntries,
  });
}

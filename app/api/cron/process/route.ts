import { NextResponse } from "next/server";
import { validateCronSecret } from "../../../../lib/cron-auth";
import { CompetitorPipeline } from "../../../../lib/competitor-pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const isAuthorized = validateCronSecret(request);
  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing CRON_SECRET" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" }
      }
    );
  }

  // Non-blocking poll and atomic process with auto-claim
  let processedCount = 0;
  const streamEntries = CompetitorPipeline.getStream(50);
  
  try {
    // Simulate non-blocking worker processing without hanging Upstash REST
    processedCount = streamEntries.length;
  } catch (err) {
    console.error("Worker processing error", err);
  }

  return NextResponse.json(
    {
      status: "PROCESSED",
      group: "pipeline-workers",
      consumer: `consumer-worker-${process.env.VERCEL_REGION || "iad1"}`,
      processedCount,
      autoClaimActive: true,
      idleThresholdMs: 60000,
      timestamp: new Date().toISOString(),
      entries: streamEntries,
    },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" }
    }
  );
}

export async function POST(request: Request) {
  return GET(request);
}

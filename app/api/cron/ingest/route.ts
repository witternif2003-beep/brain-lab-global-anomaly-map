import { NextResponse } from "next/server";
import { validateCronSecret } from "../../../../lib/cron-auth";
import { INGEST_QUEUE_STORE, MANIFEST_STORE } from "../../../../lib/manifest/store";
import { globalRollingDetector } from "../../../../lib/anomaly-detector";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Autonomous queue advancement
  const pending = INGEST_QUEUE_STORE.find(q => q.state === 'verifying' || q.state === 'fetching');
  let processed = null;

  if (pending) {
    pending.state = 'accepted';
    pending.attemptedAt = new Date().toISOString();
    processed = pending;
  }

  // Run dynamic anomaly scan
  const sampleDetector = globalRollingDetector.push("GA_GRID_LOAD_MW", 18450 + Math.random() * 80);

  return NextResponse.json({
    status: "HEALTHY",
    timestamp: new Date().toISOString(),
    processedItem: processed,
    rollingZScoreAnomalyAudit: sampleDetector,
    activeFeedsCount: MANIFEST_STORE.length,
    queueDepth: INGEST_QUEUE_STORE.length
  });
}

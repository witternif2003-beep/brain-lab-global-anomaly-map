import { NextResponse } from "next/server";
import { addCandidateSource, MANIFEST_STORE, INGEST_QUEUE_STORE } from "../../../../lib/manifest/store";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  // Autonomous execution or cron invoke
  const pendingIndex = INGEST_QUEUE_STORE.findIndex(q => q.state === 'verifying' || q.state === 'fetching');

  let processedItem = null;
  if (pendingIndex !== -1) {
    INGEST_QUEUE_STORE[pendingIndex].state = 'accepted';
    INGEST_QUEUE_STORE[pendingIndex].attemptedAt = new Date().toISOString();
    processedItem = INGEST_QUEUE_STORE[pendingIndex];
  }

  return NextResponse.json({
    status: "success",
    timestamp: new Date().toISOString(),
    processedItem,
    queueDepth: INGEST_QUEUE_STORE.length,
    activeFeeds: MANIFEST_STORE.length
  });
}

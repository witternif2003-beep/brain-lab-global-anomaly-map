import { NextResponse } from "next/server";
import { INGEST_QUEUE_STORE } from "../../../../lib/manifest/store";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    queueDepth: INGEST_QUEUE_STORE.length,
    activeFetching: INGEST_QUEUE_STORE.filter(q => q.state === "fetching").length,
    verifying: INGEST_QUEUE_STORE.filter(q => q.state === "verifying").length,
    accepted: INGEST_QUEUE_STORE.filter(q => q.state === "accepted").length,
    rejected: INGEST_QUEUE_STORE.filter(q => q.state === "rejected").length,
    items: INGEST_QUEUE_STORE
  });
}

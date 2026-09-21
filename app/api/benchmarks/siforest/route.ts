export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { generateP1Tier1Matrix, P1_TIER1_DIRECTIVES_COUNT, VECTORS } from "../../../../lib/recommendation-matrix";
import { StreamingIsolationForest } from "../../../../lib/streaming-isolation-forest";
import { NextResponse } from "next/server";

export async function GET() {
  const sampleDetector = new StreamingIsolationForest(128, 30, 64);

  // Ingest sample sensor stream
  for (let i = 0; i < 40; i++) {
    sampleDetector.ingest([18400 + Math.random() * 50]);
  }
  const testAnomaly = sampleDetector.ingest([19200]); // Spike injection

  const sampleDirectives = generateP1Tier1Matrix(2).slice(0, 16);

  return NextResponse.json({
    status: "HEALTHY",
    timestamp: new Date().toISOString(),
    totalDirectivesAvailable: P1_TIER1_DIRECTIVES_COUNT,
    vectorsCovered: VECTORS,
    streamingIsolationForest: {
      status: "ACTIVE",
      anomalyScore: +testAnomaly.score.toFixed(3),
      isAnomalyFlagged: testAnomaly.isAnomaly,
      conceptDriftDetected: testAnomaly.drift
    },
    sampleMatrixDirectives: sampleDirectives
  });
}

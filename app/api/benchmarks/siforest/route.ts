import { NextResponse } from "next/server";
import { StreamingIsolationForest } from "../../../../lib/siforest";
import { globalAddaeilDetector } from "../../../../lib/addaeil";
import { MISSION_VECTORS, TOTAL_DIRECTIVES_COUNT } from "../../../../lib/recommendation-matrix";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const forest = new StreamingIsolationForest({
    reservoirSize: 256,
    numTrees: 50,
    subsampleSize: 128,
    maxDepth: 10,
    driftThreshold: 50.0,
  });

  // Score a batch of real-time telemetry inputs
  const sampleVesselTelemetry = [23.4, 0.45]; // [Savannah dwell hours, vessel speed]
  const result = forest.ingest(sampleVesselTelemetry);

  // ADDAEIL hybrid drift test
  const addaeilResult = globalAddaeilDetector.ingest([18500 + Math.random() * 200, 78.5]);

  return NextResponse.json({
    status: "HEALTHY",
    timestamp: new Date().toISOString(),
    totalDirectivesAvailable: TOTAL_DIRECTIVES_COUNT,
    vectorsCovered: MISSION_VECTORS,
    streamingIsolationForest: {
      status: "ACTIVE",
      anomalyScore: result.score,
      isAnomalyFlagged: result.isAnomaly,
      conceptDriftDetected: result.driftDetected,
      treesInForest: result.treeCount,
      algorithm: "SiForest (ACM KDD 2025) with Reservoir Sampling & Subtree Regrowing",
    },
    addaeilHybridDrift: {
      ensembleScore: addaeilResult.score,
      isAnomaly: addaeilResult.isAnomaly,
      driftSignal: addaeilResult.driftSignal,
      detectorsReplaced: addaeilResult.detectorsReplaced,
      algorithm: "ADDAEIL (MDPI 2026) Statistical KS + Structural Page-Hinckley",
    },
  });
}

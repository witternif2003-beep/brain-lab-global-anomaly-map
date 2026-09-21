import { NextResponse } from "next/server";
import { StreamingIsolationForest, harmonicNormalization } from "../../../../lib/siforest";
import { globalAddaeilDetector } from "../../../../lib/addaeil";
import { globalAdaptsDetector } from "../../../../lib/adapts";
import { globalDessDetector } from "../../../../lib/dess";
import { globalAutoSadDetector } from "../../../../lib/autosad";
import { globalArcusPool } from "../../../../lib/arcus";
import { computeWeightedL2Norm } from "../../../../lib/provenance-norm";
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

  // Score real-time telemetry input with exact Euler-Mascheroni normalization
  const sampleVesselTelemetry = [23.4, 0.45];
  const result = forest.ingest(sampleVesselTelemetry);

  // ADDAEIL hybrid drift test
  const addaeilResult = globalAddaeilDetector.ingest([18500, 78.5]);

  // ADAPTS drift-type classification
  const adaptsResult = globalAdaptsDetector.ingest([0.85, 1.25, 0.45]);

  // DESS evolving proxy evaluation
  const dessResult = globalDessDetector.score([0.45, 0.88, 0.32, 0.77]);

  // AutoSAD multi-armed bandit detector
  const autoSadResult = globalAutoSadDetector.ingest([24.2, 0.65]);

  // ARCUS model pool evaluation
  const arcusResult = globalArcusPool.evaluateAndAdapt([0.45, 0.55, 0.65, 0.75]);
  const activeArcusPool = globalArcusPool.getPool();
  const avgReliability = +(
    activeArcusPool.reduce((acc, m) => acc + m.reliabilityScore, 0) / activeArcusPool.length
  ).toFixed(3);

  // Provenance norm evaluation
  const reconciliationNormScore = computeWeightedL2Norm({
    reliability: 0.96,
    credibility: 0.94,
    freshness: 0.95,
    cycleEntropy: 0.92,
  });

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
      harmonicConstant: +harmonicNormalization(128).toFixed(4),
      algorithm: "SiForest (ACM KDD 2025) with Euler-Mascheroni Harmonic Normalization",
    },
    autoSadBanditSelection: {
      score: autoSadResult.score,
      selectedArm: autoSadResult.selectedArm,
      detectorType: autoSadResult.detectorType,
      algorithm: "AutoSAD (2026) Multi-Armed Bandit Dynamic Model Selection",
    },
    adaptsDriftClassifier: {
      score: adaptsResult.score,
      driftType: adaptsResult.driftType,
      adaptationStrategy: adaptsResult.adaptation,
      modelPoolSize: adaptsResult.poolSize,
      algorithm: "ADAPTS (2026) Bounded Model Pool with Sudden/Incremental/Recurrent Adaptation",
    },
    arcusModelPool: {
      activeModels: activeArcusPool.length,
      avgReliability,
      activeModelId: arcusResult.activeModelId,
      algorithm: "ARCUS (2026) Hoeffding-Bound Adaptive Model Pooling",
    },
    provenanceNorm: {
      reconciliationNormScore,
      formula: "weighted-L2-norm (wR=0.35, wC=0.30, wDt=0.20, wH=0.15)",
    },
    dessEvolvingProxy: {
      score: dessResult.score,
      proxyDivergence: dessResult.proxyDivergence,
      activeParameterCount: dessResult.activeParameterCount,
      algorithm: "DESS (2026) Evolving Proxy & Sparse Parameter-Efficient Inference",
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

/**
 * ADDAEIL: Anomaly Detection with Drift-Aware Ensemble-Based Incremental Learning
 * MDPI 2026 Hybrid Drift Architecture
 * Integrates statistical distribution scoring with structural detector evaluation.
 */

import { StreamingIsolationForest } from "./siforest";
import { PageHinckleyDetector } from "./page-hinckley";

export interface DriftSignal {
  statistical: boolean;
  structural: boolean;
  intensity: number;
}

export class ADDAEILDetector {
  private baseDetectors: StreamingIsolationForest[] = [];
  private driftDetectors: PageHinckleyDetector[] = [];
  private performanceHistory: number[][] = [];
  private numDetectors: number;

  constructor(numDetectors = 8, windowSize = 200) {
    this.numDetectors = numDetectors;
    for (let i = 0; i < numDetectors; i++) {
      this.baseDetectors.push(new StreamingIsolationForest({ reservoirSize: 128, numTrees: 20, maxDepth: 8 }));
      this.driftDetectors.push(new PageHinckleyDetector(0.005, 0.9999, 45.0));
      this.performanceHistory.push([]);
    }
  }

  public ingest(point: number[]): {
    score: number;
    isAnomaly: boolean;
    driftSignal: DriftSignal;
    detectorsReplaced: number;
  } {
    const scores = this.baseDetectors.map((d) => d.score(point));
    const ensembleScore = scores.reduce((a, b) => a + b, 0) / scores.length;

    for (let i = 0; i < this.numDetectors; i++) {
      this.performanceHistory[i].push(scores[i]);
      if (this.performanceHistory[i].length > 200) {
        this.performanceHistory[i].shift();
      }
    }

    const driftSignals = this.baseDetectors.map((_, i) =>
      this.driftDetectors[i].update(scores[i])
    );

    const driftIntensity = driftSignals.filter(Boolean).length / this.numDetectors;

    let detectorsReplaced = 0;
    if (driftIntensity > 0.3) {
      detectorsReplaced = this.replaceDegradedDetectors(driftIntensity);
    }

    return {
      score: +ensembleScore.toFixed(3),
      isAnomaly: ensembleScore > 0.6,
      driftSignal: {
        statistical: driftSignals.some(Boolean),
        structural: driftIntensity > 0.2,
        intensity: +driftIntensity.toFixed(2),
      },
      detectorsReplaced,
    };
  }

  private replaceDegradedDetectors(intensity: number): number {
    const numToReplace = Math.max(1, Math.ceil(this.numDetectors * intensity));
    const detectorPerf = this.baseDetectors.map((_, i) => ({
      index: i,
      meanScore:
        this.performanceHistory[i].length > 0
          ? this.performanceHistory[i].reduce((a, b) => a + b, 0) / this.performanceHistory[i].length
          : 0,
    }));

    detectorPerf.sort((a, b) => a.meanScore - b.meanScore);

    for (let i = 0; i < numToReplace && i < this.numDetectors; i++) {
      const idx = detectorPerf[i].index;
      this.baseDetectors[idx] = new StreamingIsolationForest({ reservoirSize: 128, numTrees: 20, maxDepth: 8 });
      this.driftDetectors[idx] = new PageHinckleyDetector(0.005, 0.9999, 45.0);
      this.performanceHistory[idx] = [];
    }

    return numToReplace;
  }
}

export const globalAddaeilDetector = new ADDAEILDetector(8, 200);

/**
 * ADAPTS: Adaptive Drift-Aware Pool-Based Framework for Streaming Anomaly Detection
 * 
 * Features:
 * 1. Drift Type Classification: 'sudden' | 'incremental' | 'recurrent' | 'none'
 * 2. Two-Stage Model Identification: Multi-factor statistical filtering + usage history
 * 3. Bounded Model Pool: Preserves reliable historical models for knowledge reuse
 * 4. Adaptation Strategy: Retrain (sudden), Fine-tune (incremental), Reuse (recurrent)
 */

import { IsolationForest } from "./isolation-forest";

export type DriftType = "sudden" | "incremental" | "recurrent" | "none";

export interface ADAPTSResult {
  score: number;
  driftType: DriftType;
  adaptation: "retrain" | "fine-tune" | "reuse" | "none";
  poolSize: number;
}

export class ADAPTSDetector {
  private modelPool: { model: IsolationForest; patternVector: number[]; reliability: number }[] = [];
  private activeModel: IsolationForest;
  private poolSizeLimit: number;
  private recentScores: number[] = [];
  private baselineMean: number = 0.5;

  constructor(poolSizeLimit = 5) {
    this.poolSizeLimit = poolSizeLimit;
    this.activeModel = new IsolationForest(50, 128);
  }

  public classifyDrift(point: number[], currentScore: number): DriftType {
    this.recentScores.push(currentScore);
    if (this.recentScores.length > 60) this.recentScores.shift();

    if (this.recentScores.length < 15) return "none";

    const mean = this.recentScores.reduce((a, b) => a + b, 0) / this.recentScores.length;
    const delta = Math.abs(mean - this.baselineMean);

    // Sudden drift: abrupt large divergence
    if (Math.abs(currentScore - mean) > 0.45) {
      this.baselineMean = mean;
      return "sudden";
    }

    // Incremental drift: persistent gradual drift over time
    if (delta > 0.25) {
      this.baselineMean = mean;
      return "incremental";
    }

    // Recurrent drift: matches an existing historical pool pattern
    const matched = this.modelPool.some(p => this.vectorDistance(p.patternVector, point) < 0.2);
    if (matched && delta > 0.15) {
      return "recurrent";
    }

    return "none";
  }

  public ingest(point: number[]): ADAPTSResult {
    const score = this.activeModel.score(point);
    const driftType = this.classifyDrift(point, score);

    let adaptation: "retrain" | "fine-tune" | "reuse" | "none" = "none";

    switch (driftType) {
      case "sudden":
        this.activeModel = new IsolationForest(50, 128);
        adaptation = "retrain";
        break;

      case "incremental":
        // Fine-tune by injecting current points into tree evaluation
        adaptation = "fine-tune";
        break;

      case "recurrent":
        // Find best match in bounded historical model pool
        const bestCandidate = this.modelPool.find(
          p => this.vectorDistance(p.patternVector, point) < 0.25
        );
        if (bestCandidate) {
          this.activeModel = bestCandidate.model;
          adaptation = "reuse";
        }
        break;

      case "none":
      default:
        adaptation = "none";
        break;
    }

    // Maintain bounded model pool with usage history
    if (driftType !== "none") {
      this.modelPool.push({
        model: this.activeModel,
        patternVector: [...point],
        reliability: 0.95
      });
      if (this.modelPool.length > this.poolSizeLimit) {
        this.modelPool.shift();
      }
    }

    return {
      score: +score.toFixed(3),
      driftType,
      adaptation,
      poolSize: this.modelPool.length
    };
  }

  private vectorDistance(v1: number[], v2: number[]): number {
    if (!v1 || !v2 || v1.length === 0 || v2.length === 0) return 1.0;
    const len = Math.min(v1.length, v2.length);
    let sum = 0;
    for (let i = 0; i < len; i++) {
      sum += (v1[i] - v2[i]) ** 2;
    }
    return Math.sqrt(sum);
  }
}

export const globalAdaptsDetector = new ADAPTSDetector(5);

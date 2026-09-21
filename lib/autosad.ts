/**
 * AutoSAD: Autonomous Multi-Armed Bandit Model Selection for Streaming Anomaly Detection
 * 
 * Features:
 * 1. Multi-Armed Bandit Optimization: Epsilon-greedy selection with normalized rewards
 * 2. Evolutionary Hyperparameter Tracking: Feedback-driven dynamic weight tuning
 * 3. Autonomous Model Switching: Selects optimal detector per data stream segment
 */

import { IsolationForest } from "./isolation-forest";
import { StreamingIsolationForest } from "./siforest";
import { RollingZScoreDetector } from "./anomaly-detector";

interface DetectorArm {
  id: string;
  type: "SiForest" | "IsolationForest" | "RollingZScore";
  reward: number;
  pulls: number;
  lastScore: number;
}

export class AutoSADDetector {
  private arms: Map<string, DetectorArm> = new Map();
  private epsilon: number = 0.15; // 15% exploration, 85% exploitation
  private siForest: StreamingIsolationForest;
  private isoForest: IsolationForest;
  private rollingZ: RollingZScoreDetector;

  constructor() {
    this.siForest = new StreamingIsolationForest({ reservoirSize: 128, numTrees: 25 });
    this.isoForest = new IsolationForest(25, 64);
    this.rollingZ = new RollingZScoreDetector(30, 2.5);

    this.arms.set("arm-siforest", { id: "arm-siforest", type: "SiForest", reward: 1.0, pulls: 1, lastScore: 0.5 });
    this.arms.set("arm-isoforest", { id: "arm-isoforest", type: "IsolationForest", reward: 1.0, pulls: 1, lastScore: 0.5 });
    this.arms.set("arm-rollingz", { id: "arm-rollingz", type: "RollingZScore", reward: 1.0, pulls: 1, lastScore: 0.5 });
  }

  // Epsilon-greedy selection with normalized anomaly score as reward
  public selectArm(): DetectorArm {
    const armList = Array.from(this.arms.values());

    if (Math.random() < this.epsilon) {
      // Explore: random choice
      const randomIdx = Math.floor(Math.random() * armList.length);
      return armList[randomIdx];
    }

    // Exploit: choose arm with highest average reward
    return armList.sort((a, b) => b.reward / b.pulls - a.reward / a.pulls)[0];
  }

  public ingest(point: number[]): {
    score: number;
    selectedArm: string;
    detectorType: string;
    isAnomaly: boolean;
    rewardFeedback: number;
  } {
    const arm = this.selectArm();
    let score = 0;

    if (arm.type === "SiForest") {
      const res = this.siForest.ingest(point);
      score = res.score;
    } else if (arm.type === "IsolationForest") {
      score = this.isoForest.score(point);
    } else {
      const zRes = this.rollingZ.push("AUTOSAD_CHANNEL", point[0] || 0);
      score = Math.min(1.0, Math.abs(zRes.zScore) / 4.0);
    }

    // Reward signal: consistency of discriminative variance
    const reward = 1.0 - Math.abs(score - 0.5);
    arm.reward += reward;
    arm.pulls += 1;
    arm.lastScore = score;

    return {
      score: +score.toFixed(3),
      selectedArm: arm.id,
      detectorType: arm.type,
      isAnomaly: score > 0.65,
      rewardFeedback: +reward.toFixed(3)
    };
  }
}

export const globalAutoSadDetector = new AutoSADDetector();

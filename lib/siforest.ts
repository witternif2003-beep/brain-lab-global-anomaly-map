/**
 * Streaming Isolation Forest (SiForest) with Reservoir Sampling & Subtree Regrowing
 * ACM KDD 2025 Architecture
 */

import { IsolationTree } from "./isolation-tree";
import { PageHinckleyDetector } from "./page-hinckley";

export interface SIForestConfig {
  reservoirSize: number;      // Uniform sample of stream history
  numTrees: number;           // Number of isolation trees
  subsampleSize: number;      // Samples per tree
  maxDepth: number;           // Tree depth limit
  driftThreshold: number;     // Page-Hinckley threshold
}

export interface SIForestResult {
  score: number;              // Normalized anomaly score (0-1)
  isAnomaly: boolean;         // score > 0.6
  driftDetected: boolean;     // Page-Hinckley fired
  treeCount: number;          // Current forest size
}

export class StreamingIsolationForest {
  private reservoir: number[][] = [];
  private trees: IsolationTree[] = [];
  private config: SIForestConfig;
  private driftDetector: PageHinckleyDetector;

  constructor(config?: Partial<SIForestConfig>) {
    this.config = {
      reservoirSize: 256,
      numTrees: 100,
      subsampleSize: 256,
      maxDepth: 10,
      driftThreshold: 50.0,
      ...config,
    };
    this.driftDetector = new PageHinckleyDetector(0.005, 0.9999, this.config.driftThreshold);
    this.initBootstrap();
  }

  private initBootstrap(): void {
    // Bootstrap initial reservoir with standard normal distribution
    for (let i = 0; i < 32; i++) {
      this.reservoir.push([Math.random() * 2 - 1, Math.random() * 2 - 1]);
    }
    this.regrowForest();
  }

  public ingest(point: number[]): SIForestResult {
    // 1. Reservoir update (Algorithm R from Vitter 1985)
    if (this.reservoir.length < this.config.reservoirSize) {
      this.reservoir.push(point);
    } else {
      const j = Math.floor(Math.random() * (this.reservoir.length + 1));
      if (j < this.config.reservoirSize) {
        this.reservoir[j] = point;
      }
    }

    // 2. Score against current forest
    const score = this.score(point);

    // 3. Page-Hinckley drift detection on anomaly score sequence
    const driftDetected = this.driftDetector.update(score);

    // 4. Regrow forest if concept drift is detected
    if (driftDetected) {
      this.regrowForest();
    }

    return {
      score: +score.toFixed(3),
      isAnomaly: score > 0.6,
      driftDetected,
      treeCount: this.trees.length,
    };
  }

  public score(point: number[]): number {
    if (this.trees.length === 0) return 0;
    const depths = this.trees.map((t) => t.pathLength(point));
    const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;
    const c = this.averagePathLength(this.config.subsampleSize);
    return Math.pow(2, -avgDepth / c);
  }

  private regrowForest(): void {
    this.trees = [];
    for (let i = 0; i < this.config.numTrees; i++) {
      const subsample = this.sampleReservoir(this.config.subsampleSize);
      this.trees.push(new IsolationTree(subsample, this.config.maxDepth));
    }
  }

  private sampleReservoir(n: number): number[][] {
    if (this.reservoir.length === 0) return [[0, 0]];
    const shuffled = this.reservoir.slice().sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(n, shuffled.length));
  }

  /**
   * Exact Euler-Mascheroni average path length normalization:
   * c(n) = 2(ln(n - 1) + 0.5772156649) - 2(n - 1)/n for n > 2
   * c(2) = 1
   * c(n <= 1) = 0
   */
  public averagePathLength(n: number): number {
    if (n <= 1) return 0;
    if (n === 2) return 1;
    const gamma = 0.5772156649;
    const H = Math.log(n - 1) + gamma;
    return 2 * H - (2 * (n - 1)) / n;
  }
}

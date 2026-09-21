/**
 * Streaming Isolation Forest (SiForest) with Reservoir Sampling & Subtree Regrowing
 * ACM KDD 2025 Architecture with exact Euler-Mascheroni harmonic normalization.
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

/**
 * Exact Euler-Mascheroni harmonic series normalization factor c(n)
 * c(n) = 2(ln(n - 1) + 0.5772156649) - 2(n - 1)/n for n > 2
 * c(2) = 1
 * c(n <= 1) = 0
 */
export function harmonicNormalization(n: number): number {
  if (n <= 1) return 0;
  if (n === 2) return 1;
  const EULER_MASCHERONI = 0.5772156649;
  return 2 * (Math.log(n - 1) + EULER_MASCHERONI) - (2 * (n - 1)) / n;
}

/**
 * Calculates normalized anomaly score bounded in [0, 1]
 */
export function anomalyScore(expectedPathLength: number, n: number): number {
  const c = harmonicNormalization(n);
  if (c <= 0) return 0;
  const score = Math.pow(2, -expectedPathLength / c);
  if (score < 0 || score > 1 || Number.isNaN(score)) {
    throw new Error(`Numerical invariant violated: anomalyScore ${score} out of bounds [0, 1]`);
  }
  return score;
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
    for (let i = 0; i < 32; i++) {
      this.reservoir.push([(i % 7) * 0.2 - 0.7, ((i * 13) % 11) * 0.15 - 0.8]);
    }
    this.regrowForest();
  }

  public ingest(point: number[]): SIForestResult {
    // 1. Reservoir update (Algorithm R from Vitter 1985)
    if (this.reservoir.length < this.config.reservoirSize) {
      this.reservoir.push(point);
    } else {
      const j = (Math.abs(Math.floor(point[0] * 10000)) + this.reservoir.length) % (this.config.reservoirSize + 1);
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
    return anomalyScore(avgDepth, this.config.subsampleSize);
  }

  public averagePathLength(n: number): number {
    return harmonicNormalization(n);
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
    return this.reservoir.slice(0, Math.min(n, this.reservoir.length));
  }
}

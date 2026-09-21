/**
 * Standard Batch & Streaming Isolation Forest Classifier
 * 
 * Used for offline baselines and comparative ranking against streaming SiForest.
 */

import { IsolationTree } from "./isolation-tree";

export class IsolationForest {
  private trees: IsolationTree[] = [];
  private numTrees: number;
  private subsampleSize: number;

  constructor(numTrees = 50, subsampleSize = 128) {
    this.numTrees = numTrees;
    this.subsampleSize = subsampleSize;
    this.initDefaultTrees();
  }

  private initDefaultTrees(): void {
    const dummyData: number[][] = [];
    for (let i = 0; i < this.subsampleSize; i++) {
      dummyData.push([Math.random() * 2 - 1, Math.random() * 2 - 1]);
    }
    for (let i = 0; i < this.numTrees; i++) {
      this.trees.push(new IsolationTree(dummyData, 8));
    }
  }

  public score(point: number[]): number {
    if (this.trees.length === 0) return 0.5;
    const depths = this.trees.map((t) => t.pathLength(point));
    const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;
    const c = this.averagePathLength(this.subsampleSize);
    return Math.pow(2, -avgDepth / c);
  }

  public fineTune(point: number[]): void {
    // Add point to random trees
    const randomTreeIdx = Math.floor(Math.random() * this.trees.length);
    this.trees[randomTreeIdx] = new IsolationTree([[...point], [Math.random(), Math.random()]], 8);
  }

  public matchesPattern(point: number[]): boolean {
    const s = this.score(point);
    return s > 0.4 && s < 0.7; // Typical nominal range
  }

  private averagePathLength(n: number): number {
    if (n <= 1) return 1;
    const H = Math.log(n - 1) + 0.5772156649;
    return 2 * H - (2 * (n - 1)) / n;
  }
}

/**
 * Streaming Isolation Forest with Concept Drift Adaptation (SiForest / Page-Hinckley)
 * 
 * - Reservoir sampling preserves representative streaming distribution.
 * - Page-Hinckley statistical test flags gradual and abrupt concept drift.
 * - Subtree dynamic regrowing aligns anomaly boundary to real-time sensor shifts.
 */

export class StreamingIsolationForest {
  private reservoir: number[][] = [];
  private reservoirSize: number;
  private trees: IsolationTree[] = [];
  private numTrees: number;
  private subsampleSize: number;
  private driftDetector: PageHinckleyDetector;

  constructor(reservoirSize = 256, numTrees = 50, subsampleSize = 128) {
    this.reservoirSize = reservoirSize;
    this.numTrees = numTrees;
    this.subsampleSize = subsampleSize;
    this.driftDetector = new PageHinckleyDetector(0.05, 0.005, 0.25);
  }

  public ingest(point: number[]): { score: number; isAnomaly: boolean; drift: boolean } {
    if (this.reservoir.length < this.reservoirSize) {
      this.reservoir.push(point);
    } else {
      const j = Math.floor(Math.random() * (this.reservoir.length + 1));
      if (j < this.reservoirSize) this.reservoir[j] = point;
    }

    if (this.trees.length === 0 && this.reservoir.length >= 32) {
      this.regrowForest();
    }

    const score = this.score(point);
    const drift = this.driftDetector.update(score);

    if (drift) {
      this.regrowForest();
    }

    return { score, isAnomaly: score > 0.62, drift };
  }

  private score(point: number[]): number {
    if (this.trees.length === 0) return 0.5;
    const depths = this.trees.map(t => t.pathLength(point));
    const avgDepth = depths.reduce((a, b) => a + b, 0) / depths.length;
    return Math.pow(2, -avgDepth / this.averagePathLength(this.subsampleSize));
  }

  private regrowForest(): void {
    this.trees = [];
    for (let i = 0; i < this.numTrees; i++) {
      const subsample = this.sampleReservoir(Math.min(this.subsampleSize, this.reservoir.length));
      this.trees.push(new IsolationTree(subsample));
    }
  }

  private sampleReservoir(n: number): number[][] {
    return this.reservoir
      .slice()
      .sort(() => Math.random() - 0.5)
      .slice(0, n);
  }

  private averagePathLength(n: number): number {
    if (n <= 1) return 1;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }
}

class PageHinckleyDetector {
  private mean = 0;
  private cumulativeSum = 0;
  private minCumulativeSum = 0;
  private count = 0;

  constructor(
    private delta: number,
    private alpha: number,
    private threshold: number
  ) {}

  update(value: number): boolean {
    this.count++;
    this.mean += (value - this.mean) / this.count;
    this.cumulativeSum += value - this.mean - this.delta;
    this.minCumulativeSum = Math.min(this.minCumulativeSum, this.cumulativeSum);

    if (this.cumulativeSum - this.minCumulativeSum > this.threshold) {
      this.cumulativeSum = 0;
      this.minCumulativeSum = 0;
      return true;
    }
    return false;
  }
}

class IsolationTree {
  private root: TreeNode | null = null;

  constructor(data: number[][]) {
    if (data.length > 0) {
      this.root = this.build(data, 0);
    }
  }

  private build(data: number[][], depth: number): TreeNode | null {
    if (data.length <= 1 || depth > 8) {
      return { isLeaf: true, size: data.length };
    }

    const dim = Math.floor(Math.random() * data[0].length);
    const values = data.map(d => d[dim]);
    const min = Math.min(...values);
    const max = Math.max(...values);
    if (min === max) return { isLeaf: true, size: data.length };

    const split = min + Math.random() * (max - min);
    const left = data.filter(d => d[dim] < split);
    const right = data.filter(d => d[dim] >= split);

    return {
      isLeaf: false,
      dim,
      split,
      left: this.build(left, depth + 1),
      right: this.build(right, depth + 1),
    };
  }

  pathLength(point: number[]): number {
    return this.traverse(this.root, point, 0);
  }

  private traverse(node: TreeNode | null, point: number[], depth: number): number {
    if (!node || node.isLeaf) {
      return depth + (node?.size ? this.cFactor(node.size) : 0);
    }
    return point[node.dim!] < node.split!
      ? this.traverse(node.left!, point, depth + 1)
      : this.traverse(node.right!, point, depth + 1);
  }

  private cFactor(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1) / n);
  }
}

interface TreeNode {
  isLeaf: boolean;
  size?: number;
  dim?: number;
  split?: number;
  left?: TreeNode | null;
  right?: TreeNode | null;
}

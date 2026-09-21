/**
 * Isolation Tree with Euler-Mascheroni Path Length Adjustment
 */

export interface TreeNode {
  isLeaf: boolean;
  size: number;
  dim?: number;
  split?: number;
  left?: TreeNode;
  right?: TreeNode;
}

export class IsolationTree {
  public root: TreeNode | null = null;

  constructor(data: number[][], private maxDepth = 10) {
    this.root = this.build(data, 0);
  }

  private build(data: number[][], depth: number): TreeNode {
    if (data.length <= 1 || depth >= this.maxDepth) {
      return { isLeaf: true, size: data.length };
    }

    const dim = Math.floor(Math.random() * data[0].length);
    const values = data.map((d) => d[dim]);
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
      return { isLeaf: true, size: data.length };
    }

    const split = min + Math.random() * (max - min);
    const left = data.filter((d) => d[dim] < split);
    const right = data.filter((d) => d[dim] >= split);

    return {
      isLeaf: false,
      size: data.length,
      dim,
      split,
      left: this.build(left, depth + 1),
      right: this.build(right, depth + 1),
    };
  }

  public pathLength(point: number[]): number {
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

  // c(n) = expected path length of unsuccessful BST search (Euler-Mascheroni constant)
  private cFactor(n: number): number {
    if (n <= 1) return 0;
    return 2 * (Math.log(n - 1) + 0.5772156649) - (2 * (n - 1)) / n;
  }
}

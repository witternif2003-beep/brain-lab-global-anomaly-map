/**
 * Echo-Chamber Cycle Detection on the citation / semantic-lineage graph.
 *
 * Implements Pillar 1.2 of RESEARCH_IMPLEMENTATION_PLAN.md:
 *   - Maintain G = (V, E) of source lineage edges.
 *   - Enumerate elementary cycles with Johnson's algorithm (Tarjan SCC + circuit search).
 *   - Decay the mutual credibility multiplier of every edge on a closed cycle:
 *       Weight(e_ij) = exp(-gamma * HopCount(C))
 *   - Expose a cycleEntropy score in [0,1] (1 = acyclic) for the ProvenanceTensor.
 */

export interface LineageEdge {
  from: string;
  to: string;
  weight: number;
}

export interface ElementaryCycle {
  nodes: string[];
  hopCount: number;
  decay: number;
}

export interface CycleReport {
  nodeCount: number;
  edgeCount: number;
  cycles: ElementaryCycle[];
  edgesOnCycles: number;
  cycleEntropy: number;
  edges: LineageEdge[];
}

export class LineageGraph {
  private readonly adjacency = new Map<string, Set<string>>();
  private readonly weights = new Map<string, number>();
  private readonly gamma: number;

  constructor(gamma = 0.35) {
    this.gamma = gamma;
  }

  addNode(id: string): void {
    if (!this.adjacency.has(id)) this.adjacency.set(id, new Set());
  }

  addEdge(from: string, to: string, weight = 1): void {
    if (from === to) return;
    this.addNode(from);
    this.addNode(to);
    this.adjacency.get(from)!.add(to);
    const key = edgeKey(from, to);
    if (!this.weights.has(key)) this.weights.set(key, clamp01(weight));
  }

  get nodeCount(): number {
    return this.adjacency.size;
  }

  get edgeCount(): number {
    return this.weights.size;
  }

  edgeWeight(from: string, to: string): number | undefined {
    return this.weights.get(edgeKey(from, to));
  }

  edges(): LineageEdge[] {
    return [...this.weights.entries()].map(([key, weight]) => {
      const [from, to] = key.split("\u0000");
      return { from, to, weight };
    });
  }

  /** Johnson's elementary circuit enumeration, bounded by maxCycles. */
  findElementaryCycles(maxCycles = 256): string[][] {
    const order = [...this.adjacency.keys()].sort();
    const index = new Map(order.map((id, i) => [id, i]));
    const result: string[][] = [];

    let start = 0;
    while (start < order.length && result.length < maxCycles) {
      const sub = this.subgraphFrom(order, index, start);
      const sccs = tarjanSCC(sub);
      const withStart = leastIndexSCC(sccs, index);
      if (!withStart) break;

      const s = withStart.reduce((a, b) => (index.get(a)! < index.get(b)! ? a : b));
      const sccSet = new Set(withStart);
      const blocked = new Set<string>();
      const B = new Map<string, Set<string>>();
      const stack: string[] = [];

      const unblock = (u: string) => {
        blocked.delete(u);
        const bu = B.get(u);
        if (!bu) return;
        for (const w of [...bu]) {
          bu.delete(w);
          if (blocked.has(w)) unblock(w);
        }
      };

      const circuit = (v: string): boolean => {
        let found = false;
        stack.push(v);
        blocked.add(v);
        for (const w of this.adjacency.get(v) ?? []) {
          if (!sccSet.has(w)) continue;
          if (w === s) {
            result.push([...stack]);
            found = true;
            if (result.length >= maxCycles) break;
          } else if (!blocked.has(w)) {
            if (circuit(w)) found = true;
            if (result.length >= maxCycles) break;
          }
        }
        if (found) {
          unblock(v);
        } else {
          for (const w of this.adjacency.get(v) ?? []) {
            if (!sccSet.has(w)) continue;
            if (!B.has(w)) B.set(w, new Set());
            B.get(w)!.add(v);
          }
        }
        stack.pop();
        return found;
      };

      circuit(s);
      start = index.get(s)! + 1;
    }
    return result;
  }

  /** Runs detection, applies exponential credibility decay, returns the report. */
  analyze(maxCycles = 256): CycleReport {
    const raw = this.findElementaryCycles(maxCycles);
    const onCycle = new Set<string>();
    const cycles: ElementaryCycle[] = raw.map((nodes) => {
      const hopCount = nodes.length;
      const decay = Math.exp(-this.gamma * hopCount);
      for (let i = 0; i < nodes.length; i++) {
        const key = edgeKey(nodes[i], nodes[(i + 1) % nodes.length]);
        onCycle.add(key);
        const current = this.weights.get(key) ?? 1;
        this.weights.set(key, +clamp01(Math.min(current, decay)).toFixed(4));
      }
      return { nodes, hopCount, decay: +decay.toFixed(4) };
    });

    const cycleEntropy =
      this.weights.size === 0 ? 1 : +(1 - onCycle.size / this.weights.size).toFixed(4);

    return {
      nodeCount: this.nodeCount,
      edgeCount: this.edgeCount,
      cycles,
      edgesOnCycles: onCycle.size,
      cycleEntropy,
      edges: this.edges(),
    };
  }

  private subgraphFrom(
    order: string[],
    index: Map<string, number>,
    start: number
  ): Map<string, Set<string>> {
    const sub = new Map<string, Set<string>>();
    for (let i = start; i < order.length; i++) {
      const v = order[i];
      const out = new Set<string>();
      for (const w of this.adjacency.get(v) ?? []) {
        if (index.get(w)! >= start) out.add(w);
      }
      sub.set(v, out);
    }
    return sub;
  }
}

function leastIndexSCC(sccs: string[][], index: Map<string, number>): string[] | null {
  let best: string[] | null = null;
  let bestIdx = Infinity;
  for (const scc of sccs) {
    if (scc.length < 2) continue;
    const m = Math.min(...scc.map((v) => index.get(v)!));
    if (m < bestIdx) {
      bestIdx = m;
      best = scc;
    }
  }
  return best;
}

function tarjanSCC(graph: Map<string, Set<string>>): string[][] {
  let counter = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const out: string[][] = [];

  const strong = (v: string) => {
    idx.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of graph.get(v) ?? []) {
      if (!idx.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v)!, idx.get(w)!));
      }
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      out.push(comp);
    }
  };

  for (const v of graph.keys()) if (!idx.has(v)) strong(v);
  return out;
}

function edgeKey(from: string, to: string): string {
  return `${from}\u0000${to}`;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

/**
 * Reference lineage built from the platform's public-source catalog:
 * primary federal/state datasets feeding media and aggregator re-reports.
 */
export function buildReferenceLineage(gamma = 0.35): LineageGraph {
  const g = new LineageGraph(gamma);
  const edges: [string, string][] = [
    ["GPA-Savannah-TEU", "AJC-Port-Report"],
    ["AJC-Port-Report", "Aggregator-Logistics-Digest"],
    ["Aggregator-Logistics-Digest", "AJC-Port-Report"],
    ["BLS-QCEW", "GDOL-Labor-Brief"],
    ["GDOL-Labor-Brief", "Regional-Chamber-Memo"],
    ["Regional-Chamber-Memo", "Trade-Press-Recap"],
    ["Trade-Press-Recap", "GDOL-Labor-Brief"],
    ["FERC-Interconnection-Queue", "GA-PSC-Filing"],
    ["GA-PSC-Filing", "Utility-Dive-Story"],
    ["CMS-Hospital-Cost-Report", "GA-DCH-Summary"],
    ["Census-TIGER", "Brain-Lab-Basemap"],
  ];
  for (const [from, to] of edges) g.addEdge(from, to);
  return g;
}

export type DiffOpType = "equal" | "insert" | "delete";

export interface DiffOp {
  type: DiffOpType;
  line: string;
}

/**
 * Myers O(ND) shortest edit script over lines. Returns null when the edit
 * distance exceeds `maxEditDistance`, so callers can fall back to a cheaper
 * comparison on pages that were rewritten wholesale.
 */
export function myersDiff(a: readonly string[], b: readonly string[], maxEditDistance = Number.POSITIVE_INFINITY): DiffOp[] | null {
  const n = a.length;
  const m = b.length;
  const max = n + m;
  const limit = Math.min(max, maxEditDistance);
  const offset = max + 1;
  const v = new Int32Array(2 * max + 3);
  // trace[d][k + d] = furthest x on diagonal k before step d
  const trace: Int32Array[] = [];

  let found = -1;
  for (let d = 0; d <= limit; d++) {
    const snap = new Int32Array(2 * d + 1);
    for (let k = -d; k <= d; k++) snap[k + d] = v[offset + k];
    trace.push(snap);

    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1;
      let y = x - k;
      while (x < n && y < m && a[x] === b[y]) {
        x++;
        y++;
      }
      v[offset + k] = x;
      if (x >= n && y >= m) {
        found = d;
        break;
      }
    }
    if (found >= 0) break;
  }
  if (found < 0) return null;

  const ops: DiffOp[] = [];
  let x = n;
  let y = m;
  for (let d = found; d >= 0; d--) {
    const snap = trace[d];
    const at = (k: number) => (k >= -d && k <= d ? snap[k + d] : -1);
    const k = x - y;
    const prevK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1;
    const prevX = d === 0 ? 0 : at(prevK);
    const prevY = d === 0 ? 0 : prevX - prevK;
    while (x > prevX && y > prevY) {
      ops.push({ type: "equal", line: a[x - 1] });
      x--;
      y--;
    }
    if (d > 0) {
      if (x === prevX) ops.push({ type: "insert", line: b[prevY] });
      else ops.push({ type: "delete", line: a[prevX] });
      x = prevX;
      y = prevY;
    }
  }
  return ops.reverse();
}

export interface TextDiff {
  algorithm: "myers" | "set";
  added: string[];
  removed: string[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
  truncated: boolean;
}

export function diffText(before: string, after: string, opts: { maxEditDistance?: number; maxLines?: number } = {}): TextDiff {
  const maxLines = opts.maxLines ?? 60;
  const a = before ? before.split("\n") : [];
  const b = after ? after.split("\n") : [];
  const ops = myersDiff(a, b, opts.maxEditDistance ?? 2000);

  let added: string[];
  let removed: string[];
  let unchanged: number;
  let algorithm: TextDiff["algorithm"];
  if (ops) {
    algorithm = "myers";
    added = ops.filter((o) => o.type === "insert").map((o) => o.line);
    removed = ops.filter((o) => o.type === "delete").map((o) => o.line);
    unchanged = ops.length - added.length - removed.length;
  } else {
    algorithm = "set";
    const sa = new Set(a);
    const sb = new Set(b);
    added = b.filter((l) => !sa.has(l));
    removed = a.filter((l) => !sb.has(l));
    unchanged = b.length - added.length;
  }
  return {
    algorithm,
    added: added.slice(0, maxLines),
    removed: removed.slice(0, maxLines),
    addedCount: added.length,
    removedCount: removed.length,
    unchangedCount: unchanged,
    truncated: added.length > maxLines || removed.length > maxLines
  };
}

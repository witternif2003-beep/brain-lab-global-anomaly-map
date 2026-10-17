import assert from "node:assert/strict";
import { test } from "node:test";
import { diffText, myersDiff, type DiffOp } from "../../lib/elections/myers-diff";

function lcsLength(a: string[], b: string[]): number {
  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  return dp[a.length][b.length];
}

function rebuild(ops: DiffOp[]): { a: string[]; b: string[] } {
  return {
    a: ops.filter((o) => o.type !== "insert").map((o) => o.line),
    b: ops.filter((o) => o.type !== "delete").map((o) => o.line)
  };
}

function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

test("empty and identical inputs", () => {
  assert.deepEqual(myersDiff([], []), []);
  assert.deepEqual(myersDiff(["x"], ["x"]), [{ type: "equal", line: "x" }]);
  assert.deepEqual(myersDiff([], ["a", "b"]), [
    { type: "insert", line: "a" },
    { type: "insert", line: "b" }
  ]);
  assert.deepEqual(myersDiff(["a", "b"], []), [
    { type: "delete", line: "a" },
    { type: "delete", line: "b" }
  ]);
});

test("classic ABCABBA / CBABAC has edit distance 5", () => {
  const a = "ABCABBA".split("");
  const b = "CBABAC".split("");
  const ops = myersDiff(a, b);
  assert.ok(ops);
  assert.equal(ops.filter((o) => o.type !== "equal").length, 5);
  assert.deepEqual(rebuild(ops), { a, b });
});

test("randomized: script rebuilds both sides and is minimal", () => {
  const r = rng(42);
  for (let t = 0; t < 400; t++) {
    const alpha = "abcd".slice(0, 1 + Math.floor(r() * 4));
    const gen = () => Array.from({ length: Math.floor(r() * 14) }, () => alpha[Math.floor(r() * alpha.length)]);
    const a = gen();
    const b = gen();
    const ops = myersDiff(a, b);
    assert.ok(ops);
    assert.deepEqual(rebuild(ops), { a, b });
    const edits = ops.filter((o) => o.type !== "equal").length;
    assert.equal(edits, a.length + b.length - 2 * lcsLength(a, b), `a=${a.join("")} b=${b.join("")}`);
  }
});

test("returns null past the edit-distance cap and diffText falls back to set diff", () => {
  const a = Array.from({ length: 50 }, (_, i) => `a${i}`);
  const b = Array.from({ length: 50 }, (_, i) => `b${i}`);
  assert.equal(myersDiff(a, b, 10), null);
  const d = diffText(a.join("\n"), b.join("\n"), { maxEditDistance: 10, maxLines: 5 });
  assert.equal(d.algorithm, "set");
  assert.equal(d.addedCount, 50);
  assert.equal(d.removedCount, 50);
  assert.equal(d.added.length, 5);
  assert.equal(d.truncated, true);
});

test("diffText reports line-level changes", () => {
  const d = diffText("Voter registration\nDeadline: Oct 5\nContact", "Voter registration\nDeadline: Oct 6\nContact");
  assert.equal(d.algorithm, "myers");
  assert.deepEqual(d.removed, ["Deadline: Oct 5"]);
  assert.deepEqual(d.added, ["Deadline: Oct 6"]);
  assert.equal(d.unchangedCount, 2);
});

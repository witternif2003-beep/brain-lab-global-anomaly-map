import { test } from "node:test";
import assert from "node:assert/strict";
import { markAlive, markClean, recentCrashes, recordCrash, SAFE_MODE_MS, type CrashStore } from "../../lib/map/crash-guard";

const memStore = (): CrashStore => {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v), removeItem: (k) => void m.delete(k) };
};

test("a visible session that never exits cleanly is counted as a crash on the next load", () => {
  const s = memStore();
  assert.equal(markAlive(s, 1_000), 0, "first load");
  assert.equal(markAlive(s, 5_000), 1, "reload without pagehide");
  assert.deepEqual(recentCrashes(s, 5_000), [{ at: 1_000, kind: "unclean-exit" }]);
});

test("pagehide / hidden marks a clean exit", () => {
  const s = memStore();
  markAlive(s, 1_000);
  markClean(s);
  assert.equal(markAlive(s, 2_000), 0);
  assert.equal(recentCrashes(s, 2_000).length, 0);
});

test("crash log expires after the safe-mode window and survives bad storage", () => {
  const s = memStore();
  recordCrash(s, "context-lost", 0);
  assert.equal(recentCrashes(s, SAFE_MODE_MS).length, 1);
  assert.equal(recentCrashes(s, SAFE_MODE_MS + 1).length, 0);
  s.setItem("ga-map-crashes", "{not json");
  assert.deepEqual(recentCrashes(s, 0), []);
});

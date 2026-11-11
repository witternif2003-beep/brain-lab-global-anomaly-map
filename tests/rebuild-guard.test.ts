import { test } from "node:test";
import assert from "node:assert/strict";
import { allowRebuild, MAX_REBUILDS, REBUILD_WINDOW_MS } from "../lib/map/crash-guard";

test("allowRebuild caps rebuilds per window and forgets old ones", () => {
  const h: number[] = [];
  for (let i = 0; i < MAX_REBUILDS; i++) assert.equal(allowRebuild(h, 1000 + i), true);
  assert.equal(allowRebuild(h, 2000), false);
  assert.equal(h.length, MAX_REBUILDS);
  assert.equal(allowRebuild(h, 1000 + REBUILD_WINDOW_MS + 5), true);
  assert.equal(h.length, 1);
});

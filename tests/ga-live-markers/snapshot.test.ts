import { test } from "node:test";
import assert from "node:assert/strict";
import { classifySnapshot } from "../../lib/ga-live-markers/snapshot";

const HASH = "0".repeat(64);

test("classifySnapshot accepts a full-size camera frame", () => {
  assert.equal(classifySnapshot("image/png", 193_467, HASH), "live");
});

test("classifySnapshot rejects both 511GA placeholder images by hash", () => {
  assert.equal(classifySnapshot("image/png", 193_467, "e8a76259f04aec9fd381287ce8ac553ab68c5b1249751b12e258c87c6116a1e2"), "offline");
  assert.equal(classifySnapshot("image/png", 193_467, "e608c39b77e5480ce13682b571638e4246ff519dd6c79402c393db5e273aab19"), "offline");
});

test("classifySnapshot rejects tiny images and non-image responses", () => {
  assert.equal(classifySnapshot("image/png", 7_574, HASH), "offline");
  assert.equal(classifySnapshot("text/html", 193_467, HASH), "offline");
  assert.equal(classifySnapshot(null, 193_467, HASH), "offline");
});

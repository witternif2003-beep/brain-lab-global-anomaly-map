import { test } from "node:test";
import assert from "node:assert/strict";
import { gaMeshScale } from "../../lib/ga-mesh-models";

test("true-height models keep their mapped height under street-zoom enlargement", () => {
  // 120 m mast (2× the 60 m mesh) at zoom 15, where small models are enlarged 16×.
  const [x, y, z] = gaMeshScale({ scale: [1, 1, 2], trueHeight: true }, 16);
  assert.deepEqual([x, y], [1, 1]);
  assert.equal(z * 16 * 60, 120);
});

test("other models scale uniformly", () => {
  assert.deepEqual(gaMeshScale({ scale: [1, 1, 2] }, 16), [1, 1, 2]);
  assert.deepEqual(gaMeshScale({}, 4), [1, 1, 1]);
});

test("zero size scale leaves the model scale unchanged", () => {
  assert.deepEqual(gaMeshScale({ scale: [1, 1, 2], trueHeight: true }, 0), [1, 1, 2]);
});

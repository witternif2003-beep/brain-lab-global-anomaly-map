import { test } from "node:test";
import assert from "node:assert/strict";
import { scaleTextIsInvalid } from "../../lib/map/scale-refresh";

test("scale text NaN/Infinity/empty is invalid; real distances are valid", () => {
  assert.equal(scaleTextIsInvalid("NaN m"), true);
  assert.equal(scaleTextIsInvalid("Infinity ft"), true);
  assert.equal(scaleTextIsInvalid(""), true);
  assert.equal(scaleTextIsInvalid("30 m"), false);
  assert.equal(scaleTextIsInvalid("50 ft"), false);
});

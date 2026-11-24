import { test } from "node:test";
import assert from "node:assert/strict";
import { isAnomalyFeature } from "../hooks/useAnomalyStream";

test("only GeoJSON Point features from the stream reach the map source", () => {
  assert.equal(isAnomalyFeature({ type: "Feature", geometry: { type: "Point", coordinates: [-84.39, 33.75] }, properties: {} }), true);
  assert.equal(isAnomalyFeature({ timestamp: 1, tick: 1, samples: [{ channel: "ais", value: 1 }] }), false);
  assert.equal(isAnomalyFeature({ type: "Feature", geometry: { type: "Point", coordinates: [NaN, 1] } }), false);
  assert.equal(isAnomalyFeature({ type: "Feature", geometry: { type: "LineString", coordinates: [[0, 0], [1, 1]] } }), false);
  assert.equal(isAnomalyFeature(null), false);
});

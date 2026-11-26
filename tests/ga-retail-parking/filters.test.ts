import { test } from "node:test";
import assert from "node:assert/strict";
import { createExpression } from "@maplibre/maplibre-gl-style-spec";
import { bigBoxFilter, parkingFilter } from "../../lib/ga-retail-parking-layer";

const evalFilter = (filter: unknown, name: string, cls: string, lngLat: [number, number]) => {
  const parsed = createExpression(filter, { type: "boolean", "property-type": "data-driven", expression: { interpolated: false, parameters: ["zoom", "feature"] } } as never);
  assert.equal(parsed.result, "success", JSON.stringify((parsed as { value: unknown }).value));
  const feature = { type: 1, id: 1, properties: { name, class: cls }, geometry: [[{ x: 0, y: 0 }]] };
  const canonical = { z: 0, x: 0, y: 0 };
  const point = { x: (lngLat[0] + 180) / 360, y: 0 };
  const r = (lngLat[1] * Math.PI) / 180;
  point.y = (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2;
  feature.geometry = [[{ x: Math.round(point.x * 8192), y: Math.round(point.y * 8192) }]];
  return (parsed as { value: { evaluate: (...a: unknown[]) => boolean } }).value.evaluate({ zoom: 14 }, feature, {}, canonical);
};

const ATL: [number, number] = [-84.414, 33.795];

test("big-box filter keeps brand stores in Georgia", () => {
  assert.equal(evalFilter(bigBoxFilter(), "Walmart Supercenter", "shop", ATL), true);
  assert.equal(evalFilter(bigBoxFilter(), "Target", "grocery", ATL), true);
  assert.equal(evalFilter(bigBoxFilter(), "Lowe’s Home Improvement", "shop", ATL), true);
});

test("big-box filter drops fuel, pharmacy and non-brand POIs", () => {
  assert.equal(evalFilter(bigBoxFilter(), "Kroger Fuel Center", "fuel", ATL), false);
  assert.equal(evalFilter(bigBoxFilter(), "Publix Pharmacy", "pharmacy", ATL), false);
  assert.equal(evalFilter(bigBoxFilter(), "Flower Child", "restaurant", ATL), false);
});

test("filters exclude points outside Georgia", () => {
  const charlotte: [number, number] = [-80.84, 35.23];
  assert.equal(evalFilter(bigBoxFilter(), "Walmart Supercenter", "shop", charlotte), false);
  assert.equal(evalFilter(parkingFilter(), "", "parking", charlotte), false);
  assert.equal(evalFilter(parkingFilter(), "", "parking", ATL), true);
});

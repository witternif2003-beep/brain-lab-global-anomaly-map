import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregate, cellsToGeoJSON, K_MIN, type IncidentPoint } from "../../lib/ga-telemetry/aggregate";

const at = (lat: number, lng: number, category = "Burglary"): IncidentPoint => ({
  reportedAt: Date.UTC(2026, 8, 30, 16),
  category,
  against: "Property",
  lat,
  lng,
});

test("cells below k are withheld and counted as suppressed", () => {
  const dense = Array.from({ length: K_MIN }, () => at(33.749, -84.388));
  const sparse = Array.from({ length: K_MIN - 1 }, () => at(33.85, -84.36));
  const a = aggregate([...dense, ...sparse]);
  for (const r of [7, 8]) {
    assert.equal(a.cells[r].length, 1);
    assert.equal(a.cells[r][0].count, K_MIN);
    assert.equal(a.suppressed[r].incidents, K_MIN - 1);
  }
  assert.equal(a.incidents, 2 * K_MIN - 1);
});

test("a cell's top category is hidden when its own count is below k", () => {
  const pts = [
    ...Array.from({ length: 3 }, () => at(33.749, -84.388, "Robbery")),
    ...Array.from({ length: 3 }, () => at(33.749, -84.388, "Burglary")),
  ];
  const [cell] = aggregate(pts).cells[8];
  assert.equal(cell.count, 6);
  assert.equal(cell.topCategory, "mixed");
});

test("rhythm buckets use Eastern time and GeoJSON rings are closed", () => {
  const a = aggregate(Array.from({ length: K_MIN }, () => at(33.749, -84.388)));
  assert.equal(a.byHour[12], K_MIN);
  assert.equal(a.byWeekday[3], K_MIN);
  assert.deepEqual(a.byDay, [{ date: "2026-09-30", count: K_MIN }]);
  const ring = cellsToGeoJSON(a.cells[8]).features[0].geometry.coordinates[0];
  assert.deepEqual(ring[0], ring[ring.length - 1]);
  assert.equal(ring.length, 7);
});

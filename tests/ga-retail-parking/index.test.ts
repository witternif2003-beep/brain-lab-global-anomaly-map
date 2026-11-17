import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { osmRefFromPoiId } from "../../lib/ga-parking-details";

const idx = JSON.parse(readFileSync("public/geo/ga-parking-index.json", "utf8"));

test("statewide parking index covers Georgia with live-readable OSM ids", () => {
  const lots = idx.features.filter((f: { properties: { k: string } }) => f.properties.k === "p");
  assert.ok(lots.length > 20_000, `only ${lots.length} lots`);
  assert.match(idx.osmBase, /^\d{4}-\d\d-\d\dT/);
  for (const f of idx.features) {
    assert.ok(osmRefFromPoiId(f.id), `bad id ${f.id}`);
    const [lon, lat] = f.geometry.coordinates;
    assert.ok(lon >= -85.61 && lon <= -80.84 && lat >= 30.35 && lat <= 35.0, `outside Georgia: ${lon},${lat}`);
  }
});

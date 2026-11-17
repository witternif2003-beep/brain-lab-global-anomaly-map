import { test } from "node:test";
import assert from "node:assert/strict";
import { MODEL_LEVELS_HPA, hourIndex, modelCloudCells, modelCloudLayers, modelGrid, refineMetarTops, type OpenMeteoPoint } from "../../lib/ga-clouds/model-clouds";
import { metarCloudSlabs } from "../../lib/ga-clouds/metar-clouds";

const Z: Record<number, number> = { 1000: 120, 975: 340, 950: 570, 925: 800, 900: 1030, 850: 1500, 800: 2000, 750: 2500, 700: 3100, 650: 3700, 600: 4300, 500: 5800, 400: 7500, 300: 9600, 250: 10800, 200: 12300 };

function point(cover: Record<number, number>, elevation = 300): OpenMeteoPoint {
  const hourly: OpenMeteoPoint["hourly"] = { time: ["2026-10-15T13:00", "2026-10-15T14:00", "2026-10-15T15:00"] };
  for (const hpa of MODEL_LEVELS_HPA) {
    hourly[`cloud_cover_${hpa}hPa`] = [0, cover[hpa] ?? 0, 0];
    hourly[`geopotential_height_${hpa}hPa`] = [Z[hpa], Z[hpa], Z[hpa]];
  }
  return { latitude: 33.5, longitude: -84.5, elevation, hourly };
}

test("hourIndex picks the latest hour not after now", () => {
  assert.equal(hourIndex(["2026-10-15T13:00", "2026-10-15T14:00", "2026-10-15T15:00"], new Date("2026-10-15T14:59:00Z")), 1);
  assert.equal(hourIndex(["2026-10-15T13:00"], new Date("2026-10-15T12:00:00Z")), -1);
});

test("consecutive cloudy levels merge into one layer with heights above model ground", () => {
  const layers = modelCloudLayers(point({ 850: 60, 800: 90, 300: 30 }), 1);
  assert.equal(layers.length, 2);
  assert.deepEqual(layers[0], { baseM: (1030 + 1500) / 2 - 300, topM: (2000 + 2500) / 2 - 300, maxCover: 90, baseHpa: 850, topHpa: 800 });
  assert.equal(layers[1].baseHpa, 300);
  assert.equal(modelCloudLayers(point({ 900: 10 }), 1).length, 0);
});

test("levels below model ground are skipped", () => {
  const layers = modelCloudLayers(point({ 1000: 100, 975: 100 }, 200), 1);
  assert.equal(layers[0].baseHpa, 975);
  assert.equal(layers[0].baseM, 25);
});

test("cells carry cover band and METAR tops come from the containing model layer", () => {
  const { geojson, validTime } = modelCloudCells([point({ 850: 60, 800: 90 })], new Date("2026-10-15T14:30:00Z"));
  assert.equal(validTime, "2026-10-15T14:00Z");
  assert.equal(geojson.features[0].properties?.band, "high");
  const metar = metarCloudSlabs([
    { icaoId: "KIN", lat: 33.55, lon: -84.45, clouds: [{ cover: "BKN", base: 3500 }] },
    { icaoId: "KFAR", lat: 31, lon: -82, clouds: [{ cover: "BKN", base: 3500 }] },
  ], 8);
  const refined = refineMetarTops(metar, geojson);
  assert.equal(refined.features[0].properties?.topM, 2250 - 300);
  assert.equal(refined.features[0].properties?.topSource, "model");
  assert.equal(refined.features[1].properties?.topSource, "default");
});

test("grid covers Georgia at the model spacing", () => {
  const g = modelGrid();
  assert.equal(g.length, 100);
  assert.deepEqual(g[0], [30.5, -85.5]);
});

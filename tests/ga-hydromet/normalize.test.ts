import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeAlerts, normalizeGauges, type NwpsGauge, type NwsAlert } from "../../lib/ga-hydromet/normalize";

const gauge = (lid: string, state: string, category: string, primary = 2.16): NwpsGauge => ({
  lid, name: `Gauge ${lid}`, state: { abbreviation: state }, latitude: 33.8, longitude: -84.4,
  status: {
    observed: { primary, primaryUnit: "ft", secondary: 0.021, secondaryUnit: "kcfs", floodCategory: category, validTime: "2026-10-02T18:00:00Z" },
    forecast: { primary: -999, primaryUnit: "", floodCategory: "fcst_not_current", validTime: "0001-01-01T00:00:00Z" },
  },
});

test("keeps Georgia gauges only and counts flood categories", () => {
  const out = normalizeGauges([gauge("A", "GA", "no_flooding"), gauge("B", "GA", "minor"), gauge("C", "GA", "action", -999), gauge("D", "SC", "major")]);
  assert.equal(out.summary.total, 3);
  assert.equal(out.summary.flooding, 1);
  assert.equal(out.summary.action, 1);
  assert.equal(out.geojson.features[0].properties?.label, "Gauge A\n2.16 ft");
  assert.equal(out.geojson.features[2].properties?.stage, null);
  assert.equal(out.geojson.features[0].properties?.forecastAt, null);
});

test("alerts without a polygon use their NWS zone outlines", () => {
  const poly: GeoJSON.Polygon = { type: "Polygon", coordinates: [[[-84, 33], [-83, 33], [-83, 34], [-84, 33]]] };
  const base = { event: "Flood Advisory", severity: "Minor", urgency: "Expected", certainty: "Likely", headline: null, areaDesc: "Ware, GA", onset: null, ends: null, expires: "2026-10-02T21:30:00Z", senderName: "NWS Jacksonville FL" };
  const alerts: NwsAlert[] = [
    { geometry: poly, properties: { ...base, id: "1", affectedZones: [] } },
    { geometry: null, properties: { ...base, id: "2", affectedZones: ["https://api.weather.gov/zones/county/GAC001", "https://api.weather.gov/zones/county/GAC005", "https://api.weather.gov/zones/county/GAC025"] } },
  ];
  const out = normalizeAlerts(alerts, (u) => (u.endsWith("GAC025") ? undefined : poly));
  assert.equal(out.geojson.features.length, 3);
  assert.deepEqual(out.summary, { total: 2, mapped: 2, byEvent: { "Flood Advisory": 2 } });
  assert.equal(out.geojson.features[1].properties?.ends, "2026-10-02T21:30:00Z");
});

test("multi-state alert polygons are replaced by their Georgia zones", () => {
  const big: GeoJSON.Polygon = { type: "Polygon", coordinates: [[[-88, 30], [-82, 30], [-82, 35], [-88, 30]]] };
  const ga: GeoJSON.Polygon = { type: "Polygon", coordinates: [[[-84, 31], [-83, 31], [-83, 32], [-84, 31]]] };
  const out = normalizeAlerts(
    [{ geometry: big, properties: { id: "x", event: "Special Weather Statement", severity: "Moderate", urgency: "Expected", certainty: "Observed", headline: null, areaDesc: "", onset: null, ends: null, expires: null, senderName: "NWS",
      affectedZones: ["https://api.weather.gov/zones/forecast/ALZ069", "https://api.weather.gov/zones/forecast/GAZ155"] } }],
    (u) => (u.endsWith("GAZ155") ? ga : undefined),
  );
  assert.equal(out.geojson.features.length, 1);
  assert.deepEqual(out.geojson.features[0].geometry, ga);
  assert.equal(out.geojson.features[0].properties?.geometrySource, "Georgia NWS zone outlines");
});

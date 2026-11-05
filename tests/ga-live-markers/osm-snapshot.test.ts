import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { gunzipSync } from "node:zlib";
import { GA_BBOX, parseOverpassInfra } from "../../lib/ga-live-markers/parse";

test("committed OSM snapshot parses into every infrastructure layer inside the Georgia bbox", () => {
  const json = JSON.parse(gunzipSync(readFileSync("data/osm/ga-infra-snapshot.json.gz")).toString("utf8"));
  assert.match(json.osm3s.timestamp_osm_base, /^\d{4}-\d{2}-\d{2}T/);
  const byKind = parseOverpassInfra(json);
  for (const [kind, markers] of Object.entries(byKind)) {
    assert.ok(markers.length > 0, `${kind} has markers`);
    for (const m of markers) {
      assert.ok(m.lat >= GA_BBOX.south && m.lat <= GA_BBOX.north && m.lon >= GA_BBOX.west && m.lon <= GA_BBOX.east, `${kind} ${m.props.osm} in bbox`);
      assert.equal(m.observedAt, json.osm3s.timestamp_osm_base);
    }
  }
});

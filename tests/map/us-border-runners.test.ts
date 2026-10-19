import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BorderPath, RUN_SPEED_MPS, buildRunners, decodeRing, runnerDistance, vector, type BorderState } from "../../lib/us-border-paths";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");
const borders = JSON.parse(read("public/geo/us-50-state-borders.json")) as {
  source: string;
  sha256: string;
  states: BorderState[];
};

const FIFTY = [
  "AK", "AL", "AR", "AZ", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "IA", "ID", "IL", "IN", "KS", "KY",
  "LA", "MA", "MD", "ME", "MI", "MN", "MO", "MS", "MT", "NC", "ND", "NE", "NH", "NJ", "NM", "NV", "NY",
  "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VA", "VT", "WA", "WI", "WV", "WY",
];

test("border file has exactly the 50 states from the Census 2024 cartographic boundary file", () => {
  assert.equal(borders.source, "https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_500k.zip");
  assert.match(borders.sha256, /^[0-9a-f]{64}$/);
  assert.deepEqual(borders.states.map((s) => s.st), FIFTY);
});

test("each decoded border is a closed ring whose length matches the build script's perimeter", () => {
  for (const s of borders.states) {
    const ring = decodeRing(s.d);
    assert.ok(ring.length >= 4, s.st);
    assert.deepEqual(ring[0], ring[ring.length - 1], s.st);
    const path = new BorderPath(ring);
    assert.ok(Math.abs(path.total - s.perimeterM) / s.perimeterM < 0.001, `${s.st} ${path.total} vs ${s.perimeterM}`);
  }
});

test("one runner per state, each positioned on its own state's border", () => {
  const runners = buildRunners(borders.states);
  assert.equal(runners.length, 50);
  const t = Date.UTC(2026, 9, 1, 12);
  for (const r of runners) {
    const { lngLat } = r.path.at(runnerDistance(r.path, r.fips, t));
    const s = runnerDistance(r.path, r.fips, t) % r.path.total;
    let i = 1;
    while (i < r.path.cum.length - 1 && r.path.cum[i] < s) i++;
    const a = r.path.pts[i - 1];
    const b = r.path.pts[i];
    const off = Math.abs(vector(a, lngLat).dist + vector(lngLat, b).dist - vector(a, b).dist);
    assert.ok(off < 0.01, `${r.st} off segment by ${off} m`);
  }
});

test("runners advance along the border at 12 km/h and wrap round the ring", () => {
  assert.equal(RUN_SPEED_MPS, 12 / 3.6);
  const path = new BorderPath([[0, 0], [0.01, 0], [0.01, 0.01], [0, 0.01], [0, 0]]);
  const d0 = runnerDistance(path, "13", 0);
  const d1 = runnerDistance(path, "13", 60_000);
  assert.ok(Math.abs(d1 - d0 - 200) < 1e-9);
  const p = path.at(path.total + 10);
  const q = path.at(10);
  assert.deepEqual(p.lngLat.map((v) => v.toFixed(9)), q.lngLat.map((v) => v.toFixed(9)));
  assert.equal(path.at(1).heading, 0);
});

test("runner layer uses the CC BY 4.0 Cesium Man figure and is added without removing the GA patrol", () => {
  const layer = read("lib/us-border-runners-3d.ts");
  assert.match(layer, /\/models\/patrol\/cesium-man\.glb/);
  assert.match(layer, /Cesium Man © Cesium, CC BY 4\.0/);
  assert.match(layer, /FIGURE_HEIGHT_M = 1\.75/);
  assert.match(layer, /RUNNER_OPACITY = 0\.45/);
  assert.match(layer, /RUNNER_EXCLUDED_STATES = \['GA'\]/);
  assert.match(layer, /cloneSkinned\(base\)/);
  assert.doesNotMatch(layer, /sketchfab|kkk|klan|t\.me\//i);
  assert.match(layer, /link\.href = US_BORDER_RUNNERS_SOURCE_URL/);
  const map = read("components/GodsEyeMap.tsx");
  assert.match(map, /addGaPatrolLayers\(map\);\n\s*addUsBorderRunnerLayers\(map\);/);
});

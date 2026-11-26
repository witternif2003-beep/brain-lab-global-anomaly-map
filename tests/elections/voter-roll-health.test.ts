import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  BIN_COLORS,
  COUNTY_FILL_MIN_ZOOM,
  COUNTY_LABEL_MIN_ZOOM,
  INK,
  INSUFFICIENT_COLOR,
  INSUFFICIENT_LABEL,
  METRICS,
  TOL_LIGHT,
  binIndex,
  colorFor,
  contrastRatio,
  formatMetric,
  lighten
} from "../../lib/elections/voter-roll-health";
import { VOTER_ROLL_HEALTH_META, VOTER_ROLL_HEALTH_STATES } from "../../lib/elections/voter-roll-health-2024";

const csv = readFileSync("public/data/voter-roll-health-2024.csv");
const geo = readFileSync("public/data/voter-roll-health-2024-counties.geojson");
const panel = readFileSync("components/election-sources/VoterRollHealthPanel.tsx", "utf8");
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const header = csv.toString("utf8").split("\n")[0].split(",");
const features: { properties: Record<string, unknown> }[] = JSON.parse(geo.toString("utf8")).features;
const PII = /(first|last|middle|full)_?name|initial|voter_?id|dob|birth|address|street|phone|email|citizenship_status|suspect/i;

test("T1 schema carries no person-level fields", () => {
  for (const col of header) assert.doesNotMatch(col, PII, col);
  for (const key of Object.keys(features[0].properties)) assert.doesNotMatch(key, PII, key);
  assert.deepEqual(new Set(csv.toString("utf8").split("\n").slice(1).filter(Boolean).map((l) => l.split(",")[0])), new Set(["state", "county"]));
});

test("T2 palette is Paul Tol light lightened 20%, text contrast ≥ 4.5:1", () => {
  assert.deepEqual(BIN_COLORS, TOL_LIGHT.slice(0, 6).map((c) => lighten(c, 0.2)));
  assert.equal(lighten("#77AADD", 0.2), "#92BBE4");
  for (const c of [...BIN_COLORS, INSUFFICIENT_COLOR]) assert.ok(contrastRatio(INK, c) >= 4.5, `${c} ${contrastRatio(INK, c)}`);
});

test("T3/T4 states at low zoom, county boundaries and labels from zoom 6", () => {
  assert.ok(COUNTY_FILL_MIN_ZOOM < COUNTY_LABEL_MIN_ZOOM);
  assert.equal(COUNTY_LABEL_MIN_ZOOM, 6);
  assert.match(panel, /maxzoom: COUNTY_FILL_MIN_ZOOM/);
  assert.match(panel, /"text-allow-overlap": false/);
  for (const f of features) for (const k of ["sar", "sir", "srm"]) assert.ok(k in f.properties);
});

test("T5 provenance hashes match the shipped files and sources", () => {
  assert.equal(sha(csv), VOTER_ROLL_HEALTH_META.outputs.csv.sha256);
  assert.equal(sha(geo), VOTER_ROLL_HEALTH_META.outputs.geojson.sha256);
  for (const s of Object.values(VOTER_ROLL_HEALTH_META.sources)) {
    assert.match(s.sha256, /^[0-9a-f]{64}$/);
    assert.match(s.url, /^https:\/\/www2?\.(eac|census)\.gov\//);
    assert.match(s.retrieved, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.equal(VOTER_ROLL_HEALTH_META.sources.eavs.sha256, "7e04f8edc5a11c54b5692e714bc31f6e3609436af4c50ba1d4e5679f74486743");
});

test("T6 no suspect / non-citizen filter in the dashboard", () => {
  assert.doesNotMatch(panel, /suspect|non-?citizen|illegal/i);
  for (const m of METRICS) assert.doesNotMatch(m.label + m.formula, /suspect|citizenship status/i);
});

test("T7 missing values fail closed to Insufficient data", () => {
  assert.equal(binIndex(null, [1, 2]), null);
  assert.equal(colorFor(undefined, [1, 2]), INSUFFICIENT_COLOR);
  assert.equal(formatMetric(null, "%"), INSUFFICIENT_LABEL);
  for (const ab of ["GU", "VI", "AS", "MP"]) {
    const r = VOTER_ROLL_HEALTH_STATES.find((x) => x.state === ab);
    assert.ok(r && r.cvap_est === null && r.active_pct_cvap === null, ab);
  }
  const missing = features.filter((f) => f.properties.c === null);
  for (const f of missing) assert.equal(f.properties.ar, null);
});

test("covers all 56 jurisdictions and matches the existing EAVS state totals", async () => {
  assert.equal(VOTER_ROLL_HEALTH_STATES.length, 56);
  const { EAVS_2024_REGISTRATION } = await import("../../lib/elections/eavs-2024-registration");
  const ga = VOTER_ROLL_HEALTH_STATES.find((x) => x.state === "GA");
  assert.equal(ga?.registered_total, (EAVS_2024_REGISTRATION as Record<string, { total: number }>).GA.total);
});

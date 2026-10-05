import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), "utf8");

test("public MapLibre worker matches the installed maplibre-gl version", () => {
  const installed = JSON.parse(read("node_modules/maplibre-gl/package.json")).version as string;
  const worker = read("public/maplibre-gl-worker.mjs");
  const versions = new Set([...worker.matchAll(/maplibre-gl-js\/blob\/v([\d.]+)\//g)].map((m) => m[1]));
  assert.deepEqual([...versions], [installed]);
  assert.doesNotMatch(worker, /from\s*"\.\/maplibre-gl-shared/);
});

type Feature = { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } };
const fc = (p: string) => JSON.parse(read(p)).features as Feature[];

test("state layers keep every official Census polygon part", () => {
  const parts = Object.fromEntries(
    fc("public/geo/all-states.geojson").map((f) => [f.properties.STUSPS, f.geometry.type === "MultiPolygon" ? (f.geometry.coordinates as unknown[]).length : 1]),
  );
  assert.deepEqual(parts, { AL: 5, FL: 121, GA: 2, NC: 13, SC: 4, TN: 1, TX: 32, VA: 14 });
});

test("competitor layer has one label point per neighbouring state", () => {
  const pts = fc("public/geo/competitor-states.geojson").filter((f) => f.geometry.type === "Point").map((f) => f.properties.STUSPS);
  assert.deepEqual(pts.sort(), ["AL", "FL", "NC", "SC", "TN", "TX", "VA"]);
});

test("GA wall: first path is the closed mainland ring, every Georgia part has a path", () => {
  const paths = fc("public/geo/ga-wall.geojson").filter((f) => f.properties.part === "path");
  assert.deepEqual(paths.map((p) => p.properties.ring), ["mainland", "island"]);
  for (const p of paths) {
    const c = p.geometry.coordinates as number[][];
    assert.deepEqual(c[0], c[c.length - 1]);
  }
});

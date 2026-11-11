import { test } from "node:test";
import assert from "node:assert/strict";
import { ageText, nodeFieldSummary } from "../lib/ga-node-field-hud";
import type { GaFeedStatus } from "../lib/ga-live-status";

const now = Date.parse("2026-11-11T12:00:00Z");
const feed = (id: string, count: number | null, updatedAt: string | null, error: string | null = null): GaFeedStatus =>
  ({ id, label: id, color: "#fff", count, updatedAt, sourceUrl: "https://example.org/", error });

test("all four feeds fresh reads LIVE with the summed record count", () => {
  const s = nodeFieldSummary([
    feed("aircraft", 120, "2026-11-11T11:59:50Z"),
    feed("vessels", 30, "2026-11-11T11:50:00Z"),
    feed("transit", 400, "2026-11-11T11:58:00Z"),
    feed("towers", 2500, "2026-11-11T02:00:00Z"),
  ], now);
  assert.equal(s.state, "LIVE");
  assert.equal(s.total, 3050);
  assert.deepEqual(s.rows.map((r) => r.state), ["LIVE", "LIVE", "LIVE", "LIVE"]);
  assert.equal(s.rows[0].age, "10 s ago");
});

test("an old or failed feed downgrades the badge instead of claiming LIVE", () => {
  const s = nodeFieldSummary([
    feed("aircraft", 120, "2026-11-11T11:50:00Z"),
    feed("transit", null, null, "unavailable: MARTA (HTTP 503)"),
  ], now);
  assert.equal(s.state, "STALE");
  assert.deepEqual(s.rows.map((r) => r.state), ["STALE", "LOADING", "ERROR", "LOADING"]);
  assert.equal(s.rows[2].error, "unavailable: MARTA (HTTP 503)");
  assert.equal(s.total, 120);
});

test("partial when some feeds are live and others are not", () => {
  const s = nodeFieldSummary([feed("aircraft", 5, "2026-11-11T11:59:59Z"), feed("vessels", 2, null)], now);
  assert.equal(s.state, "PARTIAL");
  assert.equal(s.rows[1].state, "NO TIMESTAMP");
});

test("nothing reported yet is LOADING, and ages format by magnitude", () => {
  assert.equal(nodeFieldSummary([], now).state, "LOADING");
  assert.equal(ageText(null, now), "no timestamp");
  assert.equal(ageText("2026-11-11T11:55:00Z", now), "5 min ago");
  assert.equal(ageText("2026-11-11T09:00:00Z", now), "3 h ago");
});

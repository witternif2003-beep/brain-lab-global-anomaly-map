import { test } from "node:test";
import assert from "node:assert/strict";
import { hasActiveStrobe, STROBE_MS, strobeKey, strobeSince } from "../../lib/ga-live-markers/strobe";
import type { LiveMarker } from "../../lib/ga-live-markers/parse";

const m = (label: string, lon: number, lat: number, observedAt: string | null, props: LiveMarker["props"] = {}): LiveMarker => ({ label, lon, lat, observedAt, props });
const NOW = Date.parse("2026-10-16T13:00:00Z");

test("event layers: first load strobes only incidents observed within the strobe window", () => {
  const recent = m("Crash", -82, 33.4, "2026-10-16T12:55:00Z");
  const old = m("Crash", -82, 33.5, "2026-10-16T11:00:00Z");
  const seen = strobeSince("augusta911", [recent, old], undefined, NOW);
  assert.equal(seen.get(strobeKey("augusta911", recent)), Date.parse("2026-10-16T12:55:00Z"));
  assert.equal(seen.get(strobeKey("augusta911", old)), 0);
});

test("fixed and moving layers start steady, then strobe indicators that appear on a later refresh", () => {
  const a = m("Station A", -84, 33, "2026-10-16T12:59:00Z");
  const first = strobeSince("stations", [a], undefined, NOW);
  assert.equal(first.get(strobeKey("stations", a)), 0);
  const aUpdated = { ...a, observedAt: "2026-10-16T13:04:00Z" };
  const b = m("Station B", -83, 32, "2026-10-16T13:04:00Z");
  const second = strobeSince("stations", [aUpdated, b], first, NOW + 300_000);
  assert.equal(second.get(strobeKey("stations", aUpdated)), 0, "a new reading at the same station is not a new indicator");
  assert.equal(second.get(strobeKey("stations", b)), NOW + 300_000);
});

test("aircraft keep identity by callsign while moving", () => {
  const p1 = m("DAL123", -84.4, 33.6, "2026-10-16T13:00:00Z", { type: "B739" });
  const p2 = { ...p1, lon: -84.3, lat: 33.7, observedAt: "2026-10-16T13:00:10Z" };
  const first = strobeSince("aircraft", [p1], undefined, NOW);
  const second = strobeSince("aircraft", [p2], first, NOW + 10_000);
  assert.equal(second.get(strobeKey("aircraft", p2)), 0);
});

test("hasActiveStrobe reports whether any indicator is still inside the window", () => {
  const seen = new Map([["a", NOW - STROBE_MS + 1_000], ["b", 0]]);
  assert.equal(hasActiveStrobe(seen, NOW), true);
  assert.equal(hasActiveStrobe(seen, NOW + 2_000), false);
  assert.equal(hasActiveStrobe(seen, NOW + 2_000, 60_000), true);
  assert.equal(hasActiveStrobe(undefined, NOW), false);
});

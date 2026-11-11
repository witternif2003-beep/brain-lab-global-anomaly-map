import assert from "node:assert/strict";
import test from "node:test";
import { pctChange, summarizeOffense, type CdeSummarized } from "../../lib/ga-ucr/summarize";

function fixture(counts: Record<string, number | null>, coverage: Record<string, number | null> = {}): CdeSummarized {
  return {
    offenses: { actuals: { "Georgia Offenses": counts, "Georgia Clearances": {} }, rates: { "Georgia Offenses": {} } },
    tooltips: { "Percent of Population Coverage": { Georgia: coverage } },
    populations: { population: {} },
  };
}

const months = (year: number, n: number, value: number) =>
  Object.fromEntries(Array.from({ length: n }, (_, i) => [`${String(i + 1).padStart(2, "0")}-${year}`, value]));

test("complete years are summed and compared; partial year is not", () => {
  const s = summarizeOffense("x", fixture({ ...months(2024, 12, 10), ...months(2025, 12, 12), ...months(2026, 3, 9) }));
  assert.deepEqual(s.completeYears.map((p) => [p.year, p.offenses]), [[2024, 120], [2025, 144]]);
  assert.equal(s.yearOverYear.length, 1);
  assert.ok(Math.abs((s.yearOverYear[0].pctChange ?? 0) - 20) < 1e-9);
  assert.equal(s.partial?.current.months, 3);
  assert.equal(s.partial?.current.offenses, 27);
  assert.equal(s.partial?.priorSamePeriod?.offenses, 36);
  assert.equal(s.partial?.priorSamePeriod?.lastMonth, "03-2025");
  assert.ok(s.warnings.some((w) => w.includes("partial")));
});

test("null months are treated as unpublished, not zero", () => {
  const counts = { ...months(2024, 12, 5), "12-2024": null };
  const s = summarizeOffense("x", fixture(counts));
  assert.equal(s.completeYears.length, 0);
  assert.equal(s.partial?.current.months, 11);
  assert.equal(s.partial?.priorSamePeriod, null);
});

test("unexpected period keys are reported and ignored; months are sorted chronologically", () => {
  const s = summarizeOffense("x", fixture({ "02-2025": 2, "2025": 9, "01-2025": 1, "12-2024": 3 }));
  assert.deepEqual(s.months.map((m) => m.month), ["12-2024", "01-2025", "02-2025"]);
  assert.ok(s.warnings.some((w) => w.includes('"2025"')));
});

test("zero base gives null change and coverage range is reported", () => {
  assert.equal(pctChange(0, 5), null);
  const s = summarizeOffense("x", fixture(months(2024, 12, 1), { "01-2024": 90, "06-2024": 80 }));
  assert.equal(s.completeYears[0].coverageMinPct, 80);
  assert.equal(s.completeYears[0].coverageMaxPct, 90);
});

test("missing place series throws", () => {
  const raw = fixture({});
  delete (raw.offenses.actuals as Record<string, unknown>)["Georgia Offenses"];
  assert.throws(() => summarizeOffense("x", raw));
});

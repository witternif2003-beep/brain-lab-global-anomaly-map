import { test } from "node:test";
import assert from "node:assert/strict";
import { JURISDICTIONS } from "../../lib/territory-catalog";
import { PUBLIC_LIVE } from "../../lib/public-live/jurisdictions";
import LAUS from "../../lib/public-live/laus-latest.json";

test("every catalog jurisdiction has public-live query parameters", () => {
  assert.equal(JURISDICTIONS.length, 56);
  for (const j of JURISDICTIONS) {
    const p = PUBLIC_LIVE[j.code];
    assert.ok(p, `missing ${j.code}`);
    const [w, s, e, n] = p.bbox;
    assert.ok(w < e && s < n, `bad bbox ${j.code}`);
  }
  assert.equal(Object.keys(PUBLIC_LIVE).length, 56);
});

test("LAUS snapshot covers 50 states, DC and PR with a dated latest month", () => {
  const series = LAUS.series as Record<string, { latest: { period: string; rate: number } }>;
  const expected = JURISDICTIONS.filter((j) => j.type !== "territory" || j.code === "PR").map((j) => j.code);
  assert.equal(expected.length, 52);
  for (const code of expected) {
    const s = series[code];
    assert.ok(s, `missing ${code}`);
    assert.match(s.latest.period, /^\d{4}-\d{2}$/);
    assert.ok(Number.isFinite(s.latest.rate));
  }
  assert.ok(!Number.isNaN(Date.parse(LAUS.retrievedAt)));
});

// Snapshot of BLS LAUS seasonally adjusted statewide unemployment (50 states, DC, PR).
// Source: https://download.bls.gov/pub/time.series/la/la.data.3.AllStatesS (public flat file).
// Run: node scripts/build-laus-snapshot.mjs
import fs from "node:fs";
import path from "node:path";

const URL = "https://download.bls.gov/pub/time.series/la/la.data.3.AllStatesS";
const OUT = path.join(process.cwd(), "lib", "public-live", "laus-latest.json");
const MEASURES = { "03": "rate", "04": "unemployed", "06": "laborForce" };
const HISTORY = 13;

const src = fs.readFileSync(path.join(process.cwd(), "lib", "public-live", "jurisdictions.ts"), "utf8");
const codeByFips = Object.fromEntries([...src.matchAll(/^\s+([A-Z]{2}): \{ fips: "(\d{2})"/gm)].map((m) => [m[2], m[1]]));

const res = await fetch(URL, { headers: { "User-Agent": "brain-lab LAUS snapshot (witternif2003@gmail.com)" } });
if (!res.ok) throw new Error(`HTTP ${res.status}`);
const text = await res.text();

const rows = {};
for (const line of text.split("\n").slice(1)) {
  const [id, year, period, value] = line.split("\t").map((s) => s?.trim());
  const m = /^LASST(\d{2})00000000000(\d{2})$/.exec(id ?? "");
  if (!m || !/^M(0[1-9]|1[0-2])$/.test(period) || !MEASURES[m[2]] || !codeByFips[m[1]]) continue;
  const code = codeByFips[m[1]];
  const key = `${year}-${period.slice(1)}`;
  const v = Number(value);
  if (!Number.isFinite(v)) continue;
  ((rows[code] ??= {})[key] ??= {})[MEASURES[m[2]]] = v;
}

const series = {};
for (const [code, byMonth] of Object.entries(rows)) {
  const months = Object.keys(byMonth).filter((k) => byMonth[k].rate != null).sort();
  const latest = months.at(-1);
  series[code] = {
    latest: { period: latest, ...byMonth[latest] },
    history: months.slice(-HISTORY).map((p) => ({ period: p, rate: byMonth[p].rate })),
  };
}

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: "U.S. Bureau of Labor Statistics, Local Area Unemployment Statistics (seasonally adjusted)",
      sourceUrl: URL,
      retrievedAt: new Date().toISOString(),
      series,
    },
    null,
    1,
  ) + "\n",
);
console.log(`wrote ${Object.keys(series).length} jurisdictions to ${OUT}`);

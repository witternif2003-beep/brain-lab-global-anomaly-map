// Snapshot of FBI Crime Data Explorer statewide Georgia summarized offenses (public aggregate tables).
// Run: FBI_API_KEY=... node --import tsx scripts/build-ga-ucr-snapshot.ts   (falls back to api.data.gov DEMO_KEY, 10 requests/day)
// UCR_CACHE_DIR=dir reuses <offense>.json responses saved earlier from the same URLs; their file mtime is the retrieval time.
// Review schema, definitions and coverage before committing a new vintage.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { summarizeOffense, type CdeSummarized } from "../lib/ga-ucr/summarize";

const OFFENSES = [
  "violent-crime", "homicide", "rape", "robbery", "aggravated-assault",
  "property-crime", "burglary", "larceny", "motor-vehicle-theft", "arson",
];
const FROM_YEAR = 2024;
const TO_YEAR = new Date().getUTCFullYear();
const BASE = "https://api.usa.gov/crime/fbi/cde/summarized/state/GA";
const DIR = path.join(process.cwd(), "data", "ga-ucr");
const KEY = process.env.FBI_API_KEY || "DEMO_KEY";
const CACHE = process.env.UCR_CACHE_DIR;

async function fetchRaw(offense: string, url: string): Promise<{ text: string; retrievedAt: string }> {
  const cached = CACHE ? path.join(CACHE, `${offense}.json`) : null;
  if (cached && fs.existsSync(cached)) return { text: fs.readFileSync(cached, "utf8"), retrievedAt: fs.statSync(cached).mtime.toISOString() };
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`${url}&api_key=${encodeURIComponent(KEY)}`, { headers: { Accept: "application/json" } });
    if (res.status === 429) {
      await new Promise((r) => setTimeout(r, 65_000));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { text: await res.text(), retrievedAt: new Date().toISOString() };
  }
  throw new Error("HTTP 429 (api.data.gov rate limit)");
}

async function main(): Promise<void> {
  fs.mkdirSync(path.join(DIR, "raw"), { recursive: true });
  const files = [];
  const offenses = [];
  const unavailable: { offense: string; url: string; error: string }[] = [];
  let cde: CdeSummarized["cde_properties"] = undefined;
  for (const offense of OFFENSES) {
    const url = `${BASE}/${offense}?from=01-${FROM_YEAR}&to=12-${TO_YEAR}`;
    let fetched: { text: string; retrievedAt: string };
    try {
      fetched = await fetchRaw(offense, url);
    } catch (err) {
      unavailable.push({ offense, url, error: err instanceof Error ? err.message : String(err) });
      console.log(`${offense}: unavailable (${unavailable.at(-1)!.error})`);
      continue;
    }
    const { text, retrievedAt } = fetched;
    const raw = JSON.parse(text) as CdeSummarized;
    const filename = `raw/${offense}.json`;
    fs.writeFileSync(path.join(DIR, filename), text);
    files.push({
      offense,
      url,
      retrievedAt,
      filename: `data/ga-ucr/${filename}`,
      bytes: Buffer.byteLength(text),
      sha256: createHash("sha256").update(text).digest("hex"),
      schema: { actuals: Object.keys(raw.offenses.actuals), rates: Object.keys(raw.offenses.rates) },
    });
    cde ??= raw.cde_properties;
    offenses.push(summarizeOffense(offense, raw));
    console.log(`${offense}: ${files.at(-1)!.bytes} bytes`);
  }

  const summary = {
    title: "FBI Crime Data Explorer — Georgia statewide summarized offenses",
    source: "FBI Uniform Crime Reporting Program, Crime Data Explorer (CDE)",
    sourceUrl: "https://cde.ucr.cjis.gov/LATEST/webapp/#/pages/explorer/crime/crime-trend",
    apiBase: BASE,
    vintage: { maxDataDate: cde?.max_data_date?.UCR ?? null, lastRefreshDate: cde?.last_refresh_date?.UCR ?? null },
    grain: "State (Georgia) × month × offense category, as published by the FBI",
    definitions:
      "Counts are FBI-published monthly statewide offense and clearance totals; annual figures are the sum of those 12 published months. Rates are the FBI-published offenses per 100,000 people. Coverage is the FBI-published percent of Georgia's population covered by agencies reporting that month.",
    limitations: [
      "Reported offenses only; not all crime is reported to police.",
      "Agency participation varies by month; read every count next to its coverage.",
      "The most recent months are incomplete because agencies submit late; FBI revises them.",
      "Annual/monthly data, re-fetched by script after review — not a live feed.",
    ],
    codeVersion: "lib/ga-ucr/summarize.ts",
    generatedAt: new Date().toISOString(),
    files,
    offenses,
    unavailable,
  };
  fs.writeFileSync(path.join(DIR, "summary.json"), JSON.stringify(summary, null, 1) + "\n");
  console.log(`wrote ${offenses.length} offenses to data/ga-ucr/summary.json`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

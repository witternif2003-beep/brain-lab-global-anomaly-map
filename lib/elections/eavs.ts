/**
 * EAC Election Administration and Voting Survey (EAVS) 2024 aggregate totals.
 *
 * Fetches the official EAC public-release CSV zip at runtime, sums A1a
 * (total registered), A1b (active), A1c (inactive) per State_Abbr, excluding
 * negative missing-value codes (-77/-88/-99). These are aggregate
 * jurisdiction-level counts — there is no person-level data in this file,
 * so no per-voter matching of any kind is possible from it.
 */
import { unzipSync } from "fflate";
import { makeProvenance, type Provenance } from "../provenance";
import type { EavsTotals } from "./types";

export const EAVS_ZIP_URL =
  "https://www.eac.gov/sites/default/files/2025-06/2024_EAVS_for_Public_Release_nolabel_V1_csv.zip";
export const EAVS_SURVEY_YEAR = 2024;
export const EAVS_SURVEY_NAME = "EAC Election Administration and Voting Survey";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface EavsCache {
  at: number;
  totals: Map<string, EavsTotals>;
  provenance: Provenance;
}

let cache: EavsCache | null = null;

/** Minimal quoted-CSV line splitter (handles "..." and "" escapes). */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out;
}

const nonNegInt = (v: string): number | null => {
  if (!/^-?\d+$/.test(v.trim())) return null;
  const n = parseInt(v.trim(), 10);
  return n >= 0 ? n : null;
};

async function fetchAndAggregate(): Promise<EavsCache> {
  const res = await fetch(EAVS_ZIP_URL, {
    headers: { "User-Agent": "BrainLab/1.0 (EAVS aggregate reader)", Accept: "application/zip" },
  });
  if (!res.ok) throw new Error(`EAVS zip HTTP ${res.status}`);
  const zipBytes = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(zipBytes);
  const csvName = Object.keys(files).find((n) => n.toLowerCase().endsWith(".csv"));
  if (!csvName) throw new Error("EAVS zip contains no CSV");
  const csvText = new TextDecoder("utf-8").decode(files[csvName]);

  const provenance = makeProvenance({
    source_id: "EAC-EAVS",
    jurisdiction: "NATIONAL",
    source_url: EAVS_ZIP_URL,
    body: Buffer.from(zipBytes).toString("base64").slice(0, 200000),
    http_status: res.status,
    record_count: 0,
    access_note: "public release CSV zip; aggregate county-grain counts",
  });

  const lines = csvText.split(/\r?\n/);
  const header = splitCsvLine(lines[0].replace(/^\uFEFF/, ""));
  const iState = header.indexOf("State_Abbr");
  const iTot = header.indexOf("A1a");
  const iAct = header.indexOf("A1b");
  const iIna = header.indexOf("A1c");
  if (iState < 0 || iTot < 0 || iAct < 0 || iIna < 0) {
    throw new Error("EAVS CSV missing State_Abbr/A1 columns");
  }

  const agg = new Map<string, { n: number; tot: number; act: number; ina: number; totN: number; actN: number; inaN: number }>();
  let rows = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cols = splitCsvLine(line);
    const st = (cols[iState] ?? "").trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(st)) continue;
    rows++;
    let a = agg.get(st);
    if (!a) { a = { n: 0, tot: 0, act: 0, ina: 0, totN: 0, actN: 0, inaN: 0 }; agg.set(st, a); }
    a.n++;
    const t = nonNegInt(cols[iTot] ?? "");
    const c = nonNegInt(cols[iAct] ?? "");
    const d = nonNegInt(cols[iIna] ?? "");
    if (t !== null) { a.tot += t; a.totN++; }
    if (c !== null) { a.act += c; a.actN++; }
    if (d !== null) { a.ina += d; a.inaN++; }
  }

  const totals = new Map<string, EavsTotals>();
  for (const [code, a] of agg) {
    let note: string | null = null;
    if (a.totN === 0) {
      note = code === "ND"
        ? "North Dakota operates no voter-registration system; EAVS reports no registration counts."
        : `No registration counts reported (${a.totN}/${a.n} jurisdictions responding).`;
    } else if (a.inaN === 0) {
      note = `Inactive status not reported separately (${a.totN}/${a.n} jurisdictions reporting totals).`;
    } else if (a.totN < a.n) {
      note = `Partial coverage: ${a.totN}/${a.n} jurisdictions reporting totals.`;
    }
    totals.set(code, {
      code,
      surveyYear: EAVS_SURVEY_YEAR,
      surveyName: EAVS_SURVEY_NAME,
      totalRegistered: a.totN > 0 ? a.tot : null,
      totalActive: a.actN > 0 ? a.act : null,
      totalInactive: a.inaN > 0 ? a.ina : null,
      coverageResponded: a.totN,
      coverageOf: a.n,
      note,
      provenance: { ...provenance, jurisdiction: code, record_count: a.n },
    });
  }
  provenance.record_count = rows;
  return { at: Date.now(), totals, provenance };
}

/** All 56 aggregate rows (cached 6h). Throws only when the EAC file is unreachable. */
export async function fetchEavsTotals(): Promise<Map<string, EavsTotals>> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.totals;
  cache = await fetchAndAggregate();
  return cache.totals;
}

/** Single-jurisdiction slice (null when the state has no row at all). */
export async function fetchEavsFor(code: string): Promise<EavsTotals | null> {
  const all = await fetchEavsTotals();
  return all.get(code.toUpperCase()) ?? null;
}

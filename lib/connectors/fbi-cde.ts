/**
 * FBI Crime Data Explorer — state violent-crime summary.
 *
 * LIVE-CONTRACT (verified 2026-09-28): the public CDE backend
 * cde.ucr.cjis.gov/LATEST/summarized/state/{ABBR}/violent-crime?from=MM-YYYY&to=MM-YYYY
 * needs no key and returns offenses.actuals["<Name> Offenses"] keyed by MM-YYYY
 * plus tooltips["Percent of Population Coverage"]["<Name>"]. Jurisdictions the
 * CDE does not report on (VI, AS, MP) come back with only "United States" keys.
 * When FBI_API_KEY is set the documented api.usa.gov gateway is used instead.
 */
import { makeProvenance, Provenance } from "../provenance";

const CDE_PUBLIC = "https://cde.ucr.cjis.gov/LATEST/summarized/state";
const CDE_GATEWAY = "https://api.usa.gov/crime/fbi/cde/summarized/state";

export type FbiViolentCrime =
  | { kind: "ok"; offenses: number; months: number; coverage_pct: number; year: number; provenance: Provenance }
  | { kind: "not-reported"; year: number; provenance: Provenance }
  | { kind: "error"; message: string; provenance: Provenance | null };

type SeriesMap = Record<string, Record<string, number>>;

export async function fetchFbiViolentCrime(a: { code: string; name: string; year: number }): Promise<FbiViolentCrime> {
  const key = process.env.FBI_API_KEY;
  const base = key ? CDE_GATEWAY : CDE_PUBLIC;
  const sourceUrl = `${base}/${a.code}/violent-crime?from=01-${a.year}&to=12-${a.year}`;
  const res = await fetch(key ? `${sourceUrl}&API_KEY=${encodeURIComponent(key)}` : sourceUrl, {
    headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" },
    cache: "no-store"
  });
  const raw = await res.text();
  let parsed: { offenses?: { actuals?: SeriesMap }; tooltips?: { "Percent of Population Coverage"?: SeriesMap } } | null = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* non-JSON body -> error below */
  }
  const series = parsed?.offenses?.actuals?.[`${a.name} Offenses`];
  const months = series ? Object.values(series).filter((v) => typeof v === "number") : [];
  const provenance = makeProvenance({
    source_id: "FBI-CDE",
    jurisdiction: a.code,
    source_url: sourceUrl,
    body: raw,
    http_status: res.status,
    record_count: months.length,
    access_note: key
      ? "FBI CDE via api.usa.gov gateway. Key omitted from source_url."
      : "FBI Crime Data Explorer public backend, no key. Reported offenses, not convictions."
  });
  if (!res.ok || !parsed?.offenses) {
    return { kind: "error", message: `FBI CDE HTTP ${res.status}`, provenance };
  }
  if (!series) return { kind: "not-reported", year: a.year, provenance };
  const coverage = parsed.tooltips?.["Percent of Population Coverage"]?.[a.name] ?? {};
  const cov = Object.values(coverage).filter((v) => typeof v === "number");
  const coveragePct = cov.length ? Math.round((cov.reduce((s, v) => s + v, 0) / cov.length) * 10) / 10 : 0;
  if (coveragePct === 0) return { kind: "not-reported", year: a.year, provenance };
  return {
    kind: "ok",
    offenses: months.reduce((s, v) => s + v, 0),
    months: months.length,
    coverage_pct: coveragePct,
    year: a.year,
    provenance
  };
}

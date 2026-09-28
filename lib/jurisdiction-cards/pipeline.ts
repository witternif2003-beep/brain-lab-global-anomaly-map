/**
 * Jurisdiction card pipeline — one card per jurisdiction (56), identical field
 * set for every card. Each field is filled ONLY from a live API response in
 * this run; otherwise value is null and status says why. Nothing is estimated.
 */
import { JURISDICTIONS } from "../territory-catalog";
import { JURISDICTION_ADAPTERS } from "../adapters/jurisdictions";
import { fetchBlsLausLatestBatch, BlsLatest } from "../connectors/bls";
import { fetchEpaEcho } from "../connectors/epa-echo";
import { fetchWorldBank } from "../connectors/worldbank";
import { DojFeed, fetchDojNatsecReleases } from "../connectors/doj";
import { fetchFbiViolentCrime } from "../connectors/fbi-cde";
import { makeProvenance, Provenance } from "../provenance";
import { BLS_LAUS_UNPUBLISHED, JURISDICTION_REFERENCE, WORLDBANK_ISO3, usaoToCodes } from "./reference";
import { OUTLIER_METHOD, computeOutliers } from "./outliers";
import {
  CARD_FIELD_ORDER,
  CardBuildResult,
  CardField,
  CardFieldId,
  CardFieldStatus,
  JurisdictionCard,
  NatsecRelease
} from "./types";

const CENSUS_PEP_VINTAGE = 2025;
const CENSUS_PEP_CSV = `https://www2.census.gov/programs-surveys/popest/datasets/2020-${CENSUS_PEP_VINTAGE}/state/totals/NST-EST${CENSUS_PEP_VINTAGE}-ALLDATA.csv`;
const FBI_YEAR = new Date().getUTCFullYear() - 1;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const EPA_CONCURRENCY = 8;

let cache: { at: number; result: CardBuildResult } | null = null;

const labelFor = (id: CardFieldId): string => CARD_FIELD_ORDER.find((f) => f.id === id)?.label ?? id;

const field = (
  id: CardFieldId,
  status: CardFieldStatus,
  source_id: string,
  note: string,
  extra: { value?: string | null; numeric?: number | null; as_of?: string | null; provenance?: Provenance | null } = {}
): CardField => ({
  id,
  label: labelFor(id),
  value: status === "sourced" ? extra.value ?? null : null,
  numeric: status === "sourced" ? extra.numeric ?? null : null,
  as_of: status === "sourced" ? extra.as_of ?? null : null,
  status,
  source_id,
  note,
  provenance: extra.provenance ?? null
});

interface CensusPopulation {
  value: string;
  provenance: Provenance;
}

async function fetchCensusPopulation(): Promise<{ byFips: Map<string, CensusPopulation>; error: string | null }> {
  const byFips = new Map<string, CensusPopulation>();
  const res = await fetch(CENSUS_PEP_CSV, { headers: { "User-Agent": "brain-lab-ingest/1.0" }, cache: "no-store" });
  const raw = await res.text();
  const lines = raw.split(/\r?\n/).filter(Boolean);
  const header = lines[0]?.split(",") ?? [];
  const iState = header.indexOf("STATE");
  const iPop = header.indexOf(`POPESTIMATE${CENSUS_PEP_VINTAGE}`);
  if (!res.ok || iState < 0 || iPop < 0) return { byFips, error: `Census PEP CSV HTTP ${res.status}` };
  const rows = lines.slice(1).map((l) => l.split(",")).filter((r) => r[0] === "040");
  const prov = makeProvenance({
    source_id: "CENSUS-PEP",
    jurisdiction: "ALL",
    source_url: CENSUS_PEP_CSV,
    body: raw,
    http_status: res.status,
    record_count: rows.length,
    access_note: `Census Population Estimates Program vintage ${CENSUS_PEP_VINTAGE} state totals (public CSV, no key).`
  });
  for (const r of rows) if (r[iState] && r[iPop]) byFips.set(r[iState], { value: r[iPop], provenance: prov });
  return { byFips, error: null };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

const EPA_ATTEMPTS = 3;

async function epaFields(code: string): Promise<[CardField, CardField]> {
  try {
    let r = await fetchEpaEcho({ territory: code, rows: 1 });
    for (
      let attempt = 1;
      !r.records.length && r.capped_rows === undefined && r.provenance.http_status !== 429 && attempt < EPA_ATTEMPTS;
      attempt++
    ) {
      r = await fetchEpaEcho({ territory: code, rows: 1 });
    }
    const rec = r.records[0];
    if (!rec && r.capped_rows !== undefined) {
      return [
        field("epa_facilities", "sourced", "EPA-ECHO", "Active facilities count taken from ECHO's queryset-limit response.", {
          value: r.capped_rows.toLocaleString("en-US"),
          numeric: r.capped_rows,
          as_of: r.provenance.retrieved_at.slice(0, 10),
          provenance: r.provenance
        }),
        field("epa_penalties", "not-published", "EPA-ECHO", r.note, { provenance: r.provenance })
      ];
    }
    if (!rec) {
      return [
        field("epa_facilities", "error", "EPA-ECHO", r.note, { provenance: r.provenance }),
        field("epa_penalties", "error", "EPA-ECHO", r.note, { provenance: r.provenance })
      ];
    }
    const asOf = rec.provenance.retrieved_at.slice(0, 10);
    return [
      field("epa_facilities", "sourced", "EPA-ECHO", "Active facilities in ECHO (aggregate count, not findings).", {
        value: rec.active_facilities.toLocaleString("en-US"),
        numeric: rec.active_facilities,
        as_of: asOf,
        provenance: rec.provenance
      }),
      rec.total_penalties
        ? field("epa_penalties", "sourced", "EPA-ECHO", "Total penalties reported across active facilities.", {
            value: rec.total_penalties,
            numeric: Number(rec.total_penalties.replace(/[^0-9.]/g, "")),
            as_of: asOf,
            provenance: rec.provenance
          })
        : field("epa_penalties", "not-published", "EPA-ECHO", "ECHO returned no penalty total.", {
            provenance: rec.provenance
          })
    ];
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch error";
    return [field("epa_facilities", "error", "EPA-ECHO", msg), field("epa_penalties", "error", "EPA-ECHO", msg)];
  }
}

async function worldBankPopulation(code: string): Promise<CardField> {
  const iso3 = WORLDBANK_ISO3[code];
  try {
    const r = await fetchWorldBank({ territoryIso3: iso3, territoryLabel: code, indicatorId: "SP.POP.TOTL", perPage: 10 });
    const latest = r.records.find((x) => x.value !== null);
    if (!latest || latest.value === null) {
      return field("population", "error", "WORLDBANK", "World Bank returned no population value.", {
        provenance: r.provenance
      });
    }
    return field("population", "sourced", "WORLDBANK", "World Bank SP.POP.TOTL (latest non-null year).", {
      value: Math.round(latest.value).toLocaleString("en-US"),
      numeric: latest.value,
      as_of: latest.year,
      provenance: r.provenance
    });
  } catch (e) {
    return field("population", "error", "WORLDBANK", e instanceof Error ? e.message : "fetch error");
  }
}

function unemploymentField(code: string, fips: string, bls: Map<string, BlsLatest>, blsError: string | null): CardField {
  if (BLS_LAUS_UNPUBLISHED.has(code)) {
    return field("unemployment", "not-published", "BLS-LAUS", "BLS LAUS does not publish this jurisdiction.");
  }
  const hit = bls.get(fips);
  if (!hit) {
    return field("unemployment", "error", "BLS-LAUS", blsError ?? "Series missing from BLS response.");
  }
  return field("unemployment", "sourced", "BLS-LAUS", "Seasonally adjusted LAUS unemployment rate.", {
    value: `${hit.value}%`,
    numeric: Number(hit.value),
    as_of: `${hit.period_name} ${hit.year}`,
    provenance: hit.provenance
  });
}

function populationFromCensus(
  fips: string,
  census: { byFips: Map<string, CensusPopulation>; error: string | null }
): CardField {
  const hit = census.byFips.get(fips);
  if (!hit) return field("population", "error", "CENSUS-PEP", census.error ?? "State missing from Census PEP file.");
  return field("population", "sourced", "CENSUS-PEP", `Census PEP July 1, ${CENSUS_PEP_VINTAGE} resident population estimate.`, {
    value: Number(hit.value).toLocaleString("en-US"),
    numeric: Number(hit.value),
    as_of: `July ${CENSUS_PEP_VINTAGE}`,
    provenance: hit.provenance
  });
}

async function fbiField(code: string, name: string): Promise<CardField> {
  try {
    const r = await fetchFbiViolentCrime({ code, name, year: FBI_YEAR });
    if (r.kind === "error") return field("fbi_crime", "error", "FBI-CDE", r.message, { provenance: r.provenance });
    if (r.kind === "not-reported") {
      return field("fbi_crime", "not-published", "FBI-CDE", `FBI CDE has no ${r.year} reporting coverage for this jurisdiction.`, {
        provenance: r.provenance
      });
    }
    return field(
      "fbi_crime",
      "sourced",
      "FBI-CDE",
      `Violent offenses reported to UCR in ${r.year} (${r.months} months, ${r.coverage_pct}% population coverage). Reported offenses, not convictions.`,
      { value: r.offenses.toLocaleString("en-US"), numeric: r.offenses, as_of: String(r.year), provenance: r.provenance }
    );
  } catch (e) {
    return field("fbi_crime", "error", "FBI-CDE", e instanceof Error ? e.message : "fetch error");
  }
}

const NAME_TO_CODE = new Map(JURISDICTIONS.map((j) => [j.name, j.code]));

function releasesByCode(doj: DojFeed): Map<string, NatsecRelease[]> {
  const by = new Map<string, NatsecRelease[]>();
  for (const r of doj.releases) {
    const codes = new Set(r.offices.flatMap((o) => usaoToCodes(o, NAME_TO_CODE)));
    for (const code of codes) {
      const list = by.get(code) ?? [];
      list.push({ title: r.title, date: r.date, url: r.url, offices: r.offices, matched_term: r.matched_term, provenance: r.provenance });
      by.set(code, list);
    }
  }
  return by;
}

function dojField(code: string, doj: DojFeed, releases: NatsecRelease[]): CardField {
  if (code === "AS") {
    return field("doj_natsec", "not-published", "DOJ-PRESS", "American Samoa has no U.S. Attorney's Office; no DOJ attribution.");
  }
  if (!doj.feed) {
    return field("doj_natsec", "error", "DOJ-PRESS", `DOJ press API failed: ${doj.errors.slice(0, 2).join("; ") || "no response"}`);
  }
  const partial = doj.pages_ok < doj.pages_total ? ` Partial feed: ${doj.pages_ok}/${doj.pages_total} pages.` : "";
  const shared = code === "GU" || code === "MP" ? " Shared USAO district (Guam & NMI)." : "";
  return field(
    "doj_natsec",
    "sourced",
    "DOJ-PRESS",
    "NSD / National Security-tagged DOJ releases issued by this jurisdiction's USAO in the fetched window. Charges are allegations." +
      shared +
      partial,
    {
      value: releases.length.toLocaleString("en-US"),
      numeric: releases.length,
      as_of: doj.feed.retrieved_at.slice(0, 10),
      provenance: doj.feed
    }
  );
}

export async function buildJurisdictionCards(opts: { fresh?: boolean } = {}): Promise<CardBuildResult> {
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.result;

  const blsFips = JURISDICTIONS.filter((j) => !BLS_LAUS_UNPUBLISHED.has(j.code)).map(
    (j) => JURISDICTION_REFERENCE[j.code].fips
  );

  let bls = new Map<string, BlsLatest>();
  let blsError: string | null = null;
  try {
    bls = await fetchBlsLausLatestBatch(blsFips);
  } catch (e) {
    blsError = e instanceof Error ? e.message : "BLS fetch error";
  }

  let census: { byFips: Map<string, CensusPopulation>; error: string | null } = { byFips: new Map(), error: null };
  try {
    census = await fetchCensusPopulation();
  } catch (e) {
    census = { byFips: new Map(), error: e instanceof Error ? e.message : "Census fetch error" };
  }

  let doj: DojFeed = { releases: [], errors: [], pages_ok: 0, pages_total: 0, feed: null };
  try {
    doj = await fetchDojNatsecReleases();
  } catch (e) {
    doj = { ...doj, errors: [e instanceof Error ? e.message : "DOJ fetch error"] };
  }
  const natsecByCode = releasesByCode(doj);

  const cards = await mapLimit(JURISDICTIONS, EPA_CONCURRENCY, async (j): Promise<JurisdictionCard> => {
    const ref = JURISDICTION_REFERENCE[j.code];
    const [epaFacilities, epaPenalties] = await epaFields(j.code);
    const population = census.byFips.has(ref.fips) || !WORLDBANK_ISO3[j.code]
      ? populationFromCensus(ref.fips, census)
      : await worldBankPopulation(j.code);
    const byId: Record<CardFieldId, CardField> = {
      unemployment: unemploymentField(j.code, ref.fips, bls, blsError),
      population,
      epa_facilities: epaFacilities,
      epa_penalties: epaPenalties,
      doj_natsec: dojField(j.code, doj, natsecByCode.get(j.code) ?? []),
      fbi_crime: await fbiField(j.code, j.name)
    };
    const fields = CARD_FIELD_ORDER.map((f) => byId[f.id]);
    return {
      code: j.code,
      name: j.name,
      type: j.type,
      fips: ref.fips,
      capital: ref.capital,
      lat: j.lat,
      lng: j.lng,
      open_data_portal: JURISDICTION_ADAPTERS[j.code]?.openDataPortal ?? "",
      fields,
      sourced_count: fields.filter((f) => f.status === "sourced").length,
      natsec_releases: natsecByCode.get(j.code) ?? [],
      outliers: []
    };
  });

  const outliers = computeOutliers(cards);
  for (const c of cards) c.outliers = outliers.get(c.code) ?? [];

  const summary: Record<CardFieldStatus, number> = { sourced: 0, "awaiting-source": 0, "not-published": 0, error: 0 };
  for (const c of cards) for (const f of c.fields) summary[f.status]++;

  const result: CardBuildResult = { generated_at: new Date().toISOString(), count: cards.length, summary, outlier_method: OUTLIER_METHOD, cards };
  cache = { at: Date.now(), result };
  return result;
}

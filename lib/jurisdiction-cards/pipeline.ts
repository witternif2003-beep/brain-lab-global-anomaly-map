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

const CENSUS_ACS = "https://api.census.gov/data/2023/acs/acs5";
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
  const key = process.env.CENSUS_API_KEY;
  const byFips = new Map<string, CensusPopulation>();
  if (!key) return { byFips, error: null };
  const publicUrl = `${CENSUS_ACS}?get=NAME,B01003_001E&for=state:*`;
  const res = await fetch(`${publicUrl}&key=${encodeURIComponent(key)}`, {
    headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" },
    cache: "no-store"
  });
  const raw = await res.text();
  let rows: unknown = null;
  try {
    rows = JSON.parse(raw);
  } catch {
    /* non-JSON body -> error below */
  }
  if (!res.ok || !Array.isArray(rows)) return { byFips, error: `Census ACS HTTP ${res.status}` };
  const prov = makeProvenance({
    source_id: "CENSUS-ACS5",
    jurisdiction: "ALL",
    source_url: publicUrl,
    body: raw,
    http_status: res.status,
    record_count: rows.length - 1,
    access_note: "Census ACS 5-year 2023, B01003_001E total population. Key omitted from source_url."
  });
  for (const row of rows.slice(1)) {
    if (!Array.isArray(row)) continue;
    const [, pop, fips] = row as string[];
    if (pop && fips) byFips.set(fips, { value: pop, provenance: prov });
  }
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
      !r.records.length && r.provenance.http_status !== 429 && attempt < EPA_ATTEMPTS;
      attempt++
    ) {
      r = await fetchEpaEcho({ territory: code, rows: 1 });
    }
    const rec = r.records[0];
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
  if (!process.env.CENSUS_API_KEY) {
    return field("population", "awaiting-source", "CENSUS-ACS5", "Set CENSUS_API_KEY to enable Census ACS population.");
  }
  const hit = census.byFips.get(fips);
  if (!hit) return field("population", "error", "CENSUS-ACS5", census.error ?? "State missing from Census response.");
  return field("population", "sourced", "CENSUS-ACS5", "Census ACS 5-year 2023 total population.", {
    value: Number(hit.value).toLocaleString("en-US"),
    numeric: Number(hit.value),
    as_of: "ACS 2019–2023",
    provenance: hit.provenance
  });
}

const FBI_FIELD = (): CardField =>
  field(
    "fbi_crime",
    "awaiting-source",
    "FBI-CDE",
    "FBI Crime Data Explorer requires an api.data.gov key and a verified response contract; not wired."
  );

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
    const population = WORLDBANK_ISO3[j.code] ? await worldBankPopulation(j.code) : populationFromCensus(ref.fips, census);
    const byId: Record<CardFieldId, CardField> = {
      unemployment: unemploymentField(j.code, ref.fips, bls, blsError),
      population,
      epa_facilities: epaFacilities,
      epa_penalties: epaPenalties,
      doj_natsec: dojField(j.code, doj, natsecByCode.get(j.code) ?? []),
      fbi_crime: FBI_FIELD()
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

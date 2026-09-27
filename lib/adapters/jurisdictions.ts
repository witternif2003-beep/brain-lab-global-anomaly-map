/**
 * LUCID-1 Phase-2 Ingestion Adapters — 56-jurisdiction source routing.
 *
 * HONESTY PROTOCOL (hard constraint):
 * - `openDataPortal` values are CANDIDATE base URLs (many follow the common
 *   data.<state>.gov pattern but are NOT assumed live). Liveness is determined
 *   ONLY by the runtime probe (app/api/ingest/probe) — never by this config.
 * - SOS / UCC / DOR endpoints are null everywhere: no open REST APIs exist for
 *   them (paywalls / FOIA / scrapers required). Listed as null, not guessed.
 * - `corpus: "curated-local"` only for GA (real local corpus). Every other
 *   jurisdiction is "awaiting-source" until a dataset is explicitly mapped.
 */

export type JurisdictionType = "state" | "district" | "territory";
export type CorpusKind = "curated-local" | "awaiting-source";

export interface JurisdictionAdapterConfig {
  code: string;
  name: string;
  type: JurisdictionType;
  /** Candidate portal base URL — liveness verified at runtime by the probe. */
  openDataPortal: string;
  /** Assumed platform for probe path selection; probe degrades gracefully. */
  portalPlatform: "socrata" | "ckan" | "unknown";
  /** No open APIs exist — always null (scraper/FOIA/paid-license paths only). */
  sosApiEndpoint: null;
  uccApiEndpoint: null;
  dorApiEndpoint: null;
  corpus: CorpusKind;
}

const A = (
  code: string,
  name: string,
  type: JurisdictionType,
  openDataPortal: string,
  platform: "socrata" | "ckan" = "socrata"
): JurisdictionAdapterConfig => ({
  code,
  name,
  type,
  openDataPortal,
  portalPlatform: platform,
  sosApiEndpoint: null,
  uccApiEndpoint: null,
  dorApiEndpoint: null,
  corpus: code === "GA" ? "curated-local" : "awaiting-source"
});

export const JURISDICTION_ADAPTERS: Record<string, JurisdictionAdapterConfig> = {
  AL: A("AL", "Alabama", "state", "https://open.alabama.gov/"),
  AK: A("AK", "Alaska", "state", "https://data.alaska.gov/"),
  AZ: A("AZ", "Arizona", "state", "https://data.az.gov/"),
  AR: A("AR", "Arkansas", "state", "https://data.arkansas.gov/"),
  CA: A("CA", "California", "state", "https://data.ca.gov/", "ckan"),
  CO: A("CO", "Colorado", "state", "https://data.colorado.gov/"),
  CT: A("CT", "Connecticut", "state", "https://data.ct.gov/"),
  DE: A("DE", "Delaware", "state", "https://data.delaware.gov/"),
  DC: A("DC", "District of Columbia", "district", "https://opendata.dc.gov/"),
  FL: A("FL", "Florida", "state", "https://data.florida.gov/"),
  GA: A("GA", "Georgia", "state", "https://ga.data.socrata.com/"),
  HI: A("HI", "Hawaii", "state", "https://opendata.hawaii.gov/", "ckan"),
  ID: A("ID", "Idaho", "state", "https://data.idaho.gov/"),
  IL: A("IL", "Illinois", "state", "https://data.illinois.gov/"),
  IN: A("IN", "Indiana", "state", "https://data.in.gov/"),
  IA: A("IA", "Iowa", "state", "https://data.iowa.gov/"),
  KS: A("KS", "Kansas", "state", "https://data.kansas.gov/"),
  KY: A("KY", "Kentucky", "state", "https://data.kentucky.gov/"),
  LA: A("LA", "Louisiana", "state", "https://data.louisiana.gov/"),
  ME: A("ME", "Maine", "state", "https://data.maine.gov/"),
  MD: A("MD", "Maryland", "state", "https://opendata.maryland.gov/"),
  MA: A("MA", "Massachusetts", "state", "https://data.mass.gov/"),
  MI: A("MI", "Michigan", "state", "https://data.michigan.gov/"),
  MN: A("MN", "Minnesota", "state", "https://data.mn.gov/"),
  MS: A("MS", "Mississippi", "state", "https://data.ms.gov/"),
  MO: A("MO", "Missouri", "state", "https://data.mo.gov/"),
  MT: A("MT", "Montana", "state", "https://data.mt.gov/"),
  NE: A("NE", "Nebraska", "state", "https://data.nebraska.gov/"),
  NV: A("NV", "Nevada", "state", "https://data.nv.gov/"),
  NH: A("NH", "New Hampshire", "state", "https://data.nh.gov/"),
  NJ: A("NJ", "New Jersey", "state", "https://data.nj.gov/"),
  NM: A("NM", "New Mexico", "state", "https://data.nm.gov/"),
  NY: A("NY", "New York", "state", "https://data.ny.gov/"),
  NC: A("NC", "North Carolina", "state", "https://data.nc.gov/"),
  ND: A("ND", "North Dakota", "state", "https://data.nd.gov/"),
  OH: A("OH", "Ohio", "state", "https://data.ohio.gov/"),
  OK: A("OK", "Oklahoma", "state", "https://data.ok.gov/", "ckan"),
  OR: A("OR", "Oregon", "state", "https://data.oregon.gov/"),
  PA: A("PA", "Pennsylvania", "state", "https://data.pa.gov/"),
  RI: A("RI", "Rhode Island", "state", "https://data.ri.gov/"),
  SC: A("SC", "South Carolina", "state", "https://data.sc.gov/"),
  SD: A("SD", "South Dakota", "state", "https://data.sd.gov/"),
  TN: A("TN", "Tennessee", "state", "https://data.tn.gov/"),
  TX: A("TX", "Texas", "state", "https://data.texas.gov/"),
  UT: A("UT", "Utah", "state", "https://data.utah.gov/"),
  VT: A("VT", "Vermont", "state", "https://data.vermont.gov/"),
  VA: A("VA", "Virginia", "state", "https://data.virginia.gov/", "ckan"),
  WA: A("WA", "Washington", "state", "https://data.wa.gov/"),
  WV: A("WV", "West Virginia", "state", "https://data.wv.gov/"),
  WI: A("WI", "Wisconsin", "state", "https://data.wisconsin.gov/"),
  WY: A("WY", "Wyoming", "state", "https://data.wy.gov/"),
  PR: A("PR", "Puerto Rico", "territory", "https://data.pr.gov/"),
  VI: A("VI", "U.S. Virgin Islands", "territory", "https://data.vi.gov/"),
  GU: A("GU", "Guam", "territory", "https://data.guam.gov/"),
  AS: A("AS", "American Samoa", "territory", "https://data.as.gov/"),
  MP: A("MP", "Northern Mariana Islands", "territory", "https://data.mp.gov/")
};

export interface FederalFeed {
  id: string;
  label: string;
  endpoint: string;
  access: string;
  /** Registry only — false until a dataset mapping is implemented + tested. */
  wired: boolean;
}

/**
 * Federal aggregator registry. Four feeds are WIRED for the 5 territories
 * (live-verified 2026-09-27 via /api/ingest/territories/probe, provenance on
 * every record). OSHA-IMIS (bulk CSV only) and IODA remain unwired.
 */
export const FEDERAL_FEEDS: FederalFeed[] = [
  {
    id: "SEC-EDGAR",
    label: "SEC EDGAR company filings",
    endpoint: "https://data.sec.gov/submissions/CIK{cik}.json",
    access: "Open browse, User-Agent required, no key — territories live (CIK/state/updated; names omitted upstream)",
    wired: true
  },
  {
    id: "EPA-ECHO",
    label: "EPA ECHO enforcement cases",
    endpoint: "https://echodata.epa.gov/echo/case_rest_services.get_cases",
    access: "Open web services — territories live (aggregate summaries)",
    wired: true
  },
  {
    id: "OSHA-IMIS",
    label: "OSHA inspections",
    endpoint: "https://www.osha.gov/data",
    access: "Bulk CSV only, no REST API",
    wired: false
  },
  {
    id: "BLS-LAUS",
    label: "BLS labor timeseries",
    endpoint: "https://api.bls.gov/publicAPI/v2/timeseries/data/",
    access: "Open v2, no key, rate-limited — territories live (PR only; VI unpublished)",
    wired: true
  },
  {
    id: "IODA",
    label: "IODA internet signals",
    endpoint: "https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw",
    access: "Open, no key",
    wired: false
  },
  {
    id: "WORLDBANK",
    label: "World Bank indicators",
    endpoint: "https://api.worldbank.org/v2/country/{cc}/indicator/{ic}?format=json",
    access: "Open, no key — territories live (all 5 iso3 verified)",
    wired: true
  }
];

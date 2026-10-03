import type { Provenance } from "../provenance";
import type { JurisdictionType } from "../territory-catalog";

/**
 * sourced          — a live API returned this value in this run (provenance attached)
 * awaiting-source  — a source exists but is not wired / needs a key
 * not-published    — the upstream agency does not publish this for the jurisdiction
 * error            — the live request failed; no value is substituted
 */
export type CardFieldStatus = "sourced" | "awaiting-source" | "not-published" | "error";

export type CardFieldId =
  | "unemployment"
  | "population"
  | "epa_facilities"
  | "epa_penalties"
  | "doj_natsec"
  | "fbi_crime";

export interface CardField {
  id: CardFieldId;
  label: string;
  value: string | null;
  numeric: number | null;
  as_of: string | null;
  status: CardFieldStatus;
  source_id: string;
  note: string;
  provenance: Provenance | null;
}

export interface JurisdictionCard {
  code: string;
  name: string;
  type: JurisdictionType;
  fips: string;
  capital: string;
  lat: number;
  lng: number;
  open_data_portal: string;
  fields: CardField[];
  sourced_count: number;
  natsec_releases: NatsecRelease[];
  outliers: OutlierFlag[];
}

/** A public DOJ press release attributed to this jurisdiction via its USAO. */
export interface NatsecRelease {
  title: string;
  date: string;
  url: string;
  offices: string[];
  matched_term: string;
  provenance: Provenance;
}

/**
 * Robust statistical outlier on a sourced numeric field across jurisdictions.
 * Descriptive only: distance from the cross-jurisdiction median, not a finding.
 */
export interface OutlierFlag {
  field_id: CardFieldId;
  label: string;
  value: string;
  modified_z: number;
  direction: "high" | "low";
  median: number;
  n: number;
  scale: "linear" | "log10";
}

export interface CardBuildResult {
  generated_at: string;
  count: number;
  summary: Record<CardFieldStatus, number>;
  outlier_method: string;
  cards: JurisdictionCard[];
}

export const CARD_FIELD_ORDER: Array<{ id: CardFieldId; label: string }> = [
  { id: "unemployment", label: "Unemployment rate" },
  { id: "population", label: "Population" },
  { id: "epa_facilities", label: "EPA-regulated active facilities" },
  { id: "epa_penalties", label: "EPA total penalties (ECHO)" },
  { id: "doj_natsec", label: "DOJ national-security releases" },
  { id: "fbi_crime", label: "FBI reported violent offenses (CDE)" }
];

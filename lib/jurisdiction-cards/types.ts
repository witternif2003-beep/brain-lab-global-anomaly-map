import type { Provenance } from "../provenance";
import type { JurisdictionType } from "../territory-catalog";

/**
 * sourced          — a live API returned this value in this run (provenance attached)
 * awaiting-source  — a source exists but is not wired / needs a key
 * not-published    — the upstream agency does not publish this for the jurisdiction
 * error            — the live request failed; no value is substituted
 */
export type CardFieldStatus = "sourced" | "awaiting-source" | "not-published" | "error";

export type CardFieldId = "unemployment" | "population" | "epa_facilities" | "epa_penalties" | "fbi_crime";

export interface CardField {
  id: CardFieldId;
  label: string;
  value: string | null;
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
}

export interface CardBuildResult {
  generated_at: string;
  count: number;
  summary: Record<CardFieldStatus, number>;
  cards: JurisdictionCard[];
}

export const CARD_FIELD_ORDER: Array<{ id: CardFieldId; label: string }> = [
  { id: "unemployment", label: "Unemployment rate" },
  { id: "population", label: "Population" },
  { id: "epa_facilities", label: "EPA-regulated active facilities" },
  { id: "epa_penalties", label: "EPA total penalties (ECHO)" },
  { id: "fbi_crime", label: "FBI reported offenses (CDE)" }
];

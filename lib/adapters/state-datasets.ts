/**
 * LUCID-1 state open-data dataset registry — verified Socrata mappings.
 *
 * HONESTY PROTOCOL: a state appears here ONLY after its datasets were
 * individually verified live (metadata + row sample + SoQL sort checked from
 * this repo's research runs). Portal base URLs come from
 * lib/adapters/jurisdictions.ts; this file adds per-dataset mapping only.
 * Client-safe: data only, no node dependencies.
 */

export interface StateDatasetConfig {
  /** Stable source id, e.g. "NY-TAX-WARRANTS". */
  source_id: string;
  /** Human label for section headers. */
  label: string;
  /** Socrata 4x4 dataset id. */
  dataset_id: string;
  /** SoQL date field for newest-first ordering ("" = unsorted). */
  order_by: string;
  /** Slim field list for $select (keeps payloads small). */
  select: string[];
  /** Max record cards rendered per dataset tab visit. */
  cap: number;
}

export const STATE_DATASETS: Record<string, StateDatasetConfig[]> = {
  NY: [
    {
      source_id: "NY-TAX-WARRANTS",
      label: "NYS TAX WARRANTS — DEPT. OF TAXATION & FINANCE",
      dataset_id: "v7ua-z23v",
      order_by: "warrant_filed_date",
      select: [
        "warrant_id",
        "status_code",
        "debtor_name_1",
        "city",
        "county_code",
        "warrant_filed_amount",
        "warrant_filed_date",
        "url"
      ],
      cap: 10
    },
    {
      source_id: "NY-OIG-COMPLAINTS",
      label: "NYS OIG INVESTIGATIVE COMPLAINTS — BEGINNING 2022",
      dataset_id: "m4ux-3xxj",
      order_by: "sort_order",
      select: ["oig_office", "intake", "intake_source", "agency", "case_type", "sort_order"],
      cap: 10
    }
  ]
};

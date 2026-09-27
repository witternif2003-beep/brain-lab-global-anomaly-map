/**
 * LUCID-1 state open-data dataset registry — verified Socrata mappings.
 *
 * HONESTY PROTOCOL: a state appears here ONLY after its datasets were
 * individually verified live (metadata + row sample + SoQL sort checked from
 * this repo's research runs). Portal base URLs come from
 * lib/adapters/jurisdictions.ts; this file adds per-dataset mapping only.
 * Client-safe: data only, no node dependencies.
 *
 * Card templates render record cards generically: {field} inserts the raw
 * value, {field:money} formats USD, {field:date} truncates to YYYY-MM-DD.
 * Missing values render as "?" — never guessed.
 */

export interface StateDatasetCard {
  title: string;
  sub: string;
  link_field?: string;
  link_label?: string;
}

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
  /** Platform adapter: socrata (default) or ckan datastore. */
  platform?: "socrata" | "ckan";
  /** CKAN datastore resource id (required when platform is ckan). */
  resource_id?: string;
  /** Generic card template (see StateCard renderer). */
  card: StateDatasetCard;
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
      cap: 10,
      card: {
        title: "{warrant_filed_amount:money} TAX WARRANT — {debtor_name_1}",
        sub: "{warrant_id} • {status_code} • FILED {warrant_filed_date:date} • {city}, {county_code} CO.",
        link_field: "url",
        link_label: "WARRANT RECORD ↗"
      }
    },
    {
      source_id: "NY-OIG-COMPLAINTS",
      label: "NYS OIG INVESTIGATIVE COMPLAINTS — BEGINNING 2022",
      dataset_id: "m4ux-3xxj",
      order_by: "sort_order",
      select: ["oig_office", "intake", "intake_source", "agency", "case_type", "sort_order"],
      cap: 10,
      card: {
        title: "INTAKE {intake} — {oig_office}",
        sub: "{case_type} • {agency} • SOURCE: {intake_source} • {sort_order:date}"
      }
    }
  ],
  TX: [
    {
      source_id: "TX-TCEQ-CITATIONS",
      label: "TCEQ VIOLATION CITATIONS",
      dataset_id: "gyd4-wuys",
      order_by: "investigation_approved_date",
      select: [
        "viol_tracking_nbr",
        "curr_viol_status",
        "cnty_name",
        "invstn_typ",
        "viol_status_dt",
        "allegation_txt"
      ],
      cap: 10,
      card: {
        title: "VIOLATION {viol_tracking_nbr} — {curr_viol_status}",
        sub: "{cnty_name} CO. • {invstn_typ} • STATUS {viol_status_dt:date} • {allegation_txt}"
      }
    },
    {
      source_id: "TX-TCEQ-COMPLAINTS",
      label: "TCEQ COMPLAINTS",
      dataset_id: "tdzs-qqjn",
      order_by: "incid_rcvd_dt",
      select: [
        "incid_track_num",
        "reg_ent_name",
        "county",
        "pgm_name",
        "inc_status",
        "incid_rcvd_dt"
      ],
      cap: 10,
      card: {
        title: "COMPLAINT {incid_track_num} — {reg_ent_name}",
        sub: "{county} CO. • {pgm_name} • {inc_status} • RCVD {incid_rcvd_dt:date}"
      }
    },
    {
      source_id: "TX-TCEQ-NOE",
      label: "TCEQ NOTICES OF ENFORCEMENT",
      dataset_id: "rua3-iswk",
      order_by: "",
      select: ["rn", "reg_ent_name", "city_name", "loc_cnty_name", "invstn_no"],
      cap: 10,
      card: {
        title: "ENFORCEMENT NOTICE — {reg_ent_name}",
        sub: "{loc_cnty_name} CO. • {city_name} • INV {invstn_no} • RN {rn}"
      }
    }
  ],
  CT: [
    {
      source_id: "CT-DEEP-ENFORCEMENT",
      label: "CT DEEP FORMAL ENFORCEMENT CASES 2021–PRESENT",
      dataset_id: "t2bf-45ba",
      order_by: "date_issued",
      select: [
        "date_issued",
        "respondent",
        "town",
        "type_of_enforcement",
        "violation_citation",
        "penalty_amount"
      ],
      cap: 10,
      card: {
        title: "{penalty_amount:money} PENALTY — {respondent}",
        sub: "{type_of_enforcement} • {town} • {violation_citation} • ISSUED {date_issued:date}"
      }
    },
    {
      source_id: "CT-INS-COMPLAINTS",
      label: "CT INSURANCE COMPANY COMPLAINTS & RECOVERIES",
      dataset_id: "t64r-mt64",
      order_by: "opened",
      select: ["company", "file_no", "opened", "coverage", "reason", "disposition", "recovery", "status"],
      cap: 10,
      card: {
        title: "COMPLAINT {file_no} — {company}",
        sub: "{coverage} • {reason} • {disposition} • RECOVERY {recovery} • {status}"
      }
    }
  ],
  NJ: [
    {
      source_id: "NJ-MEDICAID-FRAUD",
      label: "NJ MEDICAID FRAUD SETTLEMENTS & ACTIONS",
      dataset_id: "3rh3-3u9n",
      order_by: "date",
      select: ["date", "provider_name", "action"],
      cap: 10,
      card: {
        title: "{action} — {provider_name}",
        sub: "{date:date}"
      }
    }
  ],
  WA: [
    {
      source_id: "WA-PDC-ENFORCEMENT",
      label: "WA PDC ENFORCEMENT CASES",
      dataset_id: "a4ma-dq6s",
      order_by: "opened",
      select: ["case", "respondent", "status", "areas_of_law", "opened", "url"],
      cap: 10,
      card: {
        title: "CASE {case} — {respondent}",
        sub: "{status} • {areas_of_law} • OPENED {opened:date}",
        link_field: "url",
        link_label: "CASE FILE ↗"
      }
    }
  ],
  OR: [
    {
      source_id: "OR-CF-PENALTIES",
      label: "OR CAMPAIGN FINANCE PENALTY NOTICES",
      dataset_id: "fku5-vh2b",
      order_by: "final_order_issue_date",
      select: ["case", "committee_name", "penalty_amount", "status", "final_order_issue_date"],
      cap: 10,
      card: {
        title: "{penalty_amount:money} PENALTY — {committee_name}",
        sub: "CASE {case} • {status} • {final_order_issue_date:date}"
      }
    }
  ],
  VA: [
    {
      source_id: "VA-VB-CODE",
      label: "VIRGINIA BEACH CODE ENFORCEMENT CASES (CITY-SOURCED)",
      dataset_id: "code-enforcement-cases1",
      platform: "ckan",
      resource_id: "a25516d2-eb93-4c0d-8586-a374abba2cc8",
      order_by: "",
      select: ["Address", "CITY", "Case_Type", "Violation", "Open_Date", "Closing_Date"],
      cap: 10,
      card: {
        title: "CODE CASE — {Case_Type}",
        sub: "{Address}, {CITY} • {Violation} • OPENED {Open_Date:date}"
      }
    }
  ],
  CA: [
    {
      source_id: "CA-WATER-EA",
      label: "CA WATER RIGHTS ENFORCEMENT ACTIONS",
      dataset_id: "california-water-rights-enforcement-actions",
      platform: "ckan",
      resource_id: "78f7c606-d672-4c09-aa03-596bbc5782cf",
      order_by: "",
      select: ["EA_CASE_NUMBER", "ENFORCEMENT_ACTION_TYPE", "INVESTIGATION_TYPE", "COUNTY_PRIMARY_POI", "INVESTIGATION_START_DATE"],
      cap: 10,
      card: {
        title: "ENFORCEMENT {EA_CASE_NUMBER} — {ENFORCEMENT_ACTION_TYPE}",
        sub: "{INVESTIGATION_TYPE} • {COUNTY_PRIMARY_POI} CO. • STARTED {INVESTIGATION_START_DATE:date}"
      }
    },
    {
      source_id: "CA-MHC-COMPLAINTS",
      label: "CA MANAGED CARE QUARTERLY PROVIDER COMPLAINTS",
      dataset_id: "quarterly-provider-complaints",
      platform: "ckan",
      resource_id: "3f9c6701-ed67-475b-b70f-e9cdf43945b4",
      order_by: "",
      select: [],
      cap: 10,
      card: {
        title: "Q{Qtr} {Year} — {Plan Name}",
        sub: "{Provider Type} • {Nature of Complaint} • {Number of Claims Received} CLAIMS"
      }
    }
  ]

};

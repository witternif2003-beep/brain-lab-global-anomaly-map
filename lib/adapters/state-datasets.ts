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
  /** Platform adapter: socrata (default), ckan datastore, arcgis layer, or direct csv. */
  platform?: "socrata" | "ckan" | "arcgis" | "csv";
  /** CKAN datastore resource id (required when platform is ckan). */
  resource_id?: string;
  /** Optional SoQL $where guard (e.g. drop junk null-key rows that sort first). */
  where?: string;
  /** Layer/CSV endpoint for arcgis + csv platforms ("ckan-package:<name>" auto-resolves). */
  service_url?: string;
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
    },
    {
      source_id: "CA-SI-FRAUD",
      label: "CA SUSPENDED & INELIGIBLE PROVIDER LIST (FRAUD)",
      dataset_id: "provider-suspended-and-ineligible-list-si-list",
      platform: "csv",
      service_url: "ckan-package:provider-suspended-and-ineligible-list-si-list",
      order_by: "Date of Suspension",
      select: [
        "Last Name",
        "First Name",
        "Middle Name",
        "Provider Type",
        "License Number",
        "Provider Number",
        "Date of Suspension",
        "Active Period",
        "Address(es)"
      ],
      cap: 10,
      card: {
        title: "{Last Name}, {First Name} — {Provider Type}",
        sub: "LIC {License Number} • SUSPENDED {Date of Suspension} • {Active Period}"
      }
    }
  ],
  PA: [
    {
      source_id: "PA-HR-COMPLAINTS",
      label: "PA HUMAN RELATIONS DISCRIMINATION COMPLAINTS",
      dataset_id: "i3hm-qnwp",
      order_by: "",
      select: ["state_fiscal_year", "subject_area", "act_of_harm", "protected_class", "allegations"],
      cap: 10,
      card: {
        title: "{subject_area} — {act_of_harm}",
        sub: "FY{state_fiscal_year} • {protected_class} • {allegations}"
      }
    }
  ],
  MO: [
    {
      source_id: "MO-KCPD-CRIME",
      label: "KANSAS CITY KCPD CRIME DATA 2026 (CITY-SOURCED)",
      dataset_id: "f7wj-ckmw",
      order_by: "report_date",
      select: ["offense", "description", "report", "address", "city", "report_date"],
      cap: 10,
      card: {
        title: "{offense} — {description}",
        sub: "REPORT {report} • {address}, {city} • {report_date:date}"
      }
    },
    {
      source_id: "MO-KC-VIOLATIONS",
      label: "KANSAS CITY CODE VIOLATIONS (CITY-SOURCED)",
      dataset_id: "vq3e-m9ge",
      order_by: "date_found",
      select: ["violationid", "ordinance", "casenumber", "street_address", "vio_status", "date_found"],
      cap: 10,
      card: {
        title: "VIOLATION {violationid} — {ordinance}",
        sub: "CASE {casenumber} • {street_address} • {vio_status} • FOUND {date_found:date}"
      }
    }
  ],
  IL: [
    {
      source_id: "IL-URBANA-ARRESTS",
      label: "URBANA POLICE ARRESTS (CITY-SOURCED)",
      dataset_id: "s2ps-ct5e",
      order_by: "date_of_arrest",
      where: "incident_number IS NOT NULL",
      select: ["incident_number", "crime_code_description", "arrest_type_description", "date_of_arrest", "statute"],
      cap: 10,
      card: {
        title: "ARREST {incident_number} — {crime_code_description}",
        sub: "{arrest_type_description} • {date_of_arrest:date} • {statute}"
      }
    },
    {
      source_id: "IL-URBANA-NUISANCE",
      label: "URBANA NUISANCE COMPLAINTS (CITY-SOURCED)",
      dataset_id: "64q4-57u5",
      order_by: "date_reported",
      select: ["file_number", "type_of_complaint", "street_name", "disposition", "date_reported"],
      cap: 10,
      card: {
        title: "NUISANCE {file_number} — {type_of_complaint}",
        sub: "{street_name} • {disposition} • REPORTED {date_reported:date}"
      }
    }
  ],
  VT: [
    {
      source_id: "VT-STALBANS-STOPS",
      label: "ST. ALBANS TRAFFIC STOP DATA 2021 (CITY-SOURCED)",
      dataset_id: "qdts-zasz",
      order_by: "",
      select: ["incident_number", "call_type", "ticket_violation", "stop_based_on", "issued_to_gender", "issued_to_age"],
      cap: 10,
      card: {
        title: "STOP {incident_number} — {call_type}",
        sub: "{ticket_violation} • {stop_based_on} • {issued_to_gender}/{issued_to_age}"
      }
    }
  ],
  CO: [
    {
      source_id: "CO-BOULDER-INSP",
      label: "BOULDER COUNTY RESTAURANT INSPECTIONS (COUNTY-SOURCED)",
      dataset_id: "6ytb-f2cq",
      order_by: "rec_date",
      select: ["name", "result", "address", "b1_situs_city", "score", "rec_date"],
      cap: 10,
      card: {
        title: "{name} — {result}",
        sub: "{address}, {b1_situs_city} • SCORE {score} • {rec_date:date}"
      }
    },
    {
      source_id: "CO-ARRESTS",
      label: "CO ARREST TOTALS BY AGENCY-YEAR (AGGREGATED)",
      dataset_id: "xi5f-mkzt",
      order_by: "year",
      select: ["agency", "year", "drivingundertheinfluence", "drugabuseviolationsgrandtotal", "aggravatedassault", "burglary"],
      cap: 10,
      card: {
        title: "{agency} — {year}",
        sub: "DUI {drivingundertheinfluence} • DRUG {drugabuseviolationsgrandtotal} • ASSAULT {aggravatedassault} • BURGLARY {burglary}"
      }
    }
  ],
  DC: [
    {
      source_id: "DC-CRIME30",
      label: "DC MPD CRIME INCIDENTS — LAST 30 DAYS",
      dataset_id: "dc3289eab3d2400ea49c154863312434",
      platform: "arcgis",
      service_url: "https://maps2.dcgis.dc.gov/dcgis/rest/services/FEEDS/MPD/FeatureServer/39",
      order_by: "REPORT_DAT",
      select: ["CCN", "REPORT_DAT", "OFFENSE", "METHOD", "BLOCK", "WARD", "DISTRICT"],
      cap: 10,
      card: {
        title: "{OFFENSE} — {METHOD}",
        sub: "CCN {CCN} • {BLOCK} • WARD {WARD} • {REPORT_DAT:epoch}"
      }
    },
    {
      source_id: "DC-ARRESTS",
      label: "DC MPD ADULT ARRESTS",
      dataset_id: "f51106084ee148ab858013c3e32634d2",
      platform: "arcgis",
      service_url: "https://maps2.dcgis.dc.gov/dcgis/rest/services/DCGIS_DATA/Public_Safety_WebMercator/MapServer/38",
      order_by: "DATE_",
      select: ["ARREST_NUMBER", "CATEGORY", "DESCRIPTION", "AGE", "SEX", "DEFENDANT_DISTRICT", "DATE_"],
      cap: 10,
      card: {
        title: "ARREST {ARREST_NUMBER} — {CATEGORY}",
        sub: "{DESCRIPTION} • AGE {AGE} • {SEX} • {DEFENDANT_DISTRICT} • {DATE_:epoch}"
      }
    }
  ]

};

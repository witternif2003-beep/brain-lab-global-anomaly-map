import { EAVS_2024_REGISTRATION, EAVS_2024_SOURCE } from "./eavs-2024-registration";
import { REGISTRATION_2026, type Registration2026 } from "./registration-2026";

export interface EavsRegistrationRow {
  jurisdictions: number;
  reported: number;
  total: number;
  active: number;
  inactive: number;
}

export interface RegistrationFigure {
  status: "sourced" | "partial" | "not-published";
  total: number | null;
  active: number | null;
  inactive: number | null;
  reportingJurisdictions: number;
  jurisdictions: number;
  note: string;
  source: typeof EAVS_2024_SOURCE;
  /** Latest 2026 count from the jurisdiction's own election office, or null when none was found. */
  current: Registration2026 | null;
  currentNote: string;
}

/** North Dakota has no voter registration, so EAVS carries no A1a value there. */
const NO_REGISTRATION: Record<string, string> = {
  ND: "North Dakota does not register voters, so EAVS has no registration count for it."
};

export function registrationFor(code: string): RegistrationFigure {
  const row = EAVS_2024_REGISTRATION[code];
  const current = REGISTRATION_2026[code] ?? null;
  const currentNote = current
    ? `${current.publisher} report as of ${current.asOf}${current.measure ? ` (${current.measure})` : ""}.`
    : code in NO_REGISTRATION
      ? NO_REGISTRATION[code]
      : "No 2026 statewide count could be read from the official election office; showing the EAVS 2024 baseline only.";
  const base = {
    source: EAVS_2024_SOURCE,
    jurisdictions: row?.jurisdictions ?? 0,
    reportingJurisdictions: row?.reported ?? 0,
    current,
    currentNote
  };
  if (!row || row.reported === 0) {
    return {
      ...base,
      status: "not-published",
      total: null,
      active: null,
      inactive: null,
      note: NO_REGISTRATION[code] ?? "No EAVS 2024 registration count was reported for this jurisdiction."
    };
  }
  const partial = row.reported < row.jurisdictions;
  return {
    ...base,
    status: partial ? "partial" : "sourced",
    total: row.total,
    active: row.active,
    inactive: row.inactive,
    note: partial
      ? `Sum of the ${row.reported} of ${row.jurisdictions} local jurisdictions that reported a total; the rest are EAVS missing-data codes.`
      : `Sum over all ${row.jurisdictions} reporting local jurisdiction${row.jurisdictions === 1 ? "" : "s"}.`
  };
}

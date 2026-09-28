import { EAVS_2024_REGISTRATION, EAVS_2024_SOURCE } from "./eavs-2024-registration";

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
}

/** North Dakota has no voter registration, so EAVS carries no A1a value there. */
const NO_REGISTRATION: Record<string, string> = {
  ND: "North Dakota does not register voters, so EAVS has no registration count for it."
};

export function registrationFor(code: string): RegistrationFigure {
  const row = EAVS_2024_REGISTRATION[code];
  const base = { source: EAVS_2024_SOURCE, jurisdictions: row?.jurisdictions ?? 0, reportingJurisdictions: row?.reported ?? 0 };
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

/**
 * Voter-registration dashboard types.
 *
 * HONESTY PROTOCOL: this tab serves ONLY (a) live probes of the official
 * election-office websites as listed by the USA.gov state directory, (b)
 * aggregate registered-voter totals from the EAC 2024 Election Administration
 * and Voting Survey, and (c) justice.gov press releases the runtime can
 * actually retrieve. No voter file and no person-level registration data
 * exists in any public source used here, so no per-voter matching, scanning,
 * or citizenship flagging is possible — and none is attempted.
 */
import type { Provenance } from "../provenance";

export type JurisdictionCode =
  | "AL" | "AK" | "AZ" | "AR" | "CA" | "CO" | "CT" | "DE" | "FL" | "GA"
  | "HI" | "ID" | "IL" | "IN" | "IA" | "KS" | "KY" | "LA" | "ME" | "MD"
  | "MA" | "MI" | "MN" | "MS" | "MO" | "MT" | "NE" | "NV" | "NH" | "NJ"
  | "NM" | "NY" | "NC" | "ND" | "OH" | "OK" | "OR" | "PA" | "RI" | "SC"
  | "SD" | "TN" | "TX" | "UT" | "VT" | "VA" | "WA" | "WV" | "WI" | "WY"
  | "DC" | "PR" | "GU" | "VI" | "AS" | "MP";

/** Pinned roster entry — office URL exactly as listed by USA.gov. */
export interface ElectionOffice {
  code: JurisdictionCode;
  jurisdiction: string;
  /** USA.gov state-hub slug, e.g. "new-york", "u-s-virgin-islands". */
  usaGovSlug: string;
  /** Official election-office URL from the hub page's election-office field. */
  officeUrl: string;
  /** USA.gov's own link label for the office (verbatim). */
  officeLabel: string;
  /** When the roster entry was last verified against the live directory. */
  directoryVerifiedAt: string;
}

export type ReliabilityBand = "high" | "medium" | "low";

/** One live probe of an office website — observed values only. */
export interface SiteProbe {
  code: string;
  url: string;
  httpStatus: number | null;
  latencyMs: number | null;
  /** Live <title> of the fetched page (null when not retrievable). */
  pageTitle: string | null;
  /** sha256 of the visible page text actually fetched. */
  sha256VisibleText: string | null;
  visibleTextChars: number | null;
  /** Whether the visible text names its own jurisdiction (heuristic). */
  namesJurisdiction: boolean | null;
  band: ReliabilityBand;
  checkedAt: string;
  error: string | null;
  provenance: Provenance | null;
}

/** Aggregate EAVS totals — counts of registrations, never persons. */
export interface EavsTotals {
  code: string;
  surveyYear: number;
  surveyName: string;
  totalRegistered: number | null;
  totalActive: number | null;
  totalInactive: number | null;
  /** Jurisdictions responding / reporting for the total column. */
  coverageResponded: number;
  coverageOf: number;
  /** Human note when totals are absent or partial (e.g. ND, inactive n/a). */
  note: string | null;
  provenance: Provenance | null;
}

export interface DojRelease {
  title: string;
  url: string;
  publishedAt: string | null;
  component: string | null;
  /** How this release was attributed to the jurisdiction (keyword match). */
  attribution: string;
}

export interface VoterDashboardCard {
  office: ElectionOffice;
  probe: SiteProbe | null;
  eavs: EavsTotals | null;
  dojReleases: DojRelease[];
}

export interface VoterDashboard {
  generatedAt: string;
  cards: VoterDashboardCard[];
  /** Feeds/sections that failed at runtime — never substituted. */
  unavailable: string[];
  dojAvailable: boolean;
}

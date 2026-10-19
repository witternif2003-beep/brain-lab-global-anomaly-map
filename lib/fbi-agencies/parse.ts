/**
 * FBI Crime Data Explorer (CDE) Georgia agency directory and per-agency summarized offences.
 * Public backend, no key: https://cde.ucr.cjis.gov/LATEST/agency/byStateAbbr/GA and
 * /LATEST/summarized/agency/{ORI}/{offense}?from=MM-YYYY&to=MM-YYYY (verified 2026-10-19).
 */
export const CDE_PUBLIC = "https://cde.ucr.cjis.gov/LATEST";
export const CDE_WEBAPP = "https://cde.ucr.cjis.gov/LATEST/webapp/#/pages/explorer/crime/crime-trend";
export const GA_ORI = /^GA[0-9A-Z]{7}$/;

export const AGENCY_TYPES = [
  { type: "City", color: "#ff2bd6" },
  { type: "County", color: "#0abab5" },
  { type: "University or College", color: "#b388ff" },
  { type: "State Police", color: "#00e5ff" },
  { type: "Other State Agency", color: "#76ff03" },
  { type: "Other", color: "#f8fafc" },
] as const;

export const OFFENSES = [
  { id: "violent-crime", label: "Violent crime", color: "#ff2e88" },
  { id: "homicide", label: "Homicide", color: "#ff1744" },
  { id: "rape", label: "Rape", color: "#e040fb" },
  { id: "robbery", label: "Robbery", color: "#7c4dff" },
  { id: "aggravated-assault", label: "Aggravated assault", color: "#ff80ab" },
  { id: "property-crime", label: "Property crime", color: "#0abab5" },
  { id: "burglary", label: "Burglary", color: "#00e5ff" },
  { id: "larceny", label: "Larceny-theft", color: "#1de9b6" },
  { id: "motor-vehicle-theft", label: "Motor vehicle theft", color: "#76ff03" },
  { id: "arson", label: "Arson", color: "#ff3d00" },
] as const;
export type OffenseId = (typeof OFFENSES)[number]["id"];

/** Police light-bar pair used for new-record strobes. */
export const POLICE_RED = "#ff1744";
export const POLICE_BLUE = "#2979ff";

export interface RawAgency {
  ori?: string;
  counties?: string | null;
  is_nibrs?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  state_abbr?: string;
  agency_name?: string;
  agency_type_name?: string;
  nibrs_start_date?: string | null;
}

export interface Agency {
  ori: string;
  name: string;
  type: string;
  counties: string;
  nibrs: boolean;
  nibrsStart: string | null;
  lat: number | null;
  lon: number | null;
}

const inGeorgia = (lat: number, lon: number) => lat >= 30.3 && lat <= 35.1 && lon >= -85.7 && lon <= -80.7;
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Flattens the county-keyed directory, de-duplicates by ORI, keeps Georgia ORIs and drops coordinates outside Georgia. */
export function parseAgencyDirectory(raw: Record<string, RawAgency[] | undefined>): Agency[] {
  const byOri = new Map<string, Agency>();
  for (const list of Object.values(raw)) {
    for (const a of list ?? []) {
      if (!a.ori || !GA_ORI.test(a.ori) || byOri.has(a.ori)) continue;
      const lat = num(a.latitude);
      const lon = num(a.longitude);
      const placed = lat !== null && lon !== null && inGeorgia(lat, lon);
      byOri.set(a.ori, {
        ori: a.ori,
        name: a.agency_name?.trim() || a.ori,
        type: a.agency_type_name?.trim() || "Other",
        counties: a.counties?.trim() ?? "",
        nibrs: a.is_nibrs === true,
        nibrsStart: a.nibrs_start_date ?? null,
        lat: placed ? lat : null,
        lon: placed ? lon : null,
      });
    }
  }
  return [...byOri.values()].sort((x, y) => x.ori.localeCompare(y.ori));
}

export const agencyTypeColor = (type: string) => AGENCY_TYPES.find((t) => t.type === type)?.color ?? "#f8fafc";

export interface AgencyCategory {
  type: string;
  nibrs: boolean;
  color: string;
  count: number;
}

/** Agency type × NIBRS status, with counts measured from the directory. */
export function agencyCategories(agencies: Agency[]): AgencyCategory[] {
  const m = new Map<string, AgencyCategory>();
  for (const a of agencies) {
    const k = `${a.type}|${a.nibrs}`;
    const c = m.get(k) ?? { type: a.type, nibrs: a.nibrs, color: agencyTypeColor(a.type), count: 0 };
    c.count++;
    m.set(k, c);
  }
  return [...m.values()].sort((a, b) => b.count - a.count);
}

type Series = Record<string, number | null | undefined>;
export interface CdeAgencySummarized {
  offenses?: { actuals?: Record<string, Series> };
  cde_properties?: { max_data_date?: { UCR?: string }; last_refresh_date?: { UCR?: string } };
}

export interface OffenseSeries {
  offense: OffenseId;
  label: string;
  color: string;
  /** MM-YYYY keys, oldest first: the 12 months ending at the agency's latest published month. */
  months: string[];
  offenses: (number | null)[];
  clearances: (number | null)[];
  total: number | null;
  latestMonth: string | null;
  latest: number | null;
  /** True when the newest month the FBI has published (max_data_date) has at least one reported offence. */
  newInLatestFbiMonth: boolean;
}

const monthOrder = (k: string) => `${k.slice(3)}-${k.slice(0, 2)}`;

/** Agency series are the `actuals` keys that are neither the Georgia nor the United States comparison rows. */
export function parseAgencySummarized(offense: OffenseId, raw: CdeAgencySummarized): OffenseSeries {
  const meta = OFFENSES.find((o) => o.id === offense)!;
  const actuals = raw.offenses?.actuals ?? {};
  const local = (suffix: string) =>
    Object.entries(actuals).find(([k]) => k.endsWith(suffix) && !k.startsWith("Georgia ") && !k.startsWith("United States "))?.[1] ?? {};
  const off = local(" Offenses");
  const clr = local(" Clearances");
  const all = Object.keys(off).sort((a, b) => monthOrder(a).localeCompare(monthOrder(b)));
  let end = all.length;
  while (end > 0 && num(off[all[end - 1]]) === null) end--;
  const months = all.slice(Math.max(0, end - 12), end);
  const offenses = months.map((k) => num(off[k]));
  const reported = offenses.filter((v): v is number => v !== null);
  let li = -1;
  offenses.forEach((v, i) => v !== null && (li = i));
  const maxDate = raw.cde_properties?.max_data_date?.UCR;
  const maxKey = maxDate && /^\d{2}\/\d{4}$/.test(maxDate) ? maxDate.replace("/", "-") : null;
  const latestMonth = li >= 0 ? months[li] : null;
  const latest = li >= 0 ? offenses[li] : null;
  return {
    offense,
    label: meta.label,
    color: meta.color,
    months,
    offenses,
    clearances: months.map((k) => num(clr[k])),
    total: reported.length ? reported.reduce((a, b) => a + b, 0) : null,
    latestMonth,
    latest,
    newInLatestFbiMonth: !!maxKey && latestMonth === maxKey && (latest ?? 0) > 0,
  };
}

export type IntegrityState = "VERIFIED" | "STALE" | "NO TIMESTAMP" | "ERROR" | "INTERNAL";

export const INTEGRITY_COLORS: Record<IntegrityState, string> = {
  VERIFIED: "#0abab5",
  STALE: "#b388ff",
  "NO TIMESTAMP": "#94a3b8",
  ERROR: "#ff1744",
  INTERNAL: "#475569",
};

/**
 * Source-integrity badge for a live feed: ERROR if the last fetch failed, INTERNAL if it has no public https source,
 * NO TIMESTAMP if the source gave no retrieval time, STALE past `staleMin`, otherwise VERIFIED.
 */
export function integrityState(f: { sourceUrl: string; updatedAt: string | null; error?: string | null }, now: number, staleMin: number): IntegrityState {
  if (f.error) return "ERROR";
  if (!/^https:\/\//.test(f.sourceUrl)) return "INTERNAL";
  const t = f.updatedAt ? Date.parse(f.updatedAt) : NaN;
  if (!Number.isFinite(t)) return "NO TIMESTAMP";
  return now - t > staleMin * 60_000 ? "STALE" : "VERIFIED";
}

/** Police light-bar strobe: red and blue swap every `halfMs`. */
export const policeStrobeColor = (now: number, halfMs = 240) => (Math.floor(now / halfMs) % 2 ? POLICE_BLUE : POLICE_RED);

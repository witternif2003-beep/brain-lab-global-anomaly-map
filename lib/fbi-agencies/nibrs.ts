/**
 * FBI CDE NIBRS agency detail: https://cde.ucr.cjis.gov/LATEST/nibrs/agency/{ORI}/{code}?from=MM-YYYY&to=MM-YYYY
 * (public, no key; verified 2026-10-19). Responses carry victim/offender breakdowns, not an incident count.
 * Unknown codes and codes with no published data both come back as all-null breakdowns.
 */
export type CrimeAgainst = "Persons" | "Property" | "Society";

const RAW: [string, string, CrimeAgainst][] = [
  ["09A", "Murder & nonnegligent manslaughter", "Persons"],
  ["09B", "Negligent manslaughter", "Persons"],
  ["09C", "Justifiable homicide", "Persons"],
  ["100", "Kidnapping/abduction", "Persons"],
  ["11A", "Rape", "Persons"],
  ["11B", "Sodomy", "Persons"],
  ["11C", "Sexual assault with an object", "Persons"],
  ["11D", "Fondling", "Persons"],
  ["13A", "Aggravated assault", "Persons"],
  ["13B", "Simple assault", "Persons"],
  ["13C", "Intimidation", "Persons"],
  ["36A", "Incest", "Persons"],
  ["36B", "Statutory rape", "Persons"],
  ["64A", "Human trafficking, commercial sex acts", "Persons"],
  ["64B", "Human trafficking, involuntary servitude", "Persons"],
  ["120", "Robbery", "Property"],
  ["200", "Arson", "Property"],
  ["210", "Extortion/blackmail", "Property"],
  ["220", "Burglary/breaking & entering", "Property"],
  ["23A", "Pocket-picking", "Property"],
  ["23B", "Purse-snatching", "Property"],
  ["23C", "Shoplifting", "Property"],
  ["23D", "Theft from building", "Property"],
  ["23E", "Theft from coin-operated machine", "Property"],
  ["23F", "Theft from motor vehicle", "Property"],
  ["23G", "Theft of motor vehicle parts", "Property"],
  ["23H", "All other larceny", "Property"],
  ["240", "Motor vehicle theft", "Property"],
  ["250", "Counterfeiting/forgery", "Property"],
  ["26A", "False pretenses/swindle", "Property"],
  ["26B", "Credit card/ATM fraud", "Property"],
  ["26C", "Impersonation", "Property"],
  ["26D", "Welfare fraud", "Property"],
  ["26E", "Wire fraud", "Property"],
  ["26F", "Identity theft", "Property"],
  ["26G", "Hacking/computer invasion", "Property"],
  ["26H", "Money laundering", "Property"],
  ["270", "Embezzlement", "Property"],
  ["280", "Stolen property offenses", "Property"],
  ["290", "Destruction/damage/vandalism", "Property"],
  ["510", "Bribery", "Property"],
  ["35A", "Drug/narcotic violations", "Society"],
  ["35B", "Drug equipment violations", "Society"],
  ["370", "Pornography/obscene material", "Society"],
  ["39A", "Betting/wagering", "Society"],
  ["39B", "Operating/promoting gambling", "Society"],
  ["39C", "Gambling equipment violations", "Society"],
  ["39D", "Sports tampering", "Society"],
  ["40A", "Prostitution", "Society"],
  ["40B", "Assisting/promoting prostitution", "Society"],
  ["40C", "Purchasing prostitution", "Society"],
  ["520", "Weapon law violations", "Society"],
  ["720", "Animal cruelty", "Society"],
];

/** Hue bands per crime-against group (degrees); amber/brown (25–50°) is avoided. */
const BANDS: Record<CrimeAgainst, [number, number]> = { Persons: [300, 365], Property: [160, 205], Society: [235, 290] };
export const GROUP_COLORS: Record<CrimeAgainst, string> = { Persons: "#ff2e88", Property: "#0abab5", Society: "#b388ff" };

export interface NibrsOffense {
  code: string;
  label: string;
  against: CrimeAgainst;
  color: string;
}

export const NIBRS_OFFENSES: NibrsOffense[] = (() => {
  const idx: Record<CrimeAgainst, number> = { Persons: 0, Property: 0, Society: 0 };
  const n: Record<CrimeAgainst, number> = { Persons: 0, Property: 0, Society: 0 };
  for (const [, , g] of RAW) n[g]++;
  return RAW.map(([code, label, against]) => {
    const [a, b] = BANDS[against];
    const h = Math.round(a + ((b - a) * idx[against]++) / Math.max(1, n[against] - 1)) % 360;
    return { code, label, against, color: `hsl(${h} 100% 62%)` };
  });
})();

export const NIBRS_CODE = /^[0-9]{2}[0-9A-H]$/;

type Counts = Record<string, number | null | undefined>;
export interface CdeNibrsAgency {
  victim?: { sex?: Counts; location?: Counts };
  offense?: { weapons?: Counts };
  offender?: { sex?: Counts };
}

export interface NibrsCount {
  code: string;
  label: string;
  against: CrimeAgainst;
  color: string;
  /** Sum of the FBI's victim-by-sex counts; null when the FBI published no breakdown. */
  victims: number | null;
  offenders: number | null;
  topLocation: string | null;
  topWeapon: string | null;
}

function sum(c: Counts | undefined): number | null {
  const vals = Object.values(c ?? {}).filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
}

function top(c: Counts | undefined, skip: string[]): string | null {
  const best = Object.entries(c ?? {})
    .filter(([k, v]) => typeof v === "number" && v > 0 && !skip.includes(k))
    .sort((a, b) => (b[1] as number) - (a[1] as number))[0];
  return best ? best[0] : null;
}

export interface NibrsRow extends NibrsCount {
  latestVictims: number | null;
  latestOffenders: number | null;
  /** Victims or offenders reported in the newest month the FBI has published. */
  newInLatestFbiMonth: boolean;
}

/** Trailing 12-month window ending at the FBI's newest published month (`MM/YYYY`), or the last full calendar year when unknown. */
export function nibrsWindow(maxDataDate: string | null | undefined, now: Date): { from: string; to: string; latest: string | null } {
  const m = maxDataDate && /^(\d{2})\/(\d{4})$/.exec(maxDataDate);
  if (!m) {
    const y = now.getUTCFullYear() - 1;
    return { from: `01-${y}`, to: `12-${y}`, latest: null };
  }
  const month = Number(m[1]);
  const year = Number(m[2]);
  const start = new Date(Date.UTC(year, month - 12, 1));
  const to = `${m[1]}-${m[2]}`;
  return { from: `${String(start.getUTCMonth() + 1).padStart(2, "0")}-${start.getUTCFullYear()}`, to, latest: to };
}

export function parseNibrsAgency(code: string, raw: CdeNibrsAgency): NibrsCount {
  const meta = NIBRS_OFFENSES.find((o) => o.code === code) ?? { code, label: code, against: "Society" as const, color: GROUP_COLORS.Society };
  return {
    ...meta,
    victims: sum(raw.victim?.sex),
    offenders: sum(raw.offender?.sex),
    topLocation: top(raw.victim?.location, ["Unknown", "Not Specified"]),
    topWeapon: top(raw.offense?.weapons, ["None", "Unknown", "Not Specified"]),
  };
}

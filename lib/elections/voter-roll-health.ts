/** Aggregate voter-roll health metrics (EAC 2024 EAVS ÷ Census 2020–2024 CVAP). County level or higher only. */

export interface VoterRollStateRow {
  level: "state";
  fips: string;
  geography: string;
  state: string;
  eavs_units: number;
  registered_total: number | null;
  active: number | null;
  inactive: number | null;
  removed_2022_2024: number | null;
  confirmation_notices_2022_2024: number | null;
  cvap_est: number | null;
  cvap_moe: number | null;
  active_pct_cvap: number | null;
  inactive_pct: number | null;
  removed_per_1000_active: number | null;
  data_note: string;
  counties: number;
  counties_with_rate: number;
}

export type MetricKey = "ar" | "ir" | "rm";

export interface MetricSpec {
  key: MetricKey;
  stateField: "active_pct_cvap" | "inactive_pct" | "removed_per_1000_active";
  label: string;
  formula: string;
  unit: string;
  breaks: number[];
}

export const METRICS: MetricSpec[] = [
  {
    key: "ar",
    stateField: "active_pct_cvap",
    label: "Active registration rate",
    formula: "Active registered voters (EAVS A1b) ÷ citizen voting-age population (CVAP) × 100",
    unit: "%",
    breaks: [70, 80, 90, 100, 110]
  },
  {
    key: "ir",
    stateField: "inactive_pct",
    label: "Inactive rate",
    formula: "Inactive registrants (EAVS A1c) ÷ total registered (A1a) × 100",
    unit: "%",
    breaks: [5, 10, 15, 20, 30]
  },
  {
    key: "rm",
    stateField: "removed_per_1000_active",
    label: "List-maintenance removals",
    formula: "Records removed Nov 2022 → Nov 2024 (EAVS A12a) per 1,000 active voters (A1b)",
    unit: " per 1,000",
    breaks: [25, 50, 100, 150, 250]
  }
];

/** Paul Tol "light" qualitative scheme (personal.sron.nl/~pault). */
export const TOL_LIGHT = ["#99DDFF", "#77AADD", "#44BB99", "#BBCC33", "#EEDD88", "#EE8866", "#FFAABB", "#AAAA00", "#DDDDDD"] as const;
export const LIGHTEN = 0.2;
export const INK = "#0B0E14";
export const INSUFFICIENT_LABEL = "Insufficient data";

/** Mix a #RRGGBB colour toward white by `amount` (0–1). */
export function lighten(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * amount));
  return "#" + ch.map((c) => c.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

/** WCAG 2.x contrast ratio. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

export const BIN_COLORS = TOL_LIGHT.slice(0, 6).map((c) => lighten(c, LIGHTEN));
export const INSUFFICIENT_COLOR = lighten(TOL_LIGHT[8], LIGHTEN);

/** Bin index for a value, or null when the value is missing (fail closed — never interpolated). */
export function binIndex(value: number | null | undefined, breaks: number[]): number | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  let i = 0;
  while (i < breaks.length && value >= breaks[i]) i++;
  return i;
}

export function colorFor(value: number | null | undefined, breaks: number[]): string {
  const i = binIndex(value, breaks);
  return i === null ? INSUFFICIENT_COLOR : BIN_COLORS[i];
}

export function formatMetric(value: number | null | undefined, unit: string): string {
  return value === null || value === undefined ? INSUFFICIENT_LABEL : `${value.toLocaleString("en-US")}${unit}`;
}

export function legend(spec: MetricSpec): { color: string; label: string }[] {
  const b = spec.breaks;
  const rows = b.map((v, i) => ({ color: BIN_COLORS[i], label: i === 0 ? `< ${v}${spec.unit}` : `${b[i - 1]}–${v}${spec.unit}` }));
  rows.push({ color: BIN_COLORS[b.length], label: `≥ ${b[b.length - 1]}${spec.unit}` });
  rows.push({ color: INSUFFICIENT_COLOR, label: INSUFFICIENT_LABEL });
  return rows;
}

/** MapLibre `step` expression; missing values (null) fall to the insufficient colour. */
export function fillExpression(spec: MetricSpec): unknown[] {
  const step: unknown[] = ["step", ["get", spec.key], BIN_COLORS[0]];
  spec.breaks.forEach((v, i) => step.push(v, BIN_COLORS[i + 1]));
  return ["case", ["==", ["typeof", ["get", spec.key]], "number"], step, INSUFFICIENT_COLOR];
}

export const COUNTY_LABEL_MIN_ZOOM = 6;
export const COUNTY_FILL_MIN_ZOOM = 4.5;

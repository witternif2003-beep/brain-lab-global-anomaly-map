/**
 * Robust outlier detection over sourced card fields (Iglewicz & Hoaglin
 * modified z-score). For each field, over jurisdictions where it is sourced:
 *   z_i = 0.6745 * (x_i - median) / MAD
 * falling back to (x_i - median) / (1.253314 * meanAbsDev) when MAD = 0.
 * |z| > 3.5 is flagged. Heavy-tailed magnitudes (counts, dollars, people)
 * are compared on log10(1 + x). Flags describe distribution position only.
 */
import type { CardField, CardFieldId, JurisdictionCard, OutlierFlag } from "./types";

export const OUTLIER_THRESHOLD = 3.5;
const MIN_N = 8;

const SCALE: Partial<Record<CardFieldId, "linear" | "log10">> = {
  unemployment: "linear",
  population: "log10",
  epa_facilities: "log10",
  epa_penalties: "log10",
  doj_natsec: "log10"
};

export const OUTLIER_METHOD =
  `Modified z-score (Iglewicz & Hoaglin), |z| > ${OUTLIER_THRESHOLD}, n >= ${MIN_N} sourced jurisdictions; ` +
  "log10(1+x) for population, EPA facilities, EPA penalties and DOJ release counts. Statistical position only, not a finding.";

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function computeOutliers(cards: JurisdictionCard[]): Map<string, OutlierFlag[]> {
  const out = new Map<string, OutlierFlag[]>(cards.map((c) => [c.code, []]));
  for (const [id, scale] of Object.entries(SCALE) as Array<[CardFieldId, "linear" | "log10"]>) {
    const pts: Array<{ code: string; f: CardField; x: number }> = [];
    for (const c of cards) {
      const f = c.fields.find((ff) => ff.id === id);
      if (f?.status === "sourced" && f.numeric !== null && Number.isFinite(f.numeric)) {
        pts.push({ code: c.code, f, x: scale === "log10" ? Math.log10(1 + Math.max(0, f.numeric)) : f.numeric });
      }
    }
    if (pts.length < MIN_N) continue;
    const xs = pts.map((p) => p.x);
    const med = median(xs);
    const mad = median(xs.map((x) => Math.abs(x - med)));
    const meanAd = xs.reduce((a, x) => a + Math.abs(x - med), 0) / xs.length;
    if (mad === 0 && meanAd === 0) continue;
    for (const p of pts) {
      const z = mad > 0 ? (0.6745 * (p.x - med)) / mad : (p.x - med) / (1.253314 * meanAd);
      if (Math.abs(z) <= OUTLIER_THRESHOLD) continue;
      out.get(p.code)?.push({
        field_id: id,
        label: p.f.label,
        value: p.f.value ?? "",
        modified_z: Math.round(z * 100) / 100,
        direction: z > 0 ? "high" : "low",
        median: scale === "log10" ? Math.round(10 ** med - 1) : Math.round(med * 100) / 100,
        n: pts.length,
        scale
      });
    }
  }
  return out;
}

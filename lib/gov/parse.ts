/** Unknown-safe JSON navigation helpers for binding extractors. */

export const rec = (v: unknown): Record<string, unknown> =>
  typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {};

export const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

export const str = (v: unknown, max = 90): string => {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
};

export const num = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

export const money = (v: unknown): string => {
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
};

export const isoDate = (v: unknown): string => {
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(v > 1e12 ? v : v * 1000);
    return Number.isNaN(d.getTime()) ? "—" : d.toISOString().slice(0, 10);
  }
  if (typeof v === "string" && v.length >= 10) return v.slice(0, 10);
  return "—";
};

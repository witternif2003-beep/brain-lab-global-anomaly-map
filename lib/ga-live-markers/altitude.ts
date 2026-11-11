import type { LiveValue } from "./parse";

const finite = (v: LiveValue | undefined) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

/** Height the 3D model is drawn at: GNSS altitude corrected to mean sea level (GEOID18), else pressure altitude. */
export function aircraftAltitude(p: Record<string, LiveValue>): { ft: number; ref: "MSL" | "PA" } | null {
  const msl = finite(p.altMslFt);
  if (msl !== null) return { ft: Math.round(msl), ref: "MSL" };
  const baro = finite(p.altFt);
  return baro === null ? null : { ft: Math.round(baro), ref: "PA" };
}

/** Climb/descent arrow with rate in ft/min; level flight (under 100 ft/min) shows nothing. */
export function vRateTag(p: Record<string, LiveValue>): string {
  const r = finite(p.vRateFpm);
  if (r === null || Math.abs(r) < 100) return "";
  return `${r > 0 ? "▲" : "▼"}${Math.round(Math.abs(r)).toLocaleString("en-US")} fpm`;
}

/** Map label: the exact height the model is drawn at (feet), its reference, and climb/descent. */
export function altTag(p: Record<string, LiveValue>): string {
  if (p.onGround) return "GND";
  const a = aircraftAltitude(p);
  if (!a) return "";
  return [`${a.ft.toLocaleString("en-US")} ft ${a.ref}`, vRateTag(p)].filter(Boolean).join(" ");
}

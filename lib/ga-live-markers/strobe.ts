import type { LiveMarker } from "./parse";

export const STROBE_MS = 15 * 60_000;
export const markerKey = (m: LiveMarker) => `${m.label}|${m.lon}|${m.lat}|${m.observedAt ?? ""}`;

/** First-seen time per marker: carried over from `prev`; on a layer's first load only incidents observed within STROBE_MS count as new. */
export function strobeSince(ms: LiveMarker[], prev: Map<string, number> | undefined, now: number): Map<string, number> {
  const next = new Map<string, number>();
  for (const m of ms) {
    const k = markerKey(m);
    const obs = m.observedAt ? Date.parse(m.observedAt) : NaN;
    next.set(k, prev ? prev.get(k) ?? now : Number.isFinite(obs) && now - obs < STROBE_MS ? Math.min(obs, now) : 0);
  }
  return next;
}

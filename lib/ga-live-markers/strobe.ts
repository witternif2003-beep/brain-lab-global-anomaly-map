import { policeLightBar } from "../fbi-agencies/parse";
import type { LiveLayer, LiveMarker } from "./parse";

export const STROBE_MS = 10 * 60_000;

/** Layers whose markers are discrete events: each observation time is a separate indicator. */
const EVENT_LAYERS = new Set<LiveLayer>(["augusta911", "athens911", "policereports", "pireps", "quakes", "tfr"]);

export const markerKey = (m: LiveMarker) => `${m.label}|${m.lon}|${m.lat}|${m.observedAt ?? ""}`;

/** Identity of an indicator across refreshes: moving vehicles by callsign/vehicle, fixed sites by name and position. */
export function strobeKey(layer: LiveLayer, m: LiveMarker): string {
  if (EVENT_LAYERS.has(layer)) return markerKey(m);
  if (layer === "aircraft") return `${m.label}|${m.props.type ?? ""}`;
  if (layer === "transit") return `${m.props.agency ?? ""}|${m.props.vehicle ?? ""}|${m.label}`;
  return `${m.label}|${m.lon}|${m.lat}`;
}

/**
 * First-seen time per indicator, carried over from `prev`. On a layer's first load, event layers count incidents observed
 * within STROBE_MS as new; other layers start steady so only indicators that appear later strobe.
 */
export function strobeSince(layer: LiveLayer, ms: LiveMarker[], prev: Map<string, number> | undefined, now: number): Map<string, number> {
  const next = new Map<string, number>();
  const events = EVENT_LAYERS.has(layer);
  for (const m of ms) {
    const k = strobeKey(layer, m);
    const obs = m.observedAt ? Date.parse(m.observedAt) : NaN;
    next.set(k, prev ? prev.get(k) ?? now : events && Number.isFinite(obs) && now - obs < STROBE_MS ? Math.min(obs, now) : 0);
  }
  return next;
}

export const hasActiveStrobe = (seen: Map<string, number> | undefined, now: number, slackMs = 0) =>
  !!seen && [...seen.values()].some((t) => now - t < STROBE_MS + slackMs);

/** Layers drawn as red warning triangles for police-reported offences and E911 calls. */
export const CRIME_TRIANGLE_LAYERS: ReadonlySet<LiveLayer> = new Set<LiveLayer>(["policereports", "augusta911"]);
export const CRIME_STROBE_RED = "#8b0000";
export const CRIME_STROBE_BLUE = "#1d4ed8";

/** Police light-bar phase for a new crime triangle: 1 = dark red, 2 = blue, 0 = between flashes (triangle keeps its own colour). */
export function crimeStrobePhase(now: number): 0 | 1 | 2 {
  const l = policeLightBar(now);
  return l.on ? (l.color === policeLightBar(0).color ? 1 : 2) : 0;
}

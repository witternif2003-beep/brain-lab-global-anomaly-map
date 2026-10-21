import type { LiveLayer } from "./parse";

export const LIVE_POINT_CEILING = 30_000;

/** Layers whose points come from feeds that refresh while the map is open (positions, readings, calls, reports, camera pictures); fixed OSM and Atlas of Surveillance layers are excluded. */
export const LIVE_FEED_LAYERS: readonly LiveLayer[] = [
  "aircraft", "transit", "micromobility", "stations", "streamgauges", "quakes", "tfr",
  "pireps", "augusta911", "athens911", "policereports", "gdotcams", "webcams", "vessels",
];

export interface LiveCeiling {
  total: number;
  ceiling: number;
  pct: number;
  parts: { layer: LiveLayer; count: number }[];
  missing: LiveLayer[];
}

/** Sums the live-feed layers that have loaded; layers with no count yet (loading or failed) are listed as missing, never counted as 0. */
export function liveCeiling(counts: Partial<Record<LiveLayer, number | null>>, ceiling = LIVE_POINT_CEILING): LiveCeiling {
  const parts: LiveCeiling["parts"] = [];
  const missing: LiveLayer[] = [];
  for (const layer of LIVE_FEED_LAYERS) {
    const n = counts[layer];
    if (typeof n === "number" && Number.isFinite(n)) parts.push({ layer, count: n });
    else missing.push(layer);
  }
  parts.sort((a, b) => b.count - a.count);
  const total = parts.reduce((a, p) => a + p.count, 0);
  return { total, ceiling, pct: Math.round((total / ceiling) * 1000) / 10, parts, missing };
}

/** GDOT TADA (gdottrafficdata.drakewell.com) continuous count stations: live 15-minute counts normalised for the map. */

export const TADA_BASE = "https://gdottrafficdata.drakewell.com";
export const TADA_PAGE = `${TADA_BASE}/publicmultinodemap.asp`;
export const TADA_NODE = "GDOT_CCS";
/** mph per mm/s; the portal's own `jsSpeedFactor` (scripts/mnm/customer/gdottrafficdata-config.js). */
export const MMPS_TO_MPH = 0.00223693629;
/** A station's latest bin older than this is shown as stale, not live. */
export const STALE_AFTER_MIN = 45;
/** Below this share of the posted limit, measured average speed is flagged as slowed. */
export const SLOWED_RATIO = 0.67;

export interface TadaSite {
  id: string;
  node: string;
  name: string;
  description?: string;
  isDisabled?: boolean;
  speedLimit?: number | null;
  bearing?: number | null;
  location?: { lat: number; lng: number } | null;
  parameters?: Record<string, string | undefined>;
}

export interface TadaSeries {
  count?: (number | null)[];
  normalCount?: (number | null)[];
  avgSpeed?: (number | null)[];
  countStatus?: string[];
  coverage?: (number | null)[];
}

export interface TadaDirection extends TadaSeries { direction: number }
export interface TadaChannel extends TadaSeries { direction: number; bearing?: number | null; name?: string }

export interface TadaSnapshot {
  siteId: string;
  interval: number;
  startTime: string;
  endTime: string;
  total?: TadaSeries;
  byDirection?: TadaDirection[];
  byChannel?: TadaChannel[];
}

export const LEVELS = [
  { id: "light", label: "Light", min: 0, color: "#81d8d0" },
  { id: "moderate", label: "Moderate", min: 250, color: "#38bdf8" },
  { id: "busy", label: "Busy", min: 1000, color: "#a78bfa" },
  { id: "heavy", label: "Heavy", min: 3000, color: "#f472b6" },
  { id: "very-heavy", label: "Very heavy", min: 6000, color: "#ff2bd6" },
] as const;
export type LevelId = (typeof LEVELS)[number]["id"];

/** Traffic level band for a measured vehicles-per-hour rate (bands are this map's own, not a GDOT classification). */
export function levelFor(vph: number): (typeof LEVELS)[number] {
  let out: (typeof LEVELS)[number] = LEVELS[0];
  for (const l of LEVELS) if (vph >= l.min) out = l;
  return out;
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const directionLabel = (d: number): string => COMPASS[((d % 8) + 8) % 8];

function offsetMs(utcMs: number, tz: string): number {
  const p = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(new Date(utcMs))
    .reduce<Record<string, number>>((a, x) => (x.type === "literal" ? a : { ...a, [x.type]: Number(x.value) }), {});
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - utcMs;
}

/** "YYYY-MM-DD HH:mm:ss" wall time in `tz` to an ISO UTC string. */
export function localToIso(s: string, tz = "America/New_York"): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  let t = wall - offsetMs(wall, tz);
  t = wall - offsetMs(t, tz);
  return new Date(t).toISOString();
}

const ROAD_RE = /^(I-\s?\d+[A-Z]?|SR\s?\d+[A-Z]?|US\s?\d+[A-Z]?|CR\s?\d+)/i;
export function roadName(description: string): string {
  const m = ROAD_RE.exec(description.trim());
  return m ? m[1].toUpperCase().replace(/\s+/, " ") : description.trim().split(/\s+(?:btwn|between|at|@|n of|s of|e of|w of|north of|south of|east of|west of)\s+/i)[0].slice(0, 28);
}

const mph = (mmps: number | null | undefined) => (typeof mmps === "number" && mmps > 0 ? Math.round(mmps * MMPS_TO_MPH) : null);

/** Index of the newest bin with a measured count (status not NONE), or -1. */
export function latestBin(s: TadaSeries | undefined): number {
  const c = s?.count ?? [];
  for (let i = c.length - 1; i >= 0; i--) if (typeof c[i] === "number" && s?.countStatus?.[i] !== "NONE") return i;
  return -1;
}

export interface StationDirection {
  direction: string;
  bearing: number | null;
  count: number;
  vph: number;
  avgMph: number | null;
}

export interface StationProps {
  id: string;
  name: string;
  description: string;
  road: string;
  county: string;
  binStart: string;
  binEnd: string;
  intervalMin: number;
  count: number;
  vph: number;
  normalCount: number | null;
  pctOfNormal: number | null;
  avgMph: number | null;
  limitMph: number | null;
  slowed: boolean;
  status: string;
  level: LevelId;
  color: string;
  directions: StationDirection[];
}

export interface CountsPayload {
  source: string;
  sourceUrl: string;
  generatedAt: string;
  stations: GeoJSON.FeatureCollection<GeoJSON.Point, StationProps>;
  summary: {
    sitesListed: number;
    sitesInSnapshot: number;
    reporting: number;
    noCurrentCount: number;
    vehiclesLatestBins: number;
    slowed: number;
    latestBinEnd: string | null;
    byLevel: Record<LevelId, number>;
  };
}

/** Joins the GDOT CCS site list with a liveSnapshot response; only stations with a measured latest bin become features. */
export function buildCounts(sites: TadaSite[], snaps: TadaSnapshot[], nowMs: number): Omit<CountsPayload, "source" | "sourceUrl"> {
  const byId = new Map(sites.filter((s) => s.node === TADA_NODE && !s.isDisabled).map((s) => [s.id, s]));
  const byLevel = Object.fromEntries(LEVELS.map((l) => [l.id, 0])) as Record<LevelId, number>;
  const features: GeoJSON.Feature<GeoJSON.Point, StationProps>[] = [];
  let noCurrent = 0;
  let latest: string | null = null;
  for (const snap of snaps) {
    const site = byId.get(snap.siteId);
    if (!site?.location) continue;
    const i = latestBin(snap.total);
    if (i < 0 || !snap.interval) { noCurrent++; continue; }
    const tz = site.parameters?.tz === "US/Eastern" || !site.parameters?.tz ? "America/New_York" : site.parameters.tz;
    const startIso = localToIso(snap.startTime, tz);
    if (!startIso) { noCurrent++; continue; }
    const t0 = Date.parse(startIso) + i * snap.interval * 1000;
    const binStart = new Date(t0).toISOString();
    const binEnd = new Date(t0 + snap.interval * 1000).toISOString();
    const perHour = 3600 / snap.interval;
    const count = snap.total?.count?.[i] as number;
    const vph = Math.round(count * perHour);
    const normal = snap.total?.normalCount?.[i];
    const avgMph = mph(snap.total?.avgSpeed?.[i]);
    const limitMph = mph(site.speedLimit ?? null);
    const lvl = levelFor(vph);
    const chanBearing = new Map<number, number>();
    for (const ch of snap.byChannel ?? []) if (typeof ch.bearing === "number" && !chanBearing.has(ch.direction)) chanBearing.set(ch.direction, ch.bearing);
    const directions = (snap.byDirection ?? []).flatMap((d) => {
      const c = d.count?.[i];
      if (typeof c !== "number") return [];
      return [{ direction: directionLabel(d.direction), bearing: chanBearing.get(d.direction) ?? (site.bearing ?? null), count: c, vph: Math.round(c * perHour), avgMph: mph(d.avgSpeed?.[i]) }];
    });
    if (!latest || binEnd > latest) latest = binEnd;
    byLevel[lvl.id]++;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [site.location.lng, site.location.lat] },
      properties: {
        id: site.id,
        name: site.name,
        description: site.description ?? site.name,
        road: roadName(site.description ?? site.name),
        county: site.parameters?.county ?? "",
        binStart,
        binEnd,
        intervalMin: snap.interval / 60,
        count,
        vph,
        normalCount: typeof normal === "number" ? normal : null,
        pctOfNormal: typeof normal === "number" && normal > 0 ? Math.round((count / normal) * 100) : null,
        avgMph,
        limitMph,
        slowed: avgMph !== null && limitMph !== null && count > 0 && avgMph < limitMph * SLOWED_RATIO,
        status: (nowMs - Date.parse(binEnd)) / 60_000 > STALE_AFTER_MIN ? "stale" : snap.total?.countStatus?.[i] ?? "OK",
        level: lvl.id,
        color: lvl.color,
        directions,
      },
    });
  }
  features.sort((a, b) => b.properties.vph - a.properties.vph);
  return {
    generatedAt: new Date(nowMs).toISOString(),
    stations: { type: "FeatureCollection", features },
    summary: {
      sitesListed: byId.size,
      sitesInSnapshot: snaps.length,
      reporting: features.length,
      noCurrentCount: noCurrent,
      vehiclesLatestBins: features.reduce((s, f) => s + f.properties.count, 0),
      slowed: features.filter((f) => f.properties.slowed).length,
      latestBinEnd: latest,
      byLevel,
    },
  };
}

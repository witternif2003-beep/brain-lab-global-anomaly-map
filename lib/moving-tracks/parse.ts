import type { Gauge } from '../metrics/prometheus';

export const MOVING_TRACKS_MAX = 50_000;
export const AIRCRAFT_MIN_MS = 5;
export const VESSEL_MIN_KT = 0.5;
const AIS_SOG_INVALID = 102.3;
const MS_TO_KT = 1.943844;
const PLEASURE_SHIP_TYPES = new Set([36, 37]);
const MAX_POSITION_AGE_S = 120;

export type TrackKind = 'aircraft' | 'vessel' | 'train';

/** One moving public track; no ICAO hex, registration, MMSI or other persistent identifier. */
export interface MovingTrack {
  kind: TrackKind;
  lon: number;
  lat: number;
  /** Direction of travel, degrees clockwise from north, or null when the source has none. */
  course: number | null;
  speedKt: number;
  altFt: number | null;
  label: string;
  /** Unix ms of the position fix. */
  at: number;
  source: string;
}

export interface MovingSourceStatus {
  id: string;
  kind: TrackKind;
  url: string;
  licence: string;
  ok: boolean;
  /** Fallback source not queried because the primary source for its kind answered. */
  standby: boolean;
  error: string | null;
  received: number;
  moving: number;
  removedPrivacy: number;
  newestAt: number | null;
  lagSeconds: number | null;
}

export interface MovingTracksPayload {
  generatedAt: string;
  max: number;
  total: number;
  truncated: number;
  counts: Record<TrackKind, number>;
  privacy: { listsLoaded: boolean; error: string | null; note: string };
  sources: MovingSourceStatus[];
  tracks: MovingTrack[];
}

export interface PrivacyLists {
  /** Lower-case ICAO 24-bit hex codes in the FAA LADD and PIA programmes, or null when the lists could not be loaded. */
  hexes: Set<string> | null;
}

/** US civil register ICAO block (A00000–ADF7C7, padded to ADFFFF); dropped entirely when the LADD/PIA lists are unavailable. */
export function isUsRegistered(hex: string): boolean {
  const n = Number.parseInt(hex, 16);
  return Number.isFinite(n) && n >= 0xa00000 && n <= 0xadffff;
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const validLonLat = (lon: unknown, lat: unknown): boolean => finite(lon) && finite(lat) && Math.abs(lon) <= 180 && Math.abs(lat) <= 90 && !(lon === 0 && lat === 0);
const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;

export interface ParseResult {
  tracks: MovingTrack[];
  received: number;
  removedPrivacy: number;
  warning?: string;
}

/** OpenSky `/states/all`: airborne aircraft above 5 m/s with a position under 2 min old; LADD/PIA aircraft removed. */
export function parseOpenSkyStates(json: { time?: number; states?: unknown[][] | null }, privacy: PrivacyLists): ParseResult {
  const states = Array.isArray(json.states) ? json.states : [];
  const now = finite(json.time) ? json.time : Date.now() / 1000;
  const tracks: MovingTrack[] = [];
  let removedPrivacy = 0;
  for (const s of states) {
    const hex = typeof s[0] === 'string' ? s[0].toLowerCase() : '';
    const [lon, lat, onGround, vel, track, alt, posTime] = [s[5], s[6], s[8], s[9], s[10], s[7] ?? s[13], s[3]];
    if (!hex || !validLonLat(lon, lat) || onGround === true || !finite(vel) || vel <= AIRCRAFT_MIN_MS) continue;
    if (!finite(posTime) || now - posTime > MAX_POSITION_AGE_S) continue;
    if (privacy.hexes ? privacy.hexes.has(hex) : isUsRegistered(hex)) {
      removedPrivacy++;
      continue;
    }
    const callsign = typeof s[1] === 'string' ? s[1].trim() : '';
    tracks.push({
      kind: 'aircraft',
      lon: round(lon as number, 5),
      lat: round(lat as number, 5),
      course: finite(track) ? round(track, 1) : null,
      speedKt: round((vel as number) * MS_TO_KT, 1),
      altFt: finite(alt) ? Math.round(alt * 3.28084) : null,
      label: callsign || 'no callsign',
      at: posTime * 1000,
      source: 'OpenSky Network',
    });
  }
  return { tracks, received: states.length, removedPrivacy };
}

interface AisLocation {
  geometry?: { coordinates?: unknown[] };
  properties?: { mmsi?: number; sog?: number; cog?: number; heading?: number; timestampExternal?: number };
}
interface AisVessel { mmsi?: number; name?: string; shipType?: number }

/** Digitraffic AIS locations joined to vessel metadata: vessels at 0.5 kt or more; pleasure craft get no name; MMSI is not published. */
export function parseDigitrafficAis(locations: { features?: AisLocation[] }, vessels: AisVessel[] | null, nowMs: number): ParseResult {
  const meta = new Map<number, AisVessel>();
  for (const v of vessels ?? []) if (finite(v.mmsi)) meta.set(v.mmsi, v);
  const feats = Array.isArray(locations.features) ? locations.features : [];
  const tracks: MovingTrack[] = [];
  for (const f of feats) {
    const [lon, lat] = f.geometry?.coordinates ?? [];
    const p = f.properties ?? {};
    if (!validLonLat(lon, lat) || !finite(p.sog) || p.sog < VESSEL_MIN_KT || p.sog >= AIS_SOG_INVALID) continue;
    if (!finite(p.timestampExternal) || nowMs - p.timestampExternal > MAX_POSITION_AGE_S * 5 * 1000) continue;
    const v = finite(p.mmsi) ? meta.get(p.mmsi) : undefined;
    const pleasure = v?.shipType !== undefined && PLEASURE_SHIP_TYPES.has(v.shipType);
    const name = !pleasure && v?.name ? v.name.trim() : '';
    tracks.push({
      kind: 'vessel',
      lon: round(lon as number, 5),
      lat: round(lat as number, 5),
      course: finite(p.cog) && p.cog < 360 ? round(p.cog, 1) : null,
      speedKt: round(p.sog, 1),
      altFt: null,
      label: name || (pleasure ? 'pleasure craft' : 'vessel'),
      at: p.timestampExternal,
      source: 'Digitraffic AIS (Fintraffic)',
    });
  }
  return { tracks, received: feats.length, removedPrivacy: 0 };
}

interface TrainLocation { location?: { coordinates?: unknown[] }; speed?: number; trainNumber?: number; timestamp?: string }

/** Digitraffic latest train GPS fixes: trains with speed above 0 km/h. */
export function parseDigitrafficTrains(json: unknown, nowMs: number): ParseResult {
  const rows = Array.isArray(json) ? (json as TrainLocation[]) : [];
  const tracks: MovingTrack[] = [];
  for (const t of rows) {
    const [lon, lat] = t.location?.coordinates ?? [];
    const at = t.timestamp ? Date.parse(t.timestamp) : NaN;
    if (!validLonLat(lon, lat) || !finite(t.speed) || t.speed <= 0 || !Number.isFinite(at) || nowMs - at > MAX_POSITION_AGE_S * 1000) continue;
    tracks.push({
      kind: 'train',
      lon: round(lon as number, 5),
      lat: round(lat as number, 5),
      course: null,
      speedKt: round(t.speed / 1.852, 1),
      altFt: null,
      label: finite(t.trainNumber) ? `Train ${t.trainNumber}` : 'train',
      at,
      source: 'Digitraffic rail (Fintraffic)',
    });
  }
  return { tracks, received: rows.length, removedPrivacy: 0 };
}

const ADSB_PRIVACY_FLAGS = 4 | 8;
const NM_KM = 1.852;

export interface AdsbAircraftRaw {
  hex?: string; flight?: string; lat?: number; lon?: number; alt_baro?: number | 'ground'; gs?: number; track?: number; seen_pos?: number; dbFlags?: number;
}

/**
 * adsb.lol `/v2/point` responses from overlapping tiles: airborne aircraft above 5 m/s, PIA/LADD (dbFlags 4|8) removed,
 * deduplicated by ICAO hex server-side; the hex is not published.
 */
export function parseAdsbLolTiles(responses: { ac?: AdsbAircraftRaw[]; now?: number }[], nowMs: number): ParseResult {
  const seen = new Set<string>();
  const tracks: MovingTrack[] = [];
  let received = 0;
  let removedPrivacy = 0;
  for (const r of responses) {
    const now = finite(r.now) ? r.now : nowMs;
    for (const a of r.ac ?? []) {
      const hex = (a.hex ?? '').toLowerCase();
      if (!hex || seen.has(hex)) continue;
      seen.add(hex);
      received++;
      if ((a.dbFlags ?? 0) & ADSB_PRIVACY_FLAGS) {
        removedPrivacy++;
        continue;
      }
      const seenPos = finite(a.seen_pos) ? a.seen_pos : Infinity;
      if (!validLonLat(a.lon, a.lat) || a.alt_baro === 'ground' || !finite(a.gs) || a.gs * 0.514444 <= AIRCRAFT_MIN_MS || seenPos > MAX_POSITION_AGE_S) continue;
      tracks.push({
        kind: 'aircraft',
        lon: round(a.lon as number, 5),
        lat: round(a.lat as number, 5),
        course: finite(a.track) ? round(a.track, 1) : null,
        speedKt: round(a.gs, 1),
        altFt: finite(a.alt_baro) ? Math.round(a.alt_baro) : null,
        label: a.flight?.trim() || 'no callsign',
        at: Math.round(now - seenPos * 1000),
        source: 'adsb.lol',
      });
    }
  }
  return { tracks, received, removedPrivacy };
}

/** Centres of 250 NM query circles laid on a grid over each [west, south, east, north] box, spaced so neighbouring circles overlap. */
export function tileCentres(boxes: [number, number, number, number][], radiusNm = 250): [number, number][] {
  const stepKm = radiusNm * NM_KM * 1.6;
  const out: [number, number][] = [];
  for (const [w, s, e, n] of boxes) {
    const dLat = stepKm / 111.32;
    for (let lat = s + dLat / 2; lat < n + dLat / 2; lat += dLat) {
      const dLon = stepKm / (111.32 * Math.cos((Math.min(lat, 85) * Math.PI) / 180));
      for (let lon = w + dLon / 2; lon < e + dLon / 2; lon += dLon) out.push([round(lat, 2), round(lon, 2)]);
    }
  }
  return out;
}

/** Lower-case hex set from adsb.lol `/v2/ladd` or `/v2/pia` (`{ ac: [{ hex }] }`). */
export function hexList(json: { ac?: { hex?: string }[] }): string[] {
  return (json.ac ?? []).map((a) => (a.hex ?? '').replace(/^~/, '').toLowerCase()).filter(Boolean);
}

/** Merges per-source tracks under the 50,000 ceiling, sharing it across kinds in proportion to what each source supplied. */
export function capTracks(groups: MovingTrack[][], max = MOVING_TRACKS_MAX): { tracks: MovingTrack[]; truncated: number } {
  const total = groups.reduce((a, g) => a + g.length, 0);
  if (total <= max) return { tracks: groups.flat(), truncated: 0 };
  const out: MovingTrack[] = [];
  let left = max;
  groups.forEach((g, i) => {
    const share = i === groups.length - 1 ? left : Math.min(left, Math.floor((g.length / total) * max));
    const newest = [...g].sort((a, b) => b.at - a.at).slice(0, share);
    out.push(...newest);
    left -= newest.length;
  });
  return { tracks: out, truncated: total - out.length };
}

const KINDS: TrackKind[] = ['aircraft', 'vessel', 'train'];

export function countKinds(tracks: MovingTrack[]): Record<TrackKind, number> {
  const c: Record<TrackKind, number> = { aircraft: 0, vessel: 0, train: 0 };
  for (const t of tracks) c[t.kind]++;
  return c;
}

/** Prometheus gauges for /api/moving-tracks; a null body means the route itself failed. */
export function movingGauges(body: MovingTracksPayload | null): Gauge[] {
  return [
    { name: 'moving_tracks_total', help: `Moving public tracks published (ceiling ${MOVING_TRACKS_MAX}).`, values: KINDS.map((kind) => ({ labels: { kind }, value: body ? body.counts[kind] : null })) },
    { name: 'moving_tracks_truncated', help: 'Moving tracks dropped by the 50,000 ceiling.', values: [{ value: body?.truncated ?? null }] },
    { name: 'moving_tracks_source_up', help: '1 when the moving-track source answered, 0 when it failed.', values: (body?.sources ?? []).filter((s) => !s.standby).map((s) => ({ labels: { source: s.id }, value: s.ok ? 1 : 0 })) },
    { name: 'moving_tracks_source_lag_seconds', help: 'Seconds since the newest position fix from each moving-track source.', values: (body?.sources ?? []).filter((s) => !s.standby).map((s) => ({ labels: { source: s.id }, value: s.lagSeconds })) },
    { name: 'moving_tracks_privacy_removed', help: 'Aircraft removed for FAA LADD/PIA privacy (or US-registered when the lists were unavailable).', values: (body?.sources ?? []).filter((s) => s.kind === 'aircraft' && !s.standby).map((s) => ({ labels: { source: s.id }, value: s.removedPrivacy })) },
  ];
}

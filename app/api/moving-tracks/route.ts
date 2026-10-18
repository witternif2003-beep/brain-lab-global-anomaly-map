import { countKinds, capTracks, hexList, MOVING_TRACKS_MAX, parseAdsbLolTiles, parseDigitrafficAis, parseDigitrafficTrains, parseOpenSkyStates, tileCentres, type AdsbAircraftRaw, type MovingSourceStatus, type MovingTrack, type MovingTracksPayload, type ParseResult, type PrivacyLists, type TrackKind } from "../../../lib/moving-tracks/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const UA = { "Digitraffic-User": "brain-lab-godseye", "User-Agent": "brain-lab-godseye (+https://brain-lab-six.vercel.app)" };
const OPENSKY_TOKEN_URL = "https://auth.opensky-network.org/auth/realms/opensky-network/protocol/openid-connect/token";
const OPENSKY_STATES = "https://opensky-network.org/api/states/all";
const AIS_LOCATIONS = "https://meri.digitraffic.fi/api/ais/v1/locations";
const AIS_VESSELS = "https://meri.digitraffic.fi/api/ais/v1/vessels";
const TRAINS = "https://rata.digitraffic.fi/api/v1/train-locations/latest";
const LADD = "https://api.adsb.lol/v2/ladd";
const PIA = "https://api.adsb.lol/v2/pia";
const ADSB_POINT = "https://api.adsb.lol/v2/point";
/** Contiguous US and Europe, the two densest ADS-B regions, as [west, south, east, north]. */
const ADSB_BOXES: [number, number, number, number][] = [
  [-125, 24, -66, 49],
  [-11, 35, 30, 60],
];
const ADSB_TILES = tileCentres(ADSB_BOXES);
const ADSB_CONCURRENCY = 8;

interface Source {
  id: string;
  kind: TrackKind;
  url: string;
  licence: string;
  ttlMs: () => number;
  load: () => Promise<ParseResult>;
  /** Queried only when the source with this id failed. */
  fallbackFor?: string;
}

interface Cached { at: number; result: ParseResult | null; error: string | null }
const cache = new Map<string, Cached>();
let token: { value: string; exp: number } | null = null;
let privacy: { at: number; lists: PrivacyLists } | null = null;
let privacyError: string | null = null;

const reason = (err: unknown): string => {
  if (!(err instanceof Error)) return String(err);
  const cause = err.cause instanceof Error ? (err.cause as Error & { code?: string }) : null;
  return cause ? `${err.message} (${cause.code ?? cause.message})` : err.message;
};

const authed = () => Boolean(process.env.OPENSKY_CLIENT_ID && process.env.OPENSKY_CLIENT_SECRET);

async function getJson(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<unknown> {
  const r = await fetch(url, { ...init, headers: { ...UA, Accept: "application/json", ...(init.headers ?? {}) }, signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
}

async function openSkyToken(): Promise<string | null> {
  if (!authed()) return null;
  if (token && token.exp > Date.now() + 30_000) return token.value;
  const body = new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.OPENSKY_CLIENT_ID ?? "", client_secret: process.env.OPENSKY_CLIENT_SECRET ?? "" });
  const j = (await getJson(OPENSKY_TOKEN_URL, { method: "POST", body, headers: { "Content-Type": "application/x-www-form-urlencoded" } })) as { access_token?: string; expires_in?: number };
  if (!j.access_token) throw new Error("OpenSky token missing");
  token = { value: j.access_token, exp: Date.now() + (j.expires_in ?? 1800) * 1000 };
  return token.value;
}

async function privacyLists(): Promise<PrivacyLists> {
  if (privacy && Date.now() - privacy.at < 10 * 60_000) return privacy.lists;
  try {
    const [ladd, pia] = await Promise.all([getJson(LADD, {}, 20_000), getJson(PIA, {}, 20_000)]);
    const lists = { hexes: new Set([...hexList(ladd as { ac?: { hex?: string }[] }), ...hexList(pia as { ac?: { hex?: string }[] })]) };
    privacy = { at: Date.now(), lists };
    privacyError = null;
    return lists;
  } catch (err) {
    privacyError = reason(err);
    return privacy?.lists ?? { hexes: null };
  }
}

async function adsbTiles(): Promise<ParseResult> {
  const out: ({ ac?: AdsbAircraftRaw[]; now?: number } | null)[] = new Array(ADSB_TILES.length).fill(null);
  let next = 0;
  let lastError = "";
  const worker = async () => {
    while (next < ADSB_TILES.length) {
      const i = next++;
      const [lat, lon] = ADSB_TILES[i];
      try {
        out[i] = (await getJson(`${ADSB_POINT}/${lat}/${lon}/250`, {}, 10_000)) as { ac?: AdsbAircraftRaw[]; now?: number };
      } catch (err) {
        lastError = reason(err);
      }
    }
  };
  await Promise.all(Array.from({ length: ADSB_CONCURRENCY }, worker));
  const ok = out.filter((r): r is { ac?: AdsbAircraftRaw[]; now?: number } => r !== null);
  if (!ok.length) throw new Error(`all ${ADSB_TILES.length} tiles failed: ${lastError}`);
  const result = parseAdsbLolTiles(ok, Date.now());
  const failed = ADSB_TILES.length - ok.length;
  return failed ? { ...result, warning: `${failed} of ${ADSB_TILES.length} tiles failed (${lastError})` } : result;
}

const SOURCES: Source[] = [
  {
    id: "adsb.lol",
    kind: "aircraft",
    url: "https://adsb.lol/",
    licence: "adsb.lol community ADS-B feed (rate limits set by adsb.lol; licence terms not verified here, see adsb.lol)",
    ttlMs: () => 120_000,
    load: adsbTiles,
  },
  {
    id: "OpenSky Network",
    fallbackFor: "adsb.lol",
    kind: "aircraft",
    url: "https://opensky-network.org/",
    licence: "OpenSky Network data, non-commercial/research use with attribution",
    ttlMs: () => (authed() ? 90_000 : 900_000),
    load: async () => {
      const [t, lists] = await Promise.all([openSkyToken(), privacyLists()]);
      const j = await getJson(OPENSKY_STATES, t ? { headers: { Authorization: `Bearer ${t}` } } : {}, 20_000);
      return parseOpenSkyStates(j as { time?: number; states?: unknown[][] }, lists);
    },
  },
  {
    id: "Digitraffic AIS",
    kind: "vessel",
    url: "https://www.digitraffic.fi/en/marine-traffic/",
    licence: "Fintraffic / digitraffic.fi, CC BY 4.0",
    ttlMs: () => 60_000,
    load: async () => {
      const [loc, ves] = await Promise.all([getJson(AIS_LOCATIONS), getJson(AIS_VESSELS).catch(() => null)]);
      return parseDigitrafficAis(loc as { features?: [] }, ves as [] | null, Date.now());
    },
  },
  {
    id: "Digitraffic rail",
    kind: "train",
    url: "https://www.digitraffic.fi/en/railway-traffic/",
    licence: "Fintraffic / digitraffic.fi, CC BY 4.0",
    ttlMs: () => 30_000,
    load: async () => parseDigitrafficTrains(await getJson(TRAINS), Date.now()),
  },
];

async function load(s: Source): Promise<Cached> {
  const hit = cache.get(s.id);
  if (hit && Date.now() - hit.at < s.ttlMs()) return hit;
  try {
    const next = { at: Date.now(), result: await s.load(), error: null };
    cache.set(s.id, next);
    return next;
  } catch (err) {
    const failed = { at: Date.now(), result: null, error: reason(err) };
    cache.set(s.id, { ...failed, at: Date.now() - s.ttlMs() + 60_000 });
    return failed;
  }
}

/** Up to 50,000 moving public tracks (aircraft, vessels, trains) with per-source status; nothing is filled in when a source fails. */
export async function GET() {
  const now = Date.now();
  const primary = SOURCES.filter((s) => !s.fallbackFor);
  const first = new Map((await Promise.all(primary.map(load))).map((c, i) => [primary[i].id, c]));
  const standby = new Set(SOURCES.filter((s) => s.fallbackFor && first.get(s.fallbackFor)?.result).map((s) => s.id));
  const loaded: Cached[] = await Promise.all(
    SOURCES.map((s) => first.get(s.id) ?? (standby.has(s.id) ? Promise.resolve({ at: now, result: null, error: null }) : load(s))),
  );
  const groups: MovingTrack[][] = loaded.map((c) => c.result?.tracks ?? []);
  const { tracks, truncated } = capTracks(groups);
  const sources: MovingSourceStatus[] = SOURCES.map((s, i) => {
    const r = loaded[i].result;
    const newestAt = r && r.tracks.length ? Math.max(...r.tracks.map((t) => t.at)) : null;
    return {
      id: s.id,
      kind: s.kind,
      url: s.url,
      licence: s.licence,
      ok: Boolean(r),
      standby: standby.has(s.id),
      error: loaded[i].error ?? r?.warning ?? null,
      received: r?.received ?? 0,
      moving: r?.tracks.length ?? 0,
      removedPrivacy: r?.removedPrivacy ?? 0,
      newestAt,
      lagSeconds: newestAt === null ? null : Math.max(0, Math.round((now - newestAt) / 1000)),
    };
  });
  const listsLoaded = Boolean(privacy?.lists.hexes);
  const adsbUsed = sources.some((s) => s.id === "adsb.lol" && s.ok);
  const body: MovingTracksPayload = {
    generatedAt: new Date(now).toISOString(),
    max: MOVING_TRACKS_MAX,
    total: tracks.length,
    truncated,
    counts: countKinds(tracks),
    privacy: {
      listsLoaded,
      error: privacyError,
      note: adsbUsed
        ? "Aircraft flagged PIA/LADD by adsb.lol removed; no ICAO hex, registration or MMSI published; pleasure craft unnamed"
        : listsLoaded
        ? "Aircraft on the FAA LADD/PIA lists (as currently seen by adsb.lol) removed; no ICAO hex, registration or MMSI published; pleasure craft unnamed"
        : "LADD/PIA lists unavailable, so every US-registered aircraft was removed; no ICAO hex, registration or MMSI published; pleasure craft unnamed",
    },
    sources,
    tracks,
  };
  const anyOk = sources.some((s) => s.ok);
  return Response.json(anyOk ? body : { ...body, error: sources.filter((s) => !s.standby).map((s) => `${s.id}: ${s.error}`).join("; ") }, {
    status: anyOk ? 200 : 502,
    headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60" },
  });
}

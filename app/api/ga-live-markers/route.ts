import { NextResponse, type NextRequest } from "next/server";
import {
  augusta911Markers,
  augustaGeocodeQuery,
  decodeGtfsRtVehicles,
  GA_BBOX,
  ga511CamerasFromViewRows,
  parse511Cameras,
  parseAccpdIncidents,
  parseAdsbLol,
  parseAugusta911Feed,
  parseGbfsFreeBikes,
  parseIemCurrents,
  parseOpenSky,
  parseOverpassInfra,
  parseTfrXml,
  parseUsgsIv,
  parseUsgsQuakes,
  transitMarkers,
  GEOCODE_MIN_SCORE,
  type AccpdFeature,
  type BskyFeedItem,
  type Ga511Camera,
  type Ga511ViewRow,
  type GeocodeHit,
  type LiveLayer,
  type LiveMarker,
  type OsmInfraKind,
  type TfrListItem,
} from "../../../lib/ga-live-markers/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const UA = { "User-Agent": "brain-lab-global-anomaly-map (public-data map; https://brain-lab-six.vercel.app)" };

interface Placed { markers: LiveMarker[]; unplaced: number }
interface Feed { id: string; url: string | (() => string); load?: (r: Response) => Promise<LiveMarker[]>; markers?: () => Promise<LiveMarker[] | Placed> }
interface LayerSpec { ttlS: number; source: string; sourceUrl: string; feeds: Feed[]; fallback?: Feed[] }

const json = (f: (j: never) => LiveMarker[]) => async (r: Response) => f((await r.json()) as never);
const iem = (network: string): Feed => ({
  id: `IEM ${network}`,
  url: `https://mesonet.agron.iastate.edu/api/1/currents.json?network=${network}`,
  load: json((j) => parseIemCurrents(j, network)),
});
const gtfsRt = (agency: string, url: string): Feed => ({
  id: `${agency} GTFS-RT`,
  url,
  load: async (r) => transitMarkers(decodeGtfsRtVehicles(new Uint8Array(await r.arrayBuffer())).vehicles, agency),
});

const OSM_TTL_S = 6 * 3600;
const OVERPASS = [
  { url: "https://overpass-api.de/api/interpreter", timeoutMs: 65_000 },
  { url: "https://overpass.private.coffee/api/interpreter", timeoutMs: 45_000 },
];
const OSM_QUERY = `[out:json][timeout:60][bbox:${GA_BBOX.south},${GA_BBOX.west},${GA_BBOX.north},${GA_BBOX.east}];node["highway"="traffic_signals"];out skel qt;(nwr["amenity"~"^(police|fire_station)$"];nwr["emergency"="siren"];nwr["man_made"~"^(mast|tower)$"]["tower:type"="communication"];node["highway"="speed_camera"];nwr["man_made"="surveillance"]["surveillance:type"~"^alpr$",i];);out center tags qt;`;
let osmMemo: { at: number; data: Promise<Record<OsmInfraKind, LiveMarker[]>> } | null = null;

/** One shared Overpass query per instance for every OSM infrastructure layer, with a mirror fallback. */
function osmInfra() {
  if (!osmMemo || Date.now() - osmMemo.at > OSM_TTL_S * 1000) {
    const data = (async () => {
      const errors: string[] = [];
      for (const ep of OVERPASS) {
        try {
          const r = await fetch(`${ep.url}?data=${encodeURIComponent(OSM_QUERY)}`, { cache: "no-store", headers: UA, signal: AbortSignal.timeout(ep.timeoutMs) });
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return parseOverpassInfra(await r.json());
        } catch (err) {
          errors.push(`${new URL(ep.url).host}: ${String(err)}`);
        }
      }
      throw new Error(errors.join("; "));
    })();
    const memo = { at: Date.now(), data };
    osmMemo = memo;
    data.catch(() => {
      if (osmMemo === memo) osmMemo = null;
    });
  }
  return osmMemo.data;
}

const osm = (kind: OsmInfraKind, source: string): LayerSpec => ({
  ttlS: OSM_TTL_S,
  source: `${source} mapped in OpenStreetMap (ODbL), Overpass API; locations only, re-queried every 6 h`,
  sourceUrl: "https://www.openstreetmap.org/copyright",
  feeds: [{ id: "OSM Overpass", url: OVERPASS[0].url, markers: async () => (await osmInfra())[kind] }],
});

const TFR_LIST = "https://tfr.faa.gov/tfrapi/exportTfrList";
const tfrDetail = (id: string) => `https://tfr.faa.gov/download/detail_${id.replace("/", "_")}.xml`;

async function gaTfrs(): Promise<LiveMarker[]> {
  const r = await fetch(TFR_LIST, { cache: "no-store", headers: UA, signal: AbortSignal.timeout(15_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const items = ((await r.json()) as TfrListItem[]).filter((t) => t.state === "GA" && t.notam_id);
  const out = await Promise.all(
    items.map(async (t) => {
      const d = await fetch(tfrDetail(t.notam_id!), { cache: "no-store", headers: UA, signal: AbortSignal.timeout(15_000) });
      return d.ok ? parseTfrXml(await d.text(), t) : null;
    }),
  );
  return out.filter((m): m is LiveMarker => m !== null);
}

const getJson = async <T,>(url: string, timeoutMs = 15_000): Promise<T> => {
  const r = await fetch(url, { cache: "no-store", headers: UA, signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = (await r.json()) as T & { error?: { message?: string } };
  if (d.error) throw new Error(d.error.message ?? "service error");
  return d;
};

const AUG_HANDLE = "auge911feed.bsky.social";
const AUG_FEED = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${AUG_HANDLE}&filter=posts_no_replies&limit=100`;
const AUG_LOCATOR = "https://gismap.augustaga.gov/arcgis/rest/services/AGS_AddressComposite/GeocodeServer/findAddressCandidates";
const AUG_WINDOW_MS = 24 * 3600_000;
const AUG_MAX_PAGES = 4;
const AUG_GEOCODE_BATCH = 4;
const geoMemo = new Map<string, GeocodeHit | null>();

/** Intersections are retried with the locator's other separators ("AND", "/") when "&" finds no candidate. */
async function augustaGeocode(query: string): Promise<GeocodeHit | null> {
  const memo = geoMemo.get(query);
  if (memo !== undefined) return memo;
  let hit: GeocodeHit | null = null;
  for (const q of query.includes(" & ") ? [query, query.replace(" & ", " AND "), query.replace(" & ", " / ")] : [query]) {
    hit = await augustaLocate(q);
    if (hit) break;
  }
  if (geoMemo.size >= 5000) geoMemo.clear();
  geoMemo.set(query, hit);
  return hit;
}

async function augustaLocate(query: string): Promise<GeocodeHit | null> {
  const d = await getJson<{ candidates?: { address?: string; score?: number; location?: { x?: number; y?: number } }[] }>(
    `${AUG_LOCATOR}?SingleLine=${encodeURIComponent(query)}&outSR=4326&maxLocations=1&f=json`,
  );
  const c = d.candidates?.[0];
  const hit = c && (c.score ?? 0) >= GEOCODE_MIN_SCORE && Number.isFinite(c.location?.x) && Number.isFinite(c.location?.y)
    ? { lon: c.location!.x!, lat: c.location!.y!, score: c.score!, matched: c.address ?? query }
    : null;
  return hit;
}

/** Augusta E911 calls posted in the last 24 h, placed by coordinates in the post or the Augusta GIS locator. */
async function augusta911(): Promise<Placed> {
  const since = Date.now() - AUG_WINDOW_MS;
  const feed: BskyFeedItem[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < AUG_MAX_PAGES; page++) {
    const d = await getJson<{ feed?: BskyFeedItem[]; cursor?: string }>(cursor ? `${AUG_FEED}&cursor=${encodeURIComponent(cursor)}` : AUG_FEED);
    feed.push(...(d.feed ?? []));
    const oldest = d.feed?.at(-1)?.post?.record?.createdAt;
    if (!d.cursor || !oldest || Date.parse(oldest) < since) break;
    cursor = d.cursor;
  }
  const calls = parseAugusta911Feed({ feed }).filter((c) => c.calledAt && Date.parse(c.calledAt) >= since);
  const queries = [...new Set(calls.filter((c) => !c.coord).map((c) => augustaGeocodeQuery(c.location)))];
  const hits = new Map<string, GeocodeHit | null>();
  const errors: string[] = [];
  for (let i = 0; i < queries.length; i += AUG_GEOCODE_BATCH) {
    await Promise.all(queries.slice(i, i + AUG_GEOCODE_BATCH).map(async (q) => {
      try {
        hits.set(q, await augustaGeocode(q));
      } catch (err) {
        errors.push(String(err));
      }
    }));
  }
  if (queries.length && errors.length === queries.length) throw new Error(`Augusta GIS locator unreachable: ${errors[0]}`);
  const markers = augusta911Markers(calls, (q) => hits.get(q) ?? null);
  return { markers, unplaced: calls.length - markers.length };
}

const ACCPD = "https://services2.arcgis.com/xSEULKvB31odt3XQ/arcgis/rest/services/Incidents_accpd_Public/FeatureServer/0";
const ACCPD_PAGE = 1000;
const ACCPD_MAX = 6000;

/** Every Athens-Clarke PD call for service dated in the last 7 days, newest first, unfiltered. */
async function athens911(): Promise<Placed> {
  const markers: LiveMarker[] = [];
  let total = 0;
  for (let offset = 0; offset < ACCPD_MAX; offset += ACCPD_PAGE) {
    const d = await getJson<{ features?: AccpdFeature[]; exceededTransferLimit?: boolean }>(
      `${ACCPD}/query?where=${encodeURIComponent("Date >= CURRENT_TIMESTAMP - 7")}&outFields=*&returnGeometry=false&orderByFields=${encodeURIComponent("ObjectId DESC")}&resultOffset=${offset}&resultRecordCount=${ACCPD_PAGE}&f=json`,
      30_000,
    );
    total += d.features?.length ?? 0;
    markers.push(...parseAccpdIncidents(d));
    if (!d.exceededTransferLimit) break;
  }
  return { markers, unplaced: total - markers.length };
}

const GA511_CAMERAS = "https://511ga.org/api/v2/get/cameras";

/** 511GA developer API (key required, throttled to 10 calls per 60 s); the key is only sent upstream, never echoed in the response. */
async function gdotCameras(): Promise<LiveMarker[]> {
  const key = process.env.GA511_API_KEY;
  if (!key) throw new Error("GA511_API_KEY is not configured (free developer key: https://511ga.org/developers/doc)");
  const r = await fetch(`${GA511_CAMERAS}?key=${encodeURIComponent(key)}&format=json`, { cache: "no-store", headers: UA, signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`511GA HTTP ${r.status}`);
  return parse511Cameras((await r.json()) as Ga511Camera[]);
}

const GA511_MIRROR = "https://services1.arcgis.com/2iUE8l8JKrP2tygQ/arcgis/rest/services/Georgia511Cameras_Detailed_/FeatureServer/0";
const GA511_MIRROR_PAGE = 2000;
const GA511_MIRROR_MAX = 10_000;
const GA511_MIRROR_FIELDS = "Id,Source,Roadway,Direction,Latitude,Longitude,Location,Name,View_Id,View_Url,View_Status,View_Description";

/** Keyless fallback: public ArcGIS copy of the 511GA camera list ("Georgia 511 Cameras (Detailed)"), paginated. */
async function gdotCamerasMirror(): Promise<LiveMarker[]> {
  const rows: Ga511ViewRow[] = [];
  for (let offset = 0; offset < GA511_MIRROR_MAX; offset += GA511_MIRROR_PAGE) {
    const d = await getJson<{ features?: Ga511ViewRow[]; exceededTransferLimit?: boolean }>(
      `${GA511_MIRROR}/query?where=1%3D1&outFields=${GA511_MIRROR_FIELDS}&returnGeometry=false&orderByFields=OBJECTID&resultOffset=${offset}&resultRecordCount=${GA511_MIRROR_PAGE}&f=json`,
      30_000,
    );
    rows.push(...(d.features ?? []));
    if (!d.exceededTransferLimit) break;
  }
  return parse511Cameras(ga511CamerasFromViewRows({ features: rows }));
}

const LAYERS: Record<LiveLayer, LayerSpec> = {
  gdotcams: {
    ttlS: 3600,
    source: "Georgia DOT traffic cameras from the 511GA developer API; each picture is served by 511ga.org and checked in the browser against 511GA's “no live feed” placeholders, so only verified-live cameras are drawn (live video needs a 511GA login and is not shown)",
    sourceUrl: "https://511ga.org/cctv",
    feeds: [{ id: "511GA cameras", url: GA511_CAMERAS, markers: gdotCameras }],
    fallback: [{ id: "Georgia 511 Cameras (Detailed), public ArcGIS copy", url: GA511_MIRROR, markers: gdotCamerasMirror }],
  },
  augusta911: {
    ttlS: 120,
    source: "Augusta-Richmond County E911 public incident feed (official Bluesky account linked from augustaga.gov), calls from the last 24 h; call type and location as posted, placed by the Augusta GIS address locator (match score ≥ 60; below 80 flagged approximate) or coordinates in the post",
    sourceUrl: "https://www.augustaga.gov/66/E911-Emergency-Services",
    feeds: [{ id: "Augusta E911 (Bluesky)", url: AUG_FEED, markers: augusta911 }],
  },
  athens911: {
    ttlS: 1800,
    source: "Athens-Clarke County Police calls for service logged in CAD (county ArcGIS layer Incidents_accpd_Public), dated in the last 7 days; unfiltered, at the exact point the county publishes; date only, published with a delay",
    sourceUrl: ACCPD,
    feeds: [{ id: "ACCPD Incidents (ArcGIS)", url: ACCPD, markers: athens911 }],
  },
  tfr: {
    ttlS: 300,
    source: "FAA temporary flight restrictions (incl. UAS/drone restrictions) listed for Georgia on tfr.faa.gov; centre of each restricted area",
    sourceUrl: "https://tfr.faa.gov/",
    feeds: [{ id: "FAA TFR", url: TFR_LIST, markers: gaTfrs }],
  },
  signals: osm("signals", "Traffic signals (signal-preemption points; preemption equipment itself is not mapped)"),
  towers: osm("towers", "Communication masts/towers (radio, cellular, broadcast; owner and use as tagged)"),
  police: osm("police", "Police stations and facilities"),
  firestations: osm("firestations", "Fire stations"),
  sirens: osm("sirens", "Outdoor warning sirens"),
  speedcams: osm("speedcams", "Fixed speed-enforcement cameras"),
  alpr: osm("alpr", "Fixed licence-plate-reader camera positions (no plate reads, no camera owner data beyond OSM tags)"),
  aircraft: {
    ttlS: 10,
    source: "ADS-B aircraft positions from adsb.lol (ODbL); aircraft in the FAA PIA/LADD privacy programmes are removed",
    sourceUrl: "https://adsb.lol/",
    feeds: [{ id: "adsb.lol", url: "https://api.adsb.lol/v2/point/32.7/-83.25/250", load: json((j) => parseAdsbLol(j)) }],
    fallback: [{ id: "OpenSky Network", url: "https://opensky-network.org/api/states/all?lamin=30.3&lomin=-85.7&lamax=35.1&lomax=-80.8", load: json((j) => parseOpenSky(j)) }],
  },
  transit: {
    ttlS: 20,
    source: "Public bus positions (GTFS-realtime) from MARTA, Ride Gwinnett, CobbLinc, Athens-Clarke Transit, UGA Campus Transit, Connect Douglas and Georgia Tech Stinger; feeds listed in the Mobility Database",
    sourceUrl: "https://mobilitydatabase.org/",
    feeds: [
      gtfsRt("MARTA", "https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb"),
      gtfsRt("Ride Gwinnett", "https://realtimegwinnett.availtec.com/InfoPoint/gtfs-realtime.ashx?type=vehicleposition"),
      gtfsRt("CobbLinc", "https://cobb.rideralerts.com/InfoPoint/GTFS-Realtime.ashx?Type=VehiclePosition"),
      gtfsRt("Athens Transit", "https://bustracker.accgov.com/InfoPoint/GTFS-Realtime.ashx?Type=VehiclePosition"),
      gtfsRt("UGA Transit", "https://passio3.com/uga/passioTransit/gtfs/realtime/vehiclePositions"),
      gtfsRt("Connect Douglas", "https://passio3.com/douglas/passioTransit/gtfs/realtime/vehiclePositions"),
      gtfsRt("GT Stinger", "https://passio3.com/gatech/passioTransit/gtfs/realtime/vehiclePositions"),
    ],
  },
  micromobility: {
    ttlS: 60,
    source: "Parked shared scooters/bikes, Atlanta (GBFS feeds from Lime and Bird); reserved vehicles and vehicle IDs are removed",
    sourceUrl: "https://github.com/MobilityData/gbfs",
    feeds: [
      { id: "Lime GBFS", url: "https://data.lime.bike/api/partners/v2/gbfs/atlanta/free_bike_status.json", load: json((j) => parseGbfsFreeBikes(j, "Lime")) },
      { id: "Bird GBFS", url: "https://mds.bird.co/gbfs/v2/public/atlanta/free_bike_status.json", load: json((j) => parseGbfsFreeBikes(j, "Bird")) },
    ],
  },
  stations: {
    ttlS: 300,
    source: "Weather and hydrology stations (ASOS airports, NWS DCP gauges, GDOT road-weather RWIS, COOP) via Iowa Environmental Mesonet; observations from the last 6 h",
    sourceUrl: "https://mesonet.agron.iastate.edu/api/",
    feeds: [iem("GA_ASOS"), iem("GA_DCP"), iem("GA_RWIS"), iem("GA_COOP")],
  },
  quakes: {
    ttlS: 60,
    source: "USGS ANSS ComCat earthquakes in the Georgia area, last 30 days (FDSN event service; automatic solutions may be revised)",
    sourceUrl: "https://earthquake.usgs.gov/fdsnws/event/1/",
    feeds: [{
      id: "USGS ComCat",
      url: () => `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&orderby=time&minlatitude=30.3&maxlatitude=35.1&minlongitude=-85.7&maxlongitude=-80.8&starttime=${new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)}`,
      load: json((j) => parseUsgsQuakes(j)),
    }],
  },
  streamgauges: {
    ttlS: 300,
    source: "USGS stream gauges, latest gage height (NWIS instantaneous values, provisional data)",
    sourceUrl: "https://waterdata.usgs.gov/ga/nwis/rt",
    feeds: [{ id: "USGS NWIS IV", url: "https://waterservices.usgs.gov/nwis/iv/?stateCd=GA&parameterCd=00065&siteStatus=active&format=json", load: json((j) => parseUsgsIv(j)) }],
  },
};

const feedUrl = (f: Feed) => (typeof f.url === "function" ? f.url() : f.url);

const cache = new Map<LiveLayer, { at: number; body: unknown }>();

async function run(feeds: Feed[]) {
  const results = await Promise.allSettled(
    feeds.map(async (f) => {
      if (f.markers) return f.markers();
      if (!f.load) throw new Error("feed has no loader");
      const r = await fetch(feedUrl(f), { cache: "no-store", headers: UA, signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return f.load(r);
    }),
  );
  return feeds.map((f, i) => {
    const r = results[i];
    const v = r.status === "fulfilled" ? r.value : [];
    const placed = Array.isArray(v) ? { markers: v, unplaced: null } : v;
    return { id: f.id, url: feedUrl(f), ...placed, error: r.status === "rejected" ? String(r.reason) : null };
  });
}

async function build(layer: LiveLayer) {
  const spec = LAYERS[layer];
  let feeds = await run(spec.feeds);
  let source = spec.source;
  let sourceUrl = spec.sourceUrl;
  if (feeds.every((f) => f.error) && spec.fallback) {
    const fb = await run(spec.fallback);
    if (fb.some((f) => !f.error)) {
      feeds = [...feeds, ...fb];
      source = `${fb.map((f) => f.id).join(", ")} (fallback; ${spec.feeds.map((f) => f.id).join(", ")} unreachable)`;
      sourceUrl = feedUrl(spec.fallback[0]);
    }
  }
  if (feeds.every((f) => f.error)) throw new Error(feeds.map((f) => `${f.id}: ${f.error}`).join("; "));
  return {
    layer,
    generatedAt: new Date().toISOString(),
    refreshSeconds: spec.ttlS,
    source,
    sourceUrl,
    feeds: feeds.map((f) => ({ id: f.id, url: f.url, count: f.error ? null : f.markers.length, unplaced: f.unplaced, error: f.error })),
    markers: feeds.flatMap((f) => f.markers),
  };
}

export async function GET(request: NextRequest) {
  const layer = request.nextUrl.searchParams.get("layer") as LiveLayer | null;
  if (!layer || !(layer in LAYERS)) {
    return NextResponse.json({ error: `layer must be one of: ${Object.keys(LAYERS).join(", ")}` }, { status: 400 });
  }
  const ttl = LAYERS[layer].ttlS;
  try {
    const hit = cache.get(layer);
    const body = hit && Date.now() - hit.at < ttl * 1000 ? hit.body : await build(layer);
    if (body !== hit?.body) cache.set(layer, { at: Date.now(), body });
    return NextResponse.json(body, { headers: { "Cache-Control": `public, s-maxage=${ttl}, stale-while-revalidate=${ttl}` } });
  } catch (err) {
    return NextResponse.json({ layer, error: String(err) }, { status: 502 });
  }
}

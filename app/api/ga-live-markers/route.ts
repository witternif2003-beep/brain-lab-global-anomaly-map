import { NextResponse, type NextRequest } from "next/server";
import {
  decodeGtfsRtVehicles,
  GA_BBOX,
  parseAdsbLol,
  parseGbfsFreeBikes,
  parseIemCurrents,
  parseOpenSky,
  parseOverpassInfra,
  parseTfrXml,
  parseUsgsIv,
  parseUsgsQuakes,
  transitMarkers,
  type LiveLayer,
  type LiveMarker,
  type OsmInfraKind,
  type TfrListItem,
} from "../../../lib/ga-live-markers/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const UA = { "User-Agent": "brain-lab-global-anomaly-map (public-data map; https://brain-lab-six.vercel.app)" };

interface Feed { id: string; url: string | (() => string); load?: (r: Response) => Promise<LiveMarker[]>; markers?: () => Promise<LiveMarker[]> }
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

const LAYERS: Record<LiveLayer, LayerSpec> = {
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
    return { id: f.id, url: feedUrl(f), markers: r.status === "fulfilled" ? r.value : [], error: r.status === "rejected" ? String(r.reason) : null };
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
    feeds: feeds.map((f) => ({ id: f.id, url: f.url, count: f.error ? null : f.markers.length, error: f.error })),
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

import { NextResponse, type NextRequest } from "next/server";
import {
  decodeGtfsRtVehicles,
  parseAdsbLol,
  parseGbfsFreeBikes,
  parseIemCurrents,
  parseOpenSky,
  parseUsgsIv,
  transitMarkers,
  type LiveLayer,
  type LiveMarker,
} from "../../../lib/ga-live-markers/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UA = { "User-Agent": "brain-lab-global-anomaly-map (public-data map; https://brain-lab-six.vercel.app)" };

interface Feed { id: string; url: string; load: (r: Response) => Promise<LiveMarker[]> }
interface LayerSpec { ttlS: number; source: string; sourceUrl: string; feeds: Feed[]; fallback?: Feed[] }

const json = (f: (j: never) => LiveMarker[]) => async (r: Response) => f((await r.json()) as never);
const iem = (network: string): Feed => ({
  id: `IEM ${network}`,
  url: `https://mesonet.agron.iastate.edu/api/1/currents.json?network=${network}`,
  load: json((j) => parseIemCurrents(j, network)),
});

const LAYERS: Record<LiveLayer, LayerSpec> = {
  aircraft: {
    ttlS: 10,
    source: "ADS-B aircraft positions from adsb.lol (ODbL); aircraft in the FAA PIA/LADD privacy programmes are removed",
    sourceUrl: "https://adsb.lol/",
    feeds: [{ id: "adsb.lol", url: "https://api.adsb.lol/v2/point/32.7/-83.25/250", load: json((j) => parseAdsbLol(j)) }],
    fallback: [{ id: "OpenSky Network", url: "https://opensky-network.org/api/states/all?lamin=30.3&lomin=-85.7&lamax=35.1&lomax=-80.8", load: json((j) => parseOpenSky(j)) }],
  },
  transit: {
    ttlS: 20,
    source: "MARTA bus positions (GTFS-realtime)",
    sourceUrl: "https://itsmarta.com/app-developer-resources.aspx",
    feeds: [{
      id: "MARTA GTFS-RT",
      url: "https://gtfs-rt.itsmarta.com/TMGTFSRealTimeWebService/vehicle/vehiclepositions.pb",
      load: async (r) => transitMarkers(decodeGtfsRtVehicles(new Uint8Array(await r.arrayBuffer())).vehicles, "MARTA"),
    }],
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
  streamgauges: {
    ttlS: 300,
    source: "USGS stream gauges, latest gage height (NWIS instantaneous values, provisional data)",
    sourceUrl: "https://waterdata.usgs.gov/ga/nwis/rt",
    feeds: [{ id: "USGS NWIS IV", url: "https://waterservices.usgs.gov/nwis/iv/?stateCd=GA&parameterCd=00065&siteStatus=active&format=json", load: json((j) => parseUsgsIv(j)) }],
  },
};

const cache = new Map<LiveLayer, { at: number; body: unknown }>();

async function run(feeds: Feed[]) {
  const results = await Promise.allSettled(
    feeds.map(async (f) => {
      const r = await fetch(f.url, { cache: "no-store", headers: UA, signal: AbortSignal.timeout(15_000) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return f.load(r);
    }),
  );
  return feeds.map((f, i) => {
    const r = results[i];
    return { id: f.id, url: f.url, markers: r.status === "fulfilled" ? r.value : [], error: r.status === "rejected" ? String(r.reason) : null };
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
      sourceUrl = spec.fallback[0].url;
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

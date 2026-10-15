import { NextResponse } from "next/server";
import { metarCloudSlabs, type Metar } from "../../../lib/ga-clouds/metar-clouds";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const AWC = "https://aviationweather.gov/api/data/metar?bbox=30.3,-85.7,35.1,-80.8&format=json";
const HEADERS = { "User-Agent": "brain-lab-global-anomaly-map (witternif2003@gmail.com)", Accept: "application/json" };
const TTL_MS = 5 * 60_000;

let cache: { at: number; metars: Metar[] } | null = null;

export async function GET(req: Request) {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      const r = await fetch(AWC, { signal: AbortSignal.timeout(15_000), headers: HEADERS, cache: "no-store" });
      if (!r.ok) throw new Error(`HTTP ${r.status} (${AWC})`);
      cache = { at: Date.now(), metars: (await r.json()) as Metar[] };
    }
    const segments = new URL(req.url).searchParams.get("lite") === "1" ? 16 : 32;
    const geojson = metarCloudSlabs(cache.metars, segments);
    const latest = cache.metars.reduce<string | null>((m, x) => (x.reportTime && (!m || x.reportTime > m) ? x.reportTime : m), null);
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        source: "NOAA Aviation Weather Center METAR cloud layers (ceilometer base heights above ground)",
        sourceUrl: "https://aviationweather.gov/data/api/",
        stations: cache.metars.length,
        latestObservation: latest,
        geojson,
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120" } },
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e), generatedAt: new Date().toISOString() }, { status: 502 });
  }
}

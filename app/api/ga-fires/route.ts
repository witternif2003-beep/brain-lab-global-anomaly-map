import { NextResponse } from "next/server";
import { firesToGeoJSON, parseFirmsCsv, summarizeFires, type FireDetection } from "../../../lib/ga-fires/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BASE = "https://firms.modaps.eosdis.nasa.gov/data/active_fire";
const FEEDS: { id: string; instrument: FireDetection["instrument"]; url: string }[] = [
  { id: "NOAA-20 VIIRS", instrument: "VIIRS", url: `${BASE}/noaa-20-viirs-c2/csv/J1_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv` },
  { id: "NOAA-21 VIIRS", instrument: "VIIRS", url: `${BASE}/noaa-21-viirs-c2/csv/J2_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv` },
  { id: "Suomi NPP VIIRS", instrument: "VIIRS", url: `${BASE}/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_USA_contiguous_and_Hawaii_24h.csv` },
  { id: "Terra/Aqua MODIS", instrument: "MODIS", url: `${BASE}/modis-c6.1/csv/MODIS_C6_1_USA_contiguous_and_Hawaii_24h.csv` },
];
const TTL_MS = 10 * 60_000;

let cache: { at: number; body: unknown } | null = null;

async function load(feed: (typeof FEEDS)[number]) {
  const r = await fetch(feed.url, { cache: "no-store", signal: AbortSignal.timeout(20_000) });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return parseFirmsCsv(await r.text(), feed.instrument);
}

async function build() {
  const results = await Promise.allSettled(FEEDS.map(load));
  if (results.every((r) => r.status === "rejected")) throw (results[0] as PromiseRejectedResult).reason;
  const fires = results.flatMap((r) => (r.status === "fulfilled" ? r.value : [])).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
  return {
    generatedAt: new Date().toISOString(),
    source: "NASA FIRMS active fire detections, last 24 h (VIIRS 375 m, MODIS 1 km), Georgia bounding box",
    sourceUrl: "https://firms.modaps.eosdis.nasa.gov/usfs/active_fire/",
    feeds: FEEDS.map((f, i) => {
      const r = results[i];
      return { id: f.id, url: f.url, count: r.status === "fulfilled" ? r.value.length : null, error: r.status === "rejected" ? String(r.reason) : null };
    }),
    summary: summarizeFires(fires),
    geojson: firesToGeoJSON(fires),
  };
}

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), body: await build() };
    return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=300" } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

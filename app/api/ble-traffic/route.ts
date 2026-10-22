import { NextResponse } from "next/server";
import { ADDINSIGHT_BASE, ADDINSIGHT_CATALOG, buildPayload, type BleTrafficPayload, type LinkFeature, type SiteFeature } from "../../../lib/ble-traffic/aggregate";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const TTL_MS = 60_000;
let cache: { at: number; body: BleTrafficPayload } | null = null;

async function geojson<T extends GeoJSON.Feature>(file: string): Promise<T[]> {
  const r = await fetch(`${ADDINSIGHT_BASE}/${file}`, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  if (!r.ok) throw new Error(`Addinsight ${file} HTTP ${r.status}`);
  const j = (await r.json()) as { features?: T[] };
  if (!Array.isArray(j.features)) throw new Error(`Addinsight ${file}: no features`);
  return j.features;
}

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      const [sites, links] = await Promise.all([geojson<SiteFeature>("sites_prop_stats_geo.json"), geojson<LinkFeature>("links_prop_stats_geo.json")]);
      cache = { at: Date.now(), body: buildPayload(sites, links, Date.now()) };
    }
    return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=60" } });
  } catch (e) {
    return NextResponse.json(
      { error: `Source Offline: ${e instanceof Error ? e.message : String(e)}`, sourceUrl: ADDINSIGHT_CATALOG, generatedAt: new Date().toISOString() },
      { status: 502 },
    );
  }
}

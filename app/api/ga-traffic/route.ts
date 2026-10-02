import { NextResponse } from "next/server";
import { normalize, type Ga511Attributes } from "../../../lib/ga-traffic/normalize";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const LAYER =
  "https://services1.arcgis.com/2iUE8l8JKrP2tygQ/arcgis/rest/services/GDOT_511_Events_Public_View/FeatureServer/0";
const ITEM = "https://www.arcgis.com/home/item.html?id=24c16968306b42779776ec24a88574ee";
const FIELDS =
  "ID,RoadwayName,DirectionOfTravel,Description,LastUpdated,StartDate,PlannedEndDate,LanesAffected,Latitude,Longitude,EventType,IsFullClosure,EncodedPolyline,Severity";
const TTL_MS = 5 * 60_000;

let cache: { at: number; body: unknown } | null = null;

async function build() {
  const r = await fetch(`${LAYER}/query`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ f: "json", where: "1=1", outFields: FIELDS, returnGeometry: "false", resultRecordCount: "2000" }),
  });
  if (!r.ok) throw new Error(`ArcGIS HTTP ${r.status}`);
  const j = (await r.json()) as { features?: { attributes: Ga511Attributes }[]; error?: { message: string } };
  if (j.error) throw new Error(`ArcGIS: ${j.error.message}`);
  return {
    source: "Georgia DOT 511GA traffic events (public ArcGIS view published by GEMA, overwritten every 15 minutes)",
    sourceUrl: ITEM,
    generatedAt: new Date().toISOString(),
    ...normalize((j.features ?? []).map((f) => f.attributes)),
  };
}

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), body: await build() };
    return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120" } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), sourceUrl: ITEM, generatedAt: new Date().toISOString() },
      { status: 502 },
    );
  }
}

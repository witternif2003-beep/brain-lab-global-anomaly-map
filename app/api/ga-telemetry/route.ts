import { NextResponse } from "next/server";
import { aggregate, cellsToGeoJSON, H3_RESOLUTIONS, K_MIN, type IncidentPoint } from "../../../lib/ga-telemetry/aggregate";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LAYER = "https://services3.arcgis.com/Et5Qfajgiyosiw4d/arcgis/rest/services/OpenDataWebsite_Crime_view/FeatureServer/0";
const PORTAL = "https://atlanta-police-opendata-atlantapd.hub.arcgis.com";
const PAGE = 2000;
const WINDOW_DAYS = 30;
const TTL_MS = 15 * 60_000;
const YEAR = 2026;

let cache: { at: number; body: unknown } | null = null;

interface ArcFeature<T> { attributes: T }
interface ArcResponse<T> { features?: ArcFeature<T>[]; count?: number; error?: { message: string } }

async function query<T>(params: Record<string, string>): Promise<ArcResponse<T>> {
  const r = await fetch(`${LAYER}/query`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ f: "json", ...params }),
  });
  if (!r.ok) throw new Error(`APD open data HTTP ${r.status}`);
  const j = (await r.json()) as ArcResponse<T>;
  if (j.error) throw new Error(`APD open data: ${j.error.message}`);
  return j;
}

const sqlTs = (d: Date) => `TIMESTAMP '${d.toISOString().slice(0, 19).replace("T", " ")}'`;

async function build() {
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const where = `ReportDate >= ${sqlTs(since)} AND ReportDate <= ${sqlTs(now)} AND Latitude IS NOT NULL AND Longitude IS NOT NULL`;
  const ytdWhere = `ReportDate >= DATE '${YEAR}-01-01' AND ReportDate <= ${sqlTs(now)}`;

  const [{ count = 0 }, ytd] = await Promise.all([
    query<never>({ where, returnCountOnly: "true" }),
    query<{ NIBRS_Bucket: string | null; n: number }>({
      where: ytdWhere,
      groupByFieldsForStatistics: "NIBRS_Bucket",
      outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "n" }]),
    }),
  ]);

  const pages = await Promise.all(
    Array.from({ length: Math.ceil(count / PAGE) }, (_, i) =>
      query<{ ReportDate: number; NIBRS_Bucket: string | null; Crime_Against: string | null; Latitude: number; Longitude: number }>({
        where,
        // Only aggregate fields are requested; addresses, report numbers and victim fields are never read.
        outFields: "ReportDate,NIBRS_Bucket,Crime_Against,Latitude,Longitude",
        returnGeometry: "false",
        orderByFields: "OBJECTID",
        resultOffset: String(i * PAGE),
        resultRecordCount: String(PAGE),
      }),
    ),
  );

  const points: IncidentPoint[] = pages
    .flatMap((p) => p.features ?? [])
    .map(({ attributes: a }) => ({
      reportedAt: a.ReportDate,
      category: a.NIBRS_Bucket ?? "Unclassified",
      against: a.Crime_Against ?? "Unclassified",
      lat: a.Latitude,
      lng: a.Longitude,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat > 30 && p.lat < 35.1 && p.lng > -85.7 && p.lng < -80.7);

  const agg = aggregate(points);
  const ytdRows = (ytd.features ?? []).map((f) => ({ category: f.attributes.NIBRS_Bucket ?? "Unclassified", count: f.attributes.n }));
  const latest = points.reduce((m, p) => Math.max(m, p.reportedAt), 0);

  return {
    generatedAt: now.toISOString(),
    source: "Atlanta Police Department Open Data — NIBRS crime reports (OpenDataWebsite_Crime_view)",
    sourceUrl: PORTAL,
    apiUrl: LAYER,
    coverage: "City of Atlanta (APD jurisdiction) only. No other Georgia agency publishes a live incident feed with coordinates.",
    window: { from: since.toISOString(), to: now.toISOString(), days: WINDOW_DAYS, latestReport: latest ? new Date(latest).toISOString() : null },
    privacy: {
      kMin: K_MIN,
      method: `Incidents are counted into H3 hexagons (resolutions ${H3_RESOLUTIONS.join(", ")}); cells with fewer than ${K_MIN} reports are withheld, and no point, address or report number is returned.`,
    },
    incidents: agg.incidents,
    byHour: agg.byHour,
    byWeekday: agg.byWeekday,
    byDay: agg.byDay,
    byCategory: agg.byCategory,
    byAgainst: agg.byAgainst,
    suppressed: agg.suppressed,
    hex: Object.fromEntries(H3_RESOLUTIONS.map((r) => [r, cellsToGeoJSON(agg.cells[r])])),
    ytd: {
      year: YEAR,
      total: ytdRows.reduce((a, b) => a + b.count, 0),
      byCategory: ytdRows.sort((a, b) => b.count - a.count),
    },
  };
}

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), body: await build() };
    return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300" } });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), sourceUrl: PORTAL, generatedAt: new Date().toISOString() },
      { status: 502 },
    );
  }
}

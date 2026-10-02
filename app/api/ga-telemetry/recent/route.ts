import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const LAYER = "https://services3.arcgis.com/Et5Qfajgiyosiw4d/arcgis/rest/services/OpenDataWebsite_Crime_view/FeatureServer/0";
const TTL_MS = 60_000;
const WINDOWS_MIN = [15, 60, 180, 1440] as const;

let cache: { at: number; body: unknown } | null = null;

const sqlTs = (d: Date) => `TIMESTAMP '${d.toISOString().slice(0, 19).replace("T", " ")}'`;

async function query(params: Record<string, string>): Promise<{ count?: number; features?: { attributes: { mx: number | null } }[] }> {
  const r = await fetch(`${LAYER}/query`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ f: "json", ...params }),
  });
  if (!r.ok) throw new Error(`ArcGIS HTTP ${r.status}`);
  const j = await r.json();
  if (j.error) throw new Error(`ArcGIS: ${j.error.message}`);
  return j;
}

/** Citywide APD report counts for short windows ending now; future-dated rows are excluded. */
async function build() {
  const now = new Date();
  const upTo = `ReportDate <= ${sqlTs(now)}`;
  const [latest, ...counts] = await Promise.all([
    query({
      where: upTo,
      outStatistics: JSON.stringify([{ statisticType: "max", onStatisticField: "ReportDate", outStatisticFieldName: "mx" }]),
    }),
    ...WINDOWS_MIN.map((m) =>
      query({ where: `ReportDate >= ${sqlTs(new Date(now.getTime() - m * 60_000))} AND ${upTo}`, returnCountOnly: "true" }),
    ),
  ]);
  const mx = latest.features?.[0]?.attributes.mx ?? null;
  return {
    generatedAt: now.toISOString(),
    sourceUrl: LAYER,
    latestReport: mx ? new Date(mx).toISOString() : null,
    counts: Object.fromEntries(WINDOWS_MIN.map((m, i) => [m, counts[i].count ?? 0])) as Record<(typeof WINDOWS_MIN)[number], number>,
  };
}

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), body: await build() };
    return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e), generatedAt: new Date().toISOString() }, { status: 502 });
  }
}

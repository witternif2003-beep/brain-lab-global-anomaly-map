import { NextResponse } from "next/server";
import { aggregate, cellsToGeoJSON, dateFmt, H3_RESOLUTIONS, K_MIN, WEEKDAYS, weekdayFmt, type IncidentPoint } from "../../../lib/ga-telemetry/aggregate";
import { bayesianChangePoint, cellCentroids, cellCounts, getisOrd, poissonForecast, voronoiCounts, type Site } from "../../../lib/ga-telemetry/models";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const LAYER = "https://services3.arcgis.com/Et5Qfajgiyosiw4d/arcgis/rest/services/OpenDataWebsite_Crime_view/FeatureServer/0";
const PORTAL = "https://atlanta-police-opendata-atlantapd.hub.arcgis.com";
const SERVICES = "https://services3.arcgis.com/Et5Qfajgiyosiw4d/arcgis/rest/services";
const PRECINCTS = `${SERVICES}/APDmainprecincts/FeatureServer/0`;
const ARC_NPU =
  "https://services1.arcgis.com/Ug5xGQbHsD8zuZzM/arcgis/rest/services/ACS%202024%20Demographic%20Population/FeatureServer/15";
const ARC_ITEM = "https://www.arcgis.com/home/item.html?id=ed685cf5eda54f348a9547f5d0d2b84b";
const ATL_BBOX: [number, number, number, number] = [-84.56, 33.62, -84.28, 33.9];
const PAGE = 2000;
const WINDOW_DAYS = 30;
const MODEL_DAYS = 120;
const TTL_MS = 15 * 60_000;
const YEAR = 2026;

let cache: { at: number; body: unknown } | null = null;

interface ArcFeature<T> { attributes: T }
interface ArcResponse<T> { features?: ArcFeature<T>[]; count?: number; error?: { message: string } }

async function query<T>(params: Record<string, string>, layer = LAYER): Promise<ArcResponse<T>> {
  const r = await fetch(`${layer}/query`, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ f: "json", ...params }),
  });
  if (!r.ok) throw new Error(`ArcGIS HTTP ${r.status} (${layer})`);
  const j = (await r.json()) as ArcResponse<T>;
  if (j.error) throw new Error(`ArcGIS: ${j.error.message} (${layer})`);
  return j;
}

const sqlTs = (d: Date) => `TIMESTAMP '${d.toISOString().slice(0, 19).replace("T", " ")}'`;

async function context() {
  const [precincts, npu] = await Promise.all([
    query<{ Name: string }>({ where: "Name LIKE '%Precinct%'", outFields: "Name", returnGeometry: "true", outSR: "4326" }, PRECINCTS).catch(() => null),
    query<{ ShortLabel: string; TotPop_e24: number; TotPop_m24: number }>(
      { where: "1=1", outFields: "ShortLabel,TotPop_e24,TotPop_m24", returnGeometry: "false" },
      ARC_NPU,
    ).catch(() => null),
  ]);
  const sites: Site[] = ((precincts?.features ?? []) as (ArcFeature<{ Name: string }> & { geometry?: { x: number; y: number } })[])
    .filter((f) => f.geometry)
    .map((f) => ({ name: f.attributes.Name.replace(/\s+/g, " ").trim(), lng: f.geometry!.x, lat: f.geometry!.y }));
  const population = new Map((npu?.features ?? []).map((f) => [f.attributes.ShortLabel, f.attributes]));
  return { sites, population };
}

async function build() {
  const now = new Date();
  const since = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const modelSince = new Date(now.getTime() - MODEL_DAYS * 86_400_000);
  const where = `ReportDate >= ${sqlTs(modelSince)} AND ReportDate <= ${sqlTs(now)} AND Latitude IS NOT NULL AND Longitude IS NOT NULL`;
  const ytdWhere = `ReportDate >= DATE '${YEAR}-01-01' AND ReportDate <= ${sqlTs(now)}`;

  const [{ count = 0 }, ytd, ctx] = await Promise.all([
    query<never>({ where, returnCountOnly: "true" }),
    query<{ NIBRS_Bucket: string | null; n: number }>({
      where: ytdWhere,
      groupByFieldsForStatistics: "NIBRS_Bucket",
      outStatistics: JSON.stringify([{ statisticType: "count", onStatisticField: "OBJECTID", outStatisticFieldName: "n" }]),
    }),
    context(),
  ]);

  const pages = await Promise.all(
    Array.from({ length: Math.ceil(count / PAGE) }, (_, i) =>
      query<{ ReportDate: number; NIBRS_Bucket: string | null; Crime_Against: string | null; Latitude: number; Longitude: number; NPU: string | null }>({
        where,
        // Only aggregate fields are requested; addresses, report numbers and victim fields are never read.
        outFields: "ReportDate,NIBRS_Bucket,Crime_Against,Latitude,Longitude,NPU",
        returnGeometry: "false",
        orderByFields: "OBJECTID",
        resultOffset: String(i * PAGE),
        resultRecordCount: String(PAGE),
      }),
    ),
  );

  const all: IncidentPoint[] = pages
    .flatMap((p) => p.features ?? [])
    .map(({ attributes: a }) => ({
      reportedAt: a.ReportDate,
      category: a.NIBRS_Bucket ?? "Unclassified",
      against: a.Crime_Against ?? "Unclassified",
      lat: a.Latitude,
      lng: a.Longitude,
      npu: a.NPU,
    }))
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng) && p.lat > 30 && p.lat < 35.1 && p.lng > -85.7 && p.lng < -80.7);
  const points = all.filter((p) => p.reportedAt >= since.getTime());

  const agg = aggregate(points);
  const ytdRows = (ytd.features ?? []).map((f) => ({ category: f.attributes.NIBRS_Bucket ?? "Unclassified", count: f.attributes.n }));
  const latest = points.reduce((m, p) => Math.max(m, p.reportedAt), 0);

  const today = dateFmt.format(now);
  const daily = new Map<string, { weekday: number; count: number }>();
  for (let t = modelSince.getTime() + 86_400_000; t < now.getTime(); t += 86_400_000) {
    const d = new Date(t);
    daily.set(dateFmt.format(d), { weekday: WEEKDAYS.indexOf(weekdayFmt.format(d)), count: 0 });
  }
  for (const p of all) {
    const e = daily.get(dateFmt.format(new Date(p.reportedAt)));
    if (e) e.count++;
  }
  daily.delete(today);
  const series = [...daily.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }));
  const cp = bayesianChangePoint(series.map((d) => d.count));
  const fit = poissonForecast(series);

  const published = agg.cells[8];
  const hot = getisOrd(cellCounts(points, 8), new Set(published.map((c) => c.h3)));
  const hotById = new Map(hot.map((h) => [h.h3, h]));
  const hex8 = cellsToGeoJSON(published);
  for (const f of hex8.features) Object.assign(f.properties, { giZ: hotById.get(f.properties.h3)?.z ?? 0, giConf: hotById.get(f.properties.h3)?.confidence ?? 0 });

  const npuCounts = new Map<string, number>();
  for (const p of points) if (p.npu) npuCounts.set(p.npu, (npuCounts.get(p.npu) ?? 0) + 1);
  const npuRates = [...npuCounts.entries()]
    .map(([npu, n]) => {
      const pop = ctx.population.get(npu);
      return { npu, count: n, population: pop?.TotPop_e24 ?? null, moe: pop?.TotPop_m24 ?? null, per100k: pop?.TotPop_e24 ? (n / pop.TotPop_e24) * 100_000 : null };
    })
    .filter((r) => r.count >= K_MIN)
    .sort((a, b) => (b.per100k ?? -1) - (a.per100k ?? -1));
  const cityPop = [...ctx.population.values()].reduce((s, v) => s + (v.TotPop_e24 ?? 0), 0);

  const ago = (min: number) => points.filter((p) => p.reportedAt >= now.getTime() - min * 60_000).length;
  const lagMin = latest ? Math.round((now.getTime() - latest) / 60_000) : null;

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
    hex: { 7: cellsToGeoJSON(agg.cells[7]), 8: hex8 },
    density: cellCentroids(published),
    recent: { lagMinutes: lagMin, last15m: ago(15), last30m: ago(30), last60m: ago(60), last24h: ago(1440) },
    models: {
      days: series.length,
      from: series[0]?.date ?? null,
      to: series[series.length - 1]?.date ?? null,
      daily: series,
      changePoint: cp
        ? { date: series[cp.index].date, probability: cp.probability, rateBefore: cp.rateBefore, rateAfter: cp.rateAfter }
        : null,
      poisson: fit && {
        dispersion: fit.dispersion,
        trendPerWeek: fit.trendPerWeek,
        weekdayRateRatio: fit.weekdayRateRatio,
        forecast: fit.forecast,
      },
      hotspots: {
        method: "Getis-Ord Gi* on published H3 res-8 cells, first-ring neighbours, zero-filled study area",
        cells99: hot.filter((h) => h.confidence === 99).length,
        cells95: hot.filter((h) => h.confidence === 95).length,
        cells90: hot.filter((h) => h.confidence === 90).length,
        top: hot.slice(0, 5),
      },
    },
    precincts: {
      source: PRECINCTS,
      method: "Voronoi (nearest-precinct) partition of the last 30 days of reports",
      geojson: ctx.sites.length >= 2 ? voronoiCounts(ctx.sites, points, ATL_BBOX) : null,
    },
    rates: {
      source: "Atlanta Regional Commission — ACS 2020–2024 5-year population by NPU (CC BY 4.0)",
      sourceUrl: ARC_ITEM,
      cityPopulation: cityPop || null,
      cityPer100k: cityPop ? (points.length / cityPop) * 100_000 : null,
      byNpu: npuRates,
      note: "Residential population; areas with many workers or visitors (e.g. Downtown) show high per-resident rates.",
    },
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

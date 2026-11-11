import { NextResponse } from "next/server";
import { metarCloudSlabs, type Metar } from "../../../lib/ga-clouds/metar-clouds";
import { MODEL_LEVELS_HPA, modelCloudCells, modelGrid, refineMetarTops, type OpenMeteoPoint } from "../../../lib/ga-clouds/model-clouds";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const AWC = "https://aviationweather.gov/api/data/metar?bbox=30.3,-85.7,35.1,-80.8&format=json";
const HEADERS = { "User-Agent": "brain-lab-global-anomaly-map (witternif2003@gmail.com)", Accept: "application/json" };
const TTL_MS = 5 * 60_000;
/** HRRR runs hourly; 90 min keeps the 100-point grid well inside Open-Meteo's free daily call budget. */
const MODEL_TTL_MS = 90 * 60_000;
const MODEL_DOCS = "https://open-meteo.com/en/docs/gfs-api";

function modelUrl(): string {
  const grid = modelGrid();
  const vars = MODEL_LEVELS_HPA.flatMap((h) => [`cloud_cover_${h}hPa`, `geopotential_height_${h}hPa`]).join(",");
  const q = new URLSearchParams({
    latitude: grid.map(([lat]) => lat).join(","),
    longitude: grid.map(([, lng]) => lng).join(","),
    hourly: vars,
    models: "gfs_hrrr",
    past_hours: "1",
    forecast_hours: "3",
    timezone: "GMT",
  });
  return `https://api.open-meteo.com/v1/gfs?${q}`;
}

let cache: { at: number; metars: Metar[] } | null = null;
let modelCache: { at: number; points: OpenMeteoPoint[] } | null = null;
let modelError: string | null = null;

async function loadModel(): Promise<OpenMeteoPoint[] | null> {
  if (modelCache && Date.now() - modelCache.at < MODEL_TTL_MS) return modelCache.points;
  try {
    const r = await fetch(modelUrl(), { signal: AbortSignal.timeout(20_000), headers: HEADERS, cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status} (Open-Meteo HRRR)`);
    const j = (await r.json()) as OpenMeteoPoint[] | OpenMeteoPoint;
    modelCache = { at: Date.now(), points: Array.isArray(j) ? j : [j] };
    modelError = null;
  } catch (e) {
    modelError = e instanceof Error ? e.message : String(e);
  }
  return modelCache?.points ?? null;
}

export async function GET(req: Request) {
  try {
    const [, points] = await Promise.all([
      (async () => {
        if (cache && Date.now() - cache.at <= TTL_MS) return;
        const r = await fetch(AWC, { signal: AbortSignal.timeout(15_000), headers: HEADERS, cache: "no-store" });
        if (!r.ok) throw new Error(`HTTP ${r.status} (${AWC})`);
        cache = { at: Date.now(), metars: (await r.json()) as Metar[] };
      })(),
      loadModel(),
    ]);
    const metars = cache?.metars ?? [];
    const segments = new URL(req.url).searchParams.get("lite") === "1" ? 16 : 32;
    const model = points ? modelCloudCells(points, new Date()) : null;
    const slabs = metarCloudSlabs(metars, segments);
    const geojson = model ? refineMetarTops(slabs, model.geojson) : slabs;
    const latest = metars.reduce<string | null>((m, x) => (x.reportTime && (!m || x.reportTime > m) ? x.reportTime : m), null);
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        source: "NOAA Aviation Weather Center METAR cloud layers (ceilometer base heights above ground)",
        sourceUrl: "https://aviationweather.gov/data/api/",
        stations: metars.length,
        latestObservation: latest,
        geojson,
        model: {
          source: "NOAA HRRR 3 km model cloud cover on 16 pressure levels, via Open-Meteo (CC BY 4.0)",
          sourceUrl: MODEL_DOCS,
          gridDeg: 0.5,
          gridPoints: points?.length ?? 0,
          validTime: model?.validTime ?? null,
          fetchedAt: modelCache ? new Date(modelCache.at).toISOString() : null,
          error: modelError,
          geojson: model?.geojson ?? { type: "FeatureCollection", features: [] },
        },
      },
      { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120" } },
    );
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e), generatedAt: new Date().toISOString() }, { status: 502 });
  }
}

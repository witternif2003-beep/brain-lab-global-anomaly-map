import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { readMrmsGrib2, type MrmsGrid } from "../../../lib/ga-clouds/mrms";
import { BASE_SEARCH_KM, nearestBase, RADAR_BBOX, stationBases } from "../../../lib/ga-clouds/radar-clouds";
import type { Metar } from "../../../lib/ga-clouds/metar-clouds";
import { DEFAULT_BASE_M } from "../../../lib/ga-precip/droplets";
import { precipCells, RATE_BANDS_MMH } from "../../../lib/ga-precip/precip-cells";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MRMS = "https://mrms.ncep.noaa.gov/2D";
const DOCS = "https://www.nssl.noaa.gov/projects/mrms/operational/tables.php";
const PRODUCTS = { flag: "PrecipFlag", rate: "PrecipRate", qpe: "RadarOnly_QPE_01H" } as const;
const HEADERS = { "User-Agent": "brain-lab-global-anomaly-map (witternif2003@gmail.com)" };
/** MRMS PrecipFlag, PrecipRate and RadarOnly_QPE_01H update every 2 minutes. */
const TTL_MS = 2 * 60_000;

let grids: { at: number; flag: MrmsGrid; rate: MrmsGrid; qpe: MrmsGrid | null; qpeError: string | null } | null = null;
let gridError: string | null = null;
const AWC = "https://aviationweather.gov/api/data/metar?bbox=30.3,-85.7,35.1,-80.8&format=json";
let metars: { at: number; list: Metar[] } | null = null;
async function loadMetars() {
  if (metars && Date.now() - metars.at < 5 * 60_000) return;
  try {
    const r = await fetch(AWC, { signal: AbortSignal.timeout(15_000), headers: { ...HEADERS, Accept: "application/json" }, cache: "no-store" });
    if (r.ok) metars = { at: Date.now(), list: (await r.json()) as Metar[] };
  } catch { /* bases fall back to DEFAULT_BASE_M, flagged per feature */ }
}

async function mrmsOnce(product: string): Promise<MrmsGrid> {
  const url = `${MRMS}/${product}/MRMS_${product}.latest.grib2.gz`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: HEADERS, cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} (${url})`);
  return readMrmsGrib2(gunzipSync(Buffer.from(await r.arrayBuffer())), RADAR_BBOX);
}

/** `.latest` can be fetched while NOAA is replacing it (seen as a truncated gzip, "unexpected end of file"); retry once. */
async function mrms(product: string): Promise<MrmsGrid> {
  try {
    return await mrmsOnce(product);
  } catch {
    await new Promise((r) => setTimeout(r, 1500));
    return mrmsOnce(product);
  }
}

async function loadGrids() {
  if (grids && Date.now() - grids.at < TTL_MS) return;
  try {
    const [flag, rate, qpe] = await Promise.all([mrms(PRODUCTS.flag), mrms(PRODUCTS.rate), mrms(PRODUCTS.qpe).catch((e: unknown) => e as Error)]);
    grids = { at: Date.now(), flag, rate, qpe: qpe instanceof Error ? null : qpe, qpeError: qpe instanceof Error ? qpe.message : null };
    gridError = null;
  } catch (e) {
    gridError = e instanceof Error ? e.message : String(e);
  }
}

export async function GET(req: Request) {
  await Promise.all([loadGrids(), loadMetars()]);
  if (!grids) return NextResponse.json({ error: gridError ?? "MRMS unavailable", generatedAt: new Date().toISOString() }, { status: 502 });
  const factor = new URL(req.url).searchParams.get("lite") === "1" ? 4 : 2;
  const { geojson, summary } = precipCells(grids.flag, grids.rate, grids.qpe, factor);
  const stations = stationBases(metars?.list ?? []);
  for (const f of geojson.features) {
    const ring = f.geometry.coordinates[0];
    const s = nearestBase(stations, (ring[0][1] + ring[2][1]) / 2, (ring[0][0] + ring[1][0]) / 2);
    f.properties = { ...f.properties, baseM: s ? s.baseM : DEFAULT_BASE_M, baseStation: s ? s.id : null };
  }
  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      source: "NOAA MRMS: surface precipitation type (PrecipFlag), radar precipitation rate (PrecipRate, mm/h) and radar 1-hour accumulation (RadarOnly_QPE_01H, mm), 0.01° grid, every 2 min",
      sourceUrl: `${MRMS}/`,
      docsUrl: DOCS,
      observedAt: grids.flag.time,
      rateAt: grids.rate.time,
      qpeAt: grids.qpe?.time ?? null,
      fetchedAt: new Date(grids.at).toISOString(),
      nativeCellDeg: grids.flag.stepDeg,
      cellDeg: +(grids.flag.stepDeg * factor).toFixed(4),
      rateBandsMmH: RATE_BANDS_MMH,
      summary,
      baseRule: `drops start at the nearest METAR lowest cloud base within ${BASE_SEARCH_KM} km (NOAA AWC), else ${DEFAULT_BASE_M} m above ground (assumed)`,
      metarStations: stations.length,
      error: gridError ?? grids.qpeError,
      geojson,
    },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } },
  );
}

import { gunzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import type { Metar } from "../../../lib/ga-clouds/metar-clouds";
import { readMrmsGrib2, type MrmsGrid } from "../../../lib/ga-clouds/mrms";
import { BASE_SEARCH_KM, RADAR_BBOX, radarCloudBlocks } from "../../../lib/ga-clouds/radar-clouds";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const MRMS = "https://mrms.ncep.noaa.gov/2D";
const PRODUCTS = { top: "EchoTop_18", dbz: "MergedReflectivityQCComposite" } as const;
const AWC = "https://aviationweather.gov/api/data/metar?bbox=30.3,-85.7,35.1,-80.8&format=json";
const HEADERS = { "User-Agent": "brain-lab-global-anomaly-map (witternif2003@gmail.com)" };
/** MRMS mosaics update every 2 minutes. */
const TTL_MS = 2 * 60_000;
const METAR_TTL_MS = 5 * 60_000;

let grids: { at: number; top: MrmsGrid; dbz: MrmsGrid } | null = null;
let metars: { at: number; list: Metar[] } | null = null;
let gridError: string | null = null;

async function mrms(product: string): Promise<MrmsGrid> {
  const url = `${MRMS}/${product}/MRMS_${product}.latest.grib2.gz`;
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: HEADERS, cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} (${url})`);
  return readMrmsGrib2(gunzipSync(Buffer.from(await r.arrayBuffer())), RADAR_BBOX);
}

async function loadGrids() {
  if (grids && Date.now() - grids.at < TTL_MS) return;
  try {
    const [top, dbz] = await Promise.all([mrms(PRODUCTS.top), mrms(PRODUCTS.dbz)]);
    grids = { at: Date.now(), top, dbz };
    gridError = null;
  } catch (e) {
    gridError = e instanceof Error ? e.message : String(e);
  }
}

async function loadMetars() {
  if (metars && Date.now() - metars.at < METAR_TTL_MS) return;
  try {
    const r = await fetch(AWC, { signal: AbortSignal.timeout(15_000), headers: { ...HEADERS, Accept: "application/json" }, cache: "no-store" });
    if (r.ok) metars = { at: Date.now(), list: (await r.json()) as Metar[] };
  } catch {
    /* bases fall back to ground level; reported per block via baseStation = null */
  }
}

export async function GET(req: Request) {
  await Promise.all([loadGrids(), loadMetars()]);
  if (!grids) return NextResponse.json({ error: gridError ?? "MRMS unavailable", generatedAt: new Date().toISOString() }, { status: 502 });
  const lite = new URL(req.url).searchParams.get("lite") === "1";
  const opts = lite ? { factor: 2, topStepM: 500 } : { factor: 1, topStepM: 250 };
  const geojson = radarCloudBlocks(grids.top, grids.dbz, metars?.list ?? [], { ...opts, now: new Date() });
  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      source: "NOAA MRMS radar mosaic: 18 dBZ echo top (km above sea level) and QC'd composite reflectivity, 0.01° grid",
      sourceUrl: `${MRMS}/`,
      observedAt: grids.top.time,
      reflectivityAt: grids.dbz.time,
      fetchedAt: new Date(grids.at).toISOString(),
      cellDeg: grids.top.stepDeg * opts.factor,
      topStepM: opts.topStepM,
      baseRule: `nearest METAR lowest cloud base within ${BASE_SEARCH_KM} km (NOAA AWC); ground if none`,
      metarStations: metars?.list.length ?? 0,
      error: gridError,
      geojson,
    },
    { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } },
  );
}

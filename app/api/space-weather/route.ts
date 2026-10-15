import { NextResponse } from "next/server";
import {
  auroraGeojson, currentScales, latestKp, solarWind, summarizeDonki,
  type DonkiCme, type DonkiFlare, type DonkiStorm, type OvationGrid,
} from "../../../lib/space-weather/normalize";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SWPC = "https://services.swpc.noaa.gov";
const DONKI = "https://ccmc.gsfc.nasa.gov/DONKI-API/get";
const DONKI_DAYS = 7;
const HEADERS = { "User-Agent": "brain-lab-global-anomaly-map (witternif2003@gmail.com)", Accept: "application/json" };
const TTL_MS = 5 * 60_000;

let cache: { at: number; body: unknown } | null = null;

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: HEADERS, cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} (${url})`);
  return (await r.json()) as T;
}

const day = (d: Date) => d.toISOString().slice(0, 10);
const val = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === "fulfilled" ? r.value : null);
const err = (r: PromiseSettledResult<unknown>) => (r.status === "rejected" ? String(r.reason) : null);

async function build() {
  const end = new Date();
  const start = new Date(end.getTime() - DONKI_DAYS * 86_400_000);
  const range = `startDate=${day(start)}&endDate=${day(end)}`;
  const [ovation, kp, scales, wind, mag, flr, cme, gst] = await Promise.allSettled([
    getJson<OvationGrid>(`${SWPC}/json/ovation_aurora_latest.json`),
    getJson<unknown>(`${SWPC}/products/noaa-planetary-k-index.json`),
    getJson<unknown>(`${SWPC}/products/noaa-scales.json`),
    getJson<unknown>(`${SWPC}/json/rtsw/rtsw_wind_1m.json`),
    getJson<unknown>(`${SWPC}/json/rtsw/rtsw_mag_1m.json`),
    getJson<DonkiFlare[]>(`${DONKI}/FLR?${range}`),
    getJson<DonkiCme[]>(`${DONKI}/CME?${range}`),
    getJson<DonkiStorm[]>(`${DONKI}/GST?${range}`),
  ]);
  const grid = val(ovation);
  const aurora = grid ? auroraGeojson(grid) : { type: "FeatureCollection" as const, features: [] };
  return {
    generatedAt: end.toISOString(),
    aurora: {
      source: "NOAA SWPC OVATION aurora forecast (30–90 min ahead)",
      sourceUrl: "https://www.swpc.noaa.gov/products/aurora-30-minute-forecast",
      observationTime: grid?.["Observation Time"] ?? null,
      forecastTime: grid?.["Forecast Time"] ?? null,
      maxProbability: aurora.features.reduce((m, f) => Math.max(m, Number(f.properties?.p) || 0), 0),
      geojson: aurora,
      error: err(ovation),
    },
    kp: { source: "NOAA SWPC planetary K-index", sourceUrl: "https://www.swpc.noaa.gov/products/planetary-k-index", latest: latestKp(val(kp)), error: err(kp) },
    scales: { source: "NOAA space weather scales", sourceUrl: "https://www.swpc.noaa.gov/noaa-scales-explanation", current: currentScales(val(scales)), error: err(scales) },
    solarWind: {
      ...solarWind(val(wind), val(mag)),
      dataset: "NOAA SWPC real-time solar wind (L1 spacecraft)",
      sourceUrl: "https://www.swpc.noaa.gov/products/real-time-solar-wind",
      error: err(wind) ?? err(mag),
    },
    donki: {
      source: `NASA CCMC DONKI flares, CMEs and geomagnetic storms (last ${DONKI_DAYS} days)`,
      sourceUrl: "https://ccmc.gsfc.nasa.gov/DONKI/",
      ...summarizeDonki(val(flr) ?? [], val(cme) ?? [], val(gst) ?? []),
      error: err(flr) ?? err(cme) ?? err(gst),
    },
  };
}

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), body: await build() };
    return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=120" } });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e), generatedAt: new Date().toISOString() }, { status: 502 });
  }
}

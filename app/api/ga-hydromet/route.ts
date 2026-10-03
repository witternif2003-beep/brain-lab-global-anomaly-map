import { NextResponse } from "next/server";
import { isGaZone, normalizeAlerts, normalizeGauges, type NwpsGauge, type NwsAlert } from "../../../lib/ga-hydromet/normalize";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const NWS = "https://api.weather.gov/alerts/active?area=GA";
const NWPS =
  "https://api.water.noaa.gov/nwps/v1/gauges?bbox.xmin=-85.7&bbox.ymin=30.3&bbox.xmax=-80.8&bbox.ymax=35.1&srid=EPSG_4326";
const HEADERS = { "User-Agent": "brain-lab-global-anomaly-map (witternif2003@gmail.com)", Accept: "application/geo+json, application/json" };
const TTL_MS = 5 * 60_000;
const MAX_ZONE_FETCH = 80;

let cache: { at: number; body: unknown } | null = null;
const zones = new Map<string, GeoJSON.Geometry>();

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!r.ok) throw new Error(`HTTP ${r.status} (${url})`);
  return (await r.json()) as T;
}

async function loadZones(alerts: NwsAlert[]) {
  const missing = [...new Set(alerts.flatMap((a) => a.properties.affectedZones))]
    .filter((u) => isGaZone(u) && !zones.has(u))
    .slice(0, MAX_ZONE_FETCH);
  await Promise.all(
    missing.map((u) =>
      getJson<{ geometry: GeoJSON.Geometry | null }>(u)
        .then((z) => z.geometry && zones.set(u, z.geometry))
        .catch(() => undefined),
    ),
  );
}

async function build() {
  const [alertsRes, gaugesRes] = await Promise.allSettled([
    getJson<{ features: NwsAlert[]; updated?: string }>(NWS),
    getJson<{ gauges: NwpsGauge[] }>(NWPS),
  ]);
  if (alertsRes.status === "rejected" && gaugesRes.status === "rejected") throw alertsRes.reason;
  const alertList = alertsRes.status === "fulfilled" ? alertsRes.value.features : [];
  await loadZones(alertList);
  return {
    generatedAt: new Date().toISOString(),
    alerts: {
      source: "National Weather Service active alerts for Georgia (api.weather.gov)",
      sourceUrl: "https://www.weather.gov/ffc/",
      updated: alertsRes.status === "fulfilled" ? alertsRes.value.updated ?? null : null,
      error: alertsRes.status === "rejected" ? String(alertsRes.reason) : null,
      ...normalizeAlerts(alertList, (u) => zones.get(u)),
    },
    gauges: {
      source: "NOAA National Water Prediction Service river gauges (observed stage, flow and NWS flood category)",
      sourceUrl: "https://water.noaa.gov/",
      error: gaugesRes.status === "rejected" ? String(gaugesRes.reason) : null,
      ...normalizeGauges(gaugesRes.status === "fulfilled" ? gaugesRes.value.gauges : []),
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

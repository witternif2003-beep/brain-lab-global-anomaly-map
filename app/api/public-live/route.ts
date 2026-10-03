import { NextRequest, NextResponse } from "next/server";
import { PUBLIC_LIVE } from "../../../lib/public-live/jurisdictions";
import { JURISDICTIONS } from "../../../lib/territory-catalog";
import LAUS from "../../../lib/public-live/laus-latest.json";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const UA = "brain-lab public-live (witternif2003@gmail.com)";
const AIRNOW_URL = "https://files.airnowtech.org/airnow/today/reportingarea.dat";
const AIRNOW_TTL_MS = 5 * 60_000;
const DAY_MS = 86_400_000;

interface Feed<T> {
  ok: boolean;
  source: string;
  sourceUrl: string;
  retrievedAt: string;
  total?: number;
  items: T[];
  note?: string;
  error?: string;
}

async function feed<T>(
  source: string,
  sourceUrl: string,
  run: () => Promise<{ items: T[]; total?: number; note?: string }>,
): Promise<Feed<T>> {
  const retrievedAt = new Date().toISOString();
  try {
    return { ok: true, source, sourceUrl, retrievedAt, ...(await run()) };
  } catch (e) {
    return { ok: false, source, sourceUrl, retrievedAt, items: [], error: e instanceof Error ? e.message : String(e) };
  }
}

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-store", headers: { "User-Agent": UA, Accept: "application/json, application/geo+json" } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

interface NwsFeature {
  properties: {
    "@id": string;
    event: string;
    severity: string;
    urgency: string;
    headline: string | null;
    areaDesc: string;
    sent: string;
    expires: string | null;
    senderName: string;
  };
}

function nws(code: string) {
  const url = `https://api.weather.gov/alerts/active?area=${code}`;
  return feed("National Weather Service — active alerts", url, async () => {
    const d = await getJson<{ features: NwsFeature[] }>(url);
    const items = d.features
      .map((f) => f.properties)
      .sort((a, b) => b.sent.localeCompare(a.sent))
      .map((p) => ({
        event: p.event,
        severity: p.severity,
        urgency: p.urgency,
        headline: p.headline,
        area: p.areaDesc,
        sent: p.sent,
        expires: p.expires,
        sender: p.senderName,
        url: p["@id"],
      }));
    return { total: items.length, items: items.slice(0, 15) };
  });
}

interface FemaRow {
  disasterNumber: number;
  femaDeclarationString: string;
  declarationType: string;
  declarationDate: string;
  incidentType: string;
  declarationTitle: string;
  designatedArea: string;
}

function fema(code: string) {
  const q = new URLSearchParams({
    $filter: `state eq '${code}'`,
    $orderby: "declarationDate desc",
    $top: "500",
    $select: "disasterNumber,femaDeclarationString,declarationType,declarationDate,incidentType,declarationTitle,designatedArea",
  });
  const url = `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?${q}`;
  return feed("FEMA OpenFEMA — disaster declarations", url, async () => {
    const d = await getJson<{ DisasterDeclarationsSummaries: FemaRow[] }>(url);
    const byNumber = new Map<number, FemaRow & { areas: number }>();
    for (const r of d.DisasterDeclarationsSummaries) {
      const cur = byNumber.get(r.disasterNumber);
      if (cur) cur.areas += 1;
      else byNumber.set(r.disasterNumber, { ...r, areas: 1 });
    }
    const all = [...byNumber.values()];
    const yearAgo = Date.now() - 365 * DAY_MS;
    const items = all.slice(0, 10).map((r) => ({
      id: r.femaDeclarationString,
      type: r.declarationType,
      date: r.declarationDate,
      incident: r.incidentType,
      title: r.declarationTitle,
      areas: r.areas,
      url: `https://www.fema.gov/disaster/${r.disasterNumber}`,
    }));
    return {
      total: all.filter((r) => Date.parse(r.declarationDate) >= yearAgo).length,
      items,
      note: "total = declarations in the last 12 months",
    };
  });
}

interface UsgsFeature {
  id: string;
  properties: { mag: number | null; place: string | null; time: number; url: string; type: string };
}

function usgs(code: string) {
  const [w, s, e, n] = PUBLIC_LIVE[code].bbox;
  const q = new URLSearchParams({
    format: "geojson",
    starttime: new Date(Date.now() - 30 * DAY_MS).toISOString().slice(0, 10),
    minlatitude: String(s),
    maxlatitude: String(n),
    minlongitude: String(w),
    maxlongitude: String(e),
  });
  const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?${q}&orderby=time&limit=100`;
  return feed("USGS Earthquake Hazards — events, last 30 days", url, async () => {
    const [list, count] = await Promise.all([
      getJson<{ features: UsgsFeature[] }>(url),
      getJson<{ count: number }>(`https://earthquake.usgs.gov/fdsnws/event/1/count?${q}`),
    ]);
    return {
      total: count.count,
      items: list.features
        .filter((f) => !placeElsewhere(f.properties.place, code))
        .slice(0, 10)
        .map((f) => ({
          mag: f.properties.mag,
          place: f.properties.place,
          time: new Date(f.properties.time).toISOString(),
          type: f.properties.type,
          url: f.properties.url,
        })),
      note: "total counts the jurisdiction's bounding box, which can include nearby areas; the list drops events USGS places in another state",
    };
  });
}

// USGS "place" ends with a U.S. state/territory name (California as "CA").
const PLACE_CODE: Record<string, string> = Object.fromEntries([
  ...JURISDICTIONS.map((j) => [j.name, j.code]),
  ["CA", "CA"],
  ["U.S. Virgin Islands", "VI"],
]);

function placeElsewhere(place: string | null, code: string): boolean {
  const suffix = place?.split(", ").at(-1);
  const other = suffix ? PLACE_CODE[suffix] : undefined;
  return other !== undefined && other !== code;
}

let airnowCache: { at: number; lines: string[] } | null = null;

async function airnowLines(): Promise<string[]> {
  if (airnowCache && Date.now() - airnowCache.at < AIRNOW_TTL_MS) return airnowCache.lines;
  const r = await fetch(AIRNOW_URL, { cache: "no-store", headers: { "User-Agent": UA } });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const lines = (await r.text()).split("\n");
  airnowCache = { at: Date.now(), lines };
  return lines;
}

function airnow(code: string) {
  return feed("EPA AirNow — current AQI by reporting area", AIRNOW_URL, async () => {
    const latest = new Map<string, { area: string; aqi: number; category: string; pollutant: string; observed: string; agency: string }>();
    for (const line of await airnowLines()) {
      const f = line.split("|");
      // ValidDate|ValidTime|TimeZone … DataType O = hourly observation, primary pollutant = Y.
      if (f.length < 17 || f[8] !== code || f[5] !== "O" || f[6] !== "Y") continue;
      const aqi = Number(f[12]);
      if (!Number.isFinite(aqi)) continue;
      const observed = `${f[1]} ${f[2]} ${f[3]}`;
      const prev = latest.get(f[7]);
      if (!prev || observed > prev.observed) {
        latest.set(f[7], { area: f[7], aqi, category: f[13], pollutant: f[11], observed, agency: f[16].trim() });
      }
    }
    const items = [...latest.values()].sort((a, b) => b.aqi - a.aqi);
    return {
      total: items.length,
      items,
      note: items.length ? undefined : "AirNow publishes no reporting area for this jurisdiction",
    };
  });
}

type LausSeries = {
  latest: { period: string; rate: number; unemployed?: number; laborForce?: number };
  history: { period: string; rate: number }[];
};

function bls(code: string): Feed<LausSeries> {
  const s = (LAUS.series as Record<string, LausSeries>)[code];
  return {
    ok: true,
    source: "BLS LAUS — unemployment rate (seasonally adjusted, monthly)",
    sourceUrl: LAUS.sourceUrl,
    retrievedAt: LAUS.retrievedAt,
    items: s ? [s] : [],
    note: s ? "monthly release; snapshot of the latest published month" : "BLS LAUS does not publish this jurisdiction",
  };
}

export async function GET(req: NextRequest) {
  const code = (req.nextUrl.searchParams.get("code") ?? "").toUpperCase();
  if (!PUBLIC_LIVE[code]) {
    return NextResponse.json({ error: "unknown jurisdiction code" }, { status: 400 });
  }
  const [alerts, disasters, quakes, air] = await Promise.all([nws(code), fema(code), usgs(code), airnow(code)]);
  const res = NextResponse.json({
    code,
    generatedAt: new Date().toISOString(),
    feeds: { alerts, disasters, quakes, air, jobs: bls(code) },
  });
  res.headers.set("Cache-Control", "public, s-maxage=120, stale-while-revalidate=300");
  return res;
}

import { NextResponse } from "next/server";
import { dedupeByNorad, fromSatnogs, parseTle, type SatnogsTle, type TleEntry } from "../../../lib/ga-satellites/tle";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const CELESTRAK = "https://celestrak.org/NORAD/elements/gp.php";
const GROUPS: Record<string, string> = {
  stations: "Space stations",
  weather: "Weather",
  resource: "Earth resources",
  science: "Science",
  geodetic: "Geodetic",
  "gps-ops": "GPS",
};
const SATNOGS = "https://db.satnogs.org/api/tle/?format=json";
const TTL_MS = 2 * 60 * 60_000;

let cache: { at: number; body: unknown } | null = null;

async function text(url: string): Promise<string> {
  const r = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "brain-lab-global-anomaly-map (witternif2003@gmail.com)" } });
  if (!r.ok) throw new Error(`HTTP ${r.status} (${url})`);
  return r.text();
}

async function build() {
  const groups = Object.entries(GROUPS);
  const results = await Promise.allSettled(groups.map(([g]) => text(`${CELESTRAK}?GROUP=${g}&FORMAT=tle`)));
  const errors = results.flatMap((r, i) => (r.status === "rejected" ? [`${groups[i][0]}: ${String(r.reason)}`] : []));
  let sats: TleEntry[] = results.flatMap((r, i) => (r.status === "fulfilled" ? parseTle(r.value, groups[i][1]) : []));
  let source = "CelesTrak GP element sets (TLE), groups: " + Object.values(GROUPS).join(", ");
  let sourceUrl = "https://celestrak.org/NORAD/elements/";
  if (!sats.length) {
    sats = fromSatnogs(JSON.parse(await text(SATNOGS)) as SatnogsTle[], "SatNOGS catalogue");
    source = "SatNOGS DB TLE set (mostly Space-Track.org elements); CelesTrak unreachable";
    sourceUrl = "https://db.satnogs.org/";
  }
  return { generatedAt: new Date().toISOString(), source, sourceUrl, errors, satellites: dedupeByNorad(sats) };
}

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) cache = { at: Date.now(), body: await build() };
    return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, s-maxage=7200, stale-while-revalidate=3600" } });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 502 });
  }
}

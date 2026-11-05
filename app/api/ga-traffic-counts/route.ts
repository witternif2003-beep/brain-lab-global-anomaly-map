import { NextResponse } from "next/server";
import { buildCounts, TADA_BASE, TADA_NODE, TADA_PAGE, type CountsPayload, type TadaSite, type TadaSnapshot } from "../../../lib/ga-traffic-counts/normalize";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SITES_TTL_MS = 24 * 3_600_000;
const SNAP_TTL_MS = 3 * 60_000;
const HEADERS = { "Content-Type": "application/json;charset=UTF-8", "X-Requested-With": "XMLHttpRequest", Referer: TADA_PAGE };

let sites: { at: number; list: TadaSite[] } | null = null;
let cache: { at: number; body: CountsPayload } | null = null;
let inflight: Promise<CountsPayload> | null = null;

async function post<T>(path: string, body: unknown, timeoutMs: number): Promise<T> {
  const r = await fetch(`${TADA_BASE}/dataserver${path}`, { method: "POST", headers: HEADERS, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
  if (!r.ok) throw new Error(`GDOT TADA ${path} HTTP ${r.status}`);
  const j = (await r.json()) as { isError?: boolean; message?: string; data?: T };
  if (j.isError || j.data === undefined) throw new Error(`GDOT TADA ${path}: ${j.message ?? "no data"}`);
  return j.data;
}

async function siteList(): Promise<TadaSite[]> {
  if (sites && Date.now() - sites.at < SITES_TTL_MS) return sites.list;
  const all = await post<Record<string, TadaSite>>("/public/sites", {}, 20_000);
  const list = Object.values(all).filter((s) => s.node === TADA_NODE);
  if (!list.length) throw new Error("GDOT TADA: no continuous count stations listed");
  sites = { at: Date.now(), list };
  return list;
}

async function build(): Promise<CountsPayload> {
  const list = await siteList();
  const snaps = await post<TadaSnapshot[]>("/liveSnapshot", { sites: list.filter((s) => !s.isDisabled).map((s) => s.id), lookbackHours: 1 }, 20_000);
  return {
    source: "Georgia DOT Traffic Analysis & Data (TADA) public portal: continuous count stations, live 15-minute vehicle counts and average speeds",
    sourceUrl: TADA_PAGE,
    ...buildCounts(list, snaps, Date.now()),
  };
}

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > SNAP_TTL_MS) {
      inflight ??= build().finally(() => (inflight = null));
      cache = { at: Date.now(), body: await inflight };
    }
    return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=60" } });
  } catch (e) {
    return NextResponse.json(
      { error: `Source Offline: ${e instanceof Error ? e.message : String(e)}`, sourceUrl: TADA_PAGE, generatedAt: new Date().toISOString() },
      { status: 502 },
    );
  }
}

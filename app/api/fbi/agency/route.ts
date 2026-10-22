import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { CDE_PUBLIC, GA_ORI, OFFENSES, parseAgencySummarized, type CdeAgencySummarized, type OffenseSeries } from "../../../../lib/fbi-agencies/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 25;

const TTL_MS = 60 * 60_000;
const MAX_CACHED = 300;
const cache = new Map<string, { at: number; body: Record<string, unknown> }>();

interface Fetched {
  offense: string;
  url: string;
  status: number | null;
  sha256: string | null;
  error: string | null;
  series: OffenseSeries | null;
  maxDataDate: string | null;
  lastRefreshDate: string | null;
}

async function one(ori: string, offense: (typeof OFFENSES)[number]["id"], from: string, to: string): Promise<Fetched> {
  const url = `${CDE_PUBLIC}/summarized/agency/${ori}/${offense}?from=${from}&to=${to}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" }, cache: "no-store" });
    const text = await r.text();
    if (!r.ok) return { offense, url, status: r.status, sha256: null, error: `HTTP ${r.status}`, series: null, maxDataDate: null, lastRefreshDate: null };
    const raw = JSON.parse(text) as CdeAgencySummarized;
    return {
      offense,
      url,
      status: r.status,
      sha256: createHash("sha256").update(text).digest("hex"),
      error: null,
      series: parseAgencySummarized(offense, raw),
      maxDataDate: raw.cde_properties?.max_data_date?.UCR ?? null,
      lastRefreshDate: raw.cde_properties?.last_refresh_date?.UCR ?? null,
    };
  } catch (e) {
    return { offense, url, status: null, sha256: null, error: e instanceof Error ? e.message : String(e), series: null, maxDataDate: null, lastRefreshDate: null };
  }
}

export async function GET(req: Request) {
  const ori = new URL(req.url).searchParams.get("ori") ?? "";
  if (!GA_ORI.test(ori)) return NextResponse.json({ error: "ori must be a Georgia FBI ORI (GA + 7 characters)" }, { status: 400 });
  const hit = cache.get(ori);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body, { headers: { "Cache-Control": "public, s-maxage=900" } });
  const y = new Date().getUTCFullYear();
  const results = await Promise.all(OFFENSES.map((o) => one(ori, o.id, `01-${y - 1}`, `12-${y}`)));
  const ok = results.filter((r) => r.series);
  if (!ok.length) return NextResponse.json({ error: `Source Offline: ${results[0]?.error ?? "no data"}`, ori, sources: results.map(({ series: _s, ...r }) => r) }, { status: 502 });
  const body = {
    ori,
    source: "FBI Uniform Crime Reporting Program, Crime Data Explorer (CDE) summarized agency offences",
    sourceGrade: "A (official FBI publication)",
    grain: "Agency × month × offence category, as published by the FBI; reported offences only, not a live feed",
    retrievedAt: new Date().toISOString(),
    maxDataDate: ok[0].maxDataDate,
    lastRefreshDate: ok[0].lastRefreshDate,
    series: ok.map((r) => r.series),
    sources: results.map(({ series: _s, ...r }) => r),
  };
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(ori, { at: Date.now(), body });
  return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=900" } });
}

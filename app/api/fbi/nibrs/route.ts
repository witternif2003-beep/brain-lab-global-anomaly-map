import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { NIBRS_OFFENSES, nibrsWindow, parseNibrsAgency, type CdeNibrsAgency, type NibrsCount, type NibrsRow } from "../../../../lib/fbi-agencies/nibrs";
import { CDE_PUBLIC, GA_ORI } from "../../../../lib/fbi-agencies/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const TTL_MS = 60 * 60_000;
const MAX_CACHED = 300;
const CONCURRENCY = 8;
const cache = new Map<string, { at: number; body: Record<string, unknown> }>();

interface Fetched {
  code: string;
  url: string;
  status: number | null;
  sha256: string | null;
  error: string | null;
  count: NibrsCount | null;
  maxDataDate?: string | null;
  lastRefreshDate?: string | null;
}

async function one(ori: string, code: string, from: string, to: string): Promise<Fetched> {
  const url = `${CDE_PUBLIC}/nibrs/agency/${ori}/${code}?from=${from}&to=${to}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" }, cache: "no-store" });
    const text = await r.text();
    if (!r.ok) return { code, url, status: r.status, sha256: null, error: `HTTP ${r.status}`, count: null };
    const raw = JSON.parse(text) as CdeNibrsAgency & { cde_properties?: { max_data_date?: { UCR?: string }; last_refresh_date?: { UCR?: string } } };
    return {
      code,
      url,
      status: r.status,
      sha256: createHash("sha256").update(text).digest("hex"),
      error: null,
      count: parseNibrsAgency(code, raw),
      maxDataDate: raw.cde_properties?.max_data_date?.UCR ?? null,
      lastRefreshDate: raw.cde_properties?.last_refresh_date?.UCR ?? null,
    };
  } catch (e) {
    return { code, url, status: null, sha256: null, error: e instanceof Error ? e.message : String(e), count: null };
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const ori = q.get("ori") ?? "";
  if (!GA_ORI.test(ori)) return NextResponse.json({ error: "ori must be a Georgia FBI ORI (GA + 7 characters)" }, { status: 400 });
  const hit = cache.get(ori);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body, { headers: { "Cache-Control": "public, s-maxage=900" } });
  const y = new Date().getUTCFullYear();
  const probe = await one(ori, NIBRS_OFFENSES[0].code, `01-${y}`, `12-${y}`);
  const win = nibrsWindow(probe.maxDataDate, new Date());
  const batch = async (from: string, to: string) => {
    const out: Fetched[] = [];
    for (let i = 0; i < NIBRS_OFFENSES.length; i += CONCURRENCY) out.push(...(await Promise.all(NIBRS_OFFENSES.slice(i, i + CONCURRENCY).map((o) => one(ori, o.code, from, to)))));
    return out;
  };
  const results = await batch(win.from, win.to);
  const latest = win.latest ? await batch(win.latest, win.latest) : [];
  const ok = results.filter((r) => r.count);
  if (!ok.length) return NextResponse.json({ error: `Source Offline: ${results[0]?.error ?? "no data"}`, ori, window: win }, { status: 502 });
  const latestBy = new Map(latest.map((r) => [r.code, r.count]));
  const counts: NibrsRow[] = ok.map((r) => {
    const l = latestBy.get(r.code) ?? null;
    return { ...r.count!, latestVictims: l?.victims ?? null, latestOffenders: l?.offenders ?? null, newInLatestFbiMonth: (l?.victims ?? 0) + (l?.offenders ?? 0) > 0 };
  });
  const body = {
    ori,
    window: win,
    fbiDataThrough: probe.maxDataDate ?? null,
    fbiLastRefresh: probe.lastRefreshDate ?? null,
    source: "FBI Uniform Crime Reporting Program, Crime Data Explorer (CDE), NIBRS agency offence detail",
    sourceGrade: "A (official FBI publication)",
    grain: `Agency × NIBRS Group A offence code, ${win.from} to ${win.to} (12 months ending at the FBI's newest month) plus the newest month alone; victims and offenders as counted by the FBI, not incidents`,
    retrievedAt: new Date().toISOString(),
    requested: NIBRS_OFFENSES.length,
    published: counts.filter((c) => c.victims !== null || c.offenders !== null).length,
    newInLatestFbiMonth: counts.filter((c) => c.newInLatestFbiMonth).length,
    counts,
    sources: [...results, ...latest].map(({ count: _c, ...r }) => r),
  };
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(ori, { at: Date.now(), body });
  return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=900" } });
}

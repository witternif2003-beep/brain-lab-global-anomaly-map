import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { NIBRS_OFFENSES, parseNibrsAgency, type CdeNibrsAgency, type NibrsCount } from "../../../../lib/fbi-agencies/nibrs";
import { CDE_PUBLIC, GA_ORI } from "../../../../lib/fbi-agencies/parse";

export const dynamic = "force-dynamic";
export const maxDuration = 45;

const TTL_MS = 24 * 60 * 60_000;
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
}

async function one(ori: string, code: string, year: number): Promise<Fetched> {
  const url = `${CDE_PUBLIC}/nibrs/agency/${ori}/${code}?from=01-${year}&to=12-${year}`;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" }, cache: "no-store" });
    const text = await r.text();
    if (!r.ok) return { code, url, status: r.status, sha256: null, error: `HTTP ${r.status}`, count: null };
    return { code, url, status: r.status, sha256: createHash("sha256").update(text).digest("hex"), error: null, count: parseNibrsAgency(code, JSON.parse(text) as CdeNibrsAgency) };
  } catch (e) {
    return { code, url, status: null, sha256: null, error: e instanceof Error ? e.message : String(e), count: null };
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const ori = q.get("ori") ?? "";
  if (!GA_ORI.test(ori)) return NextResponse.json({ error: "ori must be a Georgia FBI ORI (GA + 7 characters)" }, { status: 400 });
  const year = new Date().getUTCFullYear() - 1;
  const key = `${ori}|${year}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return NextResponse.json(hit.body, { headers: { "Cache-Control": "public, s-maxage=3600" } });
  const results: Fetched[] = [];
  for (let i = 0; i < NIBRS_OFFENSES.length; i += CONCURRENCY) {
    results.push(...(await Promise.all(NIBRS_OFFENSES.slice(i, i + CONCURRENCY).map((o) => one(ori, o.code, year)))));
  }
  const ok = results.filter((r) => r.count);
  if (!ok.length) return NextResponse.json({ error: `Source Offline: ${results[0]?.error ?? "no data"}`, ori, year }, { status: 502 });
  const counts = ok.map((r) => r.count!);
  const body = {
    ori,
    year,
    source: "FBI Uniform Crime Reporting Program, Crime Data Explorer (CDE), NIBRS agency offence detail",
    sourceGrade: "A (official FBI publication)",
    grain: `Agency × NIBRS Group A offence code, calendar year ${year}; victims and offenders as counted by the FBI, not incidents; not a live feed`,
    retrievedAt: new Date().toISOString(),
    requested: NIBRS_OFFENSES.length,
    published: counts.filter((c) => c.victims !== null || c.offenders !== null).length,
    counts,
    sources: results.map(({ count: _c, ...r }) => r),
  };
  if (cache.size >= MAX_CACHED) cache.delete(cache.keys().next().value!);
  cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body, { headers: { "Cache-Control": "public, s-maxage=3600" } });
}

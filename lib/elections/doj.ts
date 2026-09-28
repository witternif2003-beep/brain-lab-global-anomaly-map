/**
 * justice.gov press releases touching voting/elections.
 *
 * Fetches the DOJ news RSS feed at runtime, keeps items whose titles touch
 * voting/elections/ballots, and attributes each kept item to jurisdictions
 * ONLY by explicit jurisdiction-name mention in the title (labeled on every
 * item). justice.gov bot-walls most automated clients: when the runtime
 * cannot retrieve the feed, the result is honestly { available: false } —
 * never substituted, never estimated.
 */
import { ELECTION_OFFICES } from "./offices";
import type { DojRelease } from "./types";

const DOJ_RSS_URL =
  "https://www.justice.gov/news/rss?type%5B0%5D=press_release&search_api_language=en";
const UA = "Mozilla/5.0 (compatible; BrainLab/1.0)";

const VOTING_RE = /\b(vot\w*|ballot|election|electoral|noncitizen|non-citizen)\b/i;

export interface DojResult {
  available: boolean;
  reason: string | null;
  fetchedAt: string;
  /** code -> releases attributed by name mention */
  byCode: Map<string, DojRelease[]>;
}

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
let cache: DojResult | null = null;
let cacheAt = 0;

/** Jurisdiction match patterns, longest first (West Virginia before Virginia). */
const PATTERNS: Array<{ code: string; re: RegExp }> = ELECTION_OFFICES.map((o) => {
  let name = o.jurisdiction.toLowerCase();
  if (o.code === "MP") name = "mariana";
  if (o.code === "AS") name = "samoa";
  return { code: o.code, name, re: new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i") };
}).sort((a, b) => b.name.length - a.name.length);

interface RssItem { title: string; link: string; pubDate: string | null; }

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  for (const b of blocks.slice(0, 150)) {
    const t = b.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim();
    const l = b.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/, "$1").trim();
    const d = b.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim() ?? null;
    if (t && l) items.push({ title: t.slice(0, 300), link: l.slice(0, 500), pubDate: d });
  }
  return items;
}

async function fetchOnce(): Promise<DojResult> {
  const fetchedAt = new Date().toISOString();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(DOJ_RSS_URL, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/rss+xml, application/xml, text/xml" },
    });
    if (!res.ok) {
      return { available: false, reason: `justice.gov RSS HTTP ${res.status} (publisher bot-wall blocks automated runtime)`, fetchedAt, byCode: new Map() };
    }
    const xml = await res.text();
    if (!/<rss|<feed/i.test(xml.slice(0, 2000))) {
      return { available: false, reason: "justice.gov returned a non-feed page to the automated runtime", fetchedAt, byCode: new Map() };
    }
    const byCode = new Map<string, DojRelease[]>();
    for (const it of parseRss(xml)) {
      if (!VOTING_RE.test(it.title)) continue;
      const hit = PATTERNS.filter((p) => p.re.test(it.title)).map((p) => p.code);
      for (const code of hit.slice(0, 4)) {
        const list = byCode.get(code) ?? [];
        if (list.length < 5) {
          list.push({
            title: it.title,
            url: it.link,
            publishedAt: it.pubDate,
            component: "DOJ",
            attribution: "jurisdiction name mentioned in release title",
          });
          byCode.set(code, list);
        }
      }
    }
    return { available: true, reason: null, fetchedAt, byCode };
  } catch (e) {
    return {
      available: false,
      reason: e instanceof Error ? `DOJ RSS unreachable: ${e.message.slice(0, 160)}` : "DOJ RSS unreachable",
      fetchedAt,
      byCode: new Map(),
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchDojVotingReleases(): Promise<DojResult> {
  if (cache && Date.now() - cacheAt < CACHE_TTL_MS) return cache;
  cache = await fetchOnce();
  cacheAt = Date.now();
  return cache;
}

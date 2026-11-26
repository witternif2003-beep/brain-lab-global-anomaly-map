/**
 * DOJ press releases announcing federal cases for voting or registering to
 * vote by a noncitizen. Attribution comes only from the issuing
 * "USAO - <District>" component. The justice.gov API honours only the
 * `parameters[title]` filter, so releases are pulled by title term and kept
 * when the title names both a voting act and noncitizen status.
 */
import { createHash } from "crypto";
import { usaoToCodes } from "../jurisdiction-cards/reference";
import { ELECTION_OFFICES } from "./election-offices";

export const DOJ_PRESS_API = "https://www.justice.gov/api/v1/press_releases.json";
export const NONCITIZEN_VOTING_TERMS = [
  "illegally voting",
  "illegal voting",
  "voting by an alien",
  "voting by a noncitizen",
  "registering to vote",
  "registered to vote",
  "unlawfully voting",
  "voted illegally",
  "voter registration"
];
const PAGE_SIZE = 50;
const TTL_MS = 6 * 60 * 60 * 1000;

export type CaseStage = "sentenced" | "convicted" | "pleaded guilty" | "charged" | "see release";

export interface NoncitizenVotingRelease {
  uuid: string;
  title: string;
  date: string;
  url: string;
  offices: string[];
  codes: string[];
  stage: CaseStage;
}

export interface NoncitizenVotingFeed {
  retrievedAt: string;
  sourceUrl: string;
  terms: string[];
  sha256: string;
  pagesOk: number;
  pagesTotal: number;
  errors: string[];
  releases: NoncitizenVotingRelease[];
}

interface RawRelease {
  uuid?: string;
  title?: string;
  date?: string;
  url?: string;
  component?: Array<{ name?: string }> | null;
}

const VOTING_ACT = /\b(vot(e|es|ed|ing)|voter|register(ed|ing)? to vote|voter registration)\b/i;
const NONCITIZEN = /\b(alien|aliens|noncitizens?|non-citizens?|national|nationals|citizen of|citizens of|falsely claim\w*|false claims? (of|to) (u\.s\. )?citizenship|claiming (u\.s\. )?citizenship)\b/i;

const NVRA = /national voter registration act/i;

export function isNoncitizenVotingTitle(title: string): boolean {
  return !NVRA.test(title) && VOTING_ACT.test(title) && NONCITIZEN.test(title);
}

export function classifyStage(title: string): CaseStage {
  if (/\b(sentenced|sent to prison)\b/i.test(title)) return "sentenced";
  if (/\b(convicted|found guilty|guilty verdict)\b/i.test(title)) return "convicted";
  if (/\b((pleads?|pleaded|pled) gu?ilty|admits)\b/i.test(title)) return "pleaded guilty";
  if (/\b(charged?|charges|charging|indicted|indictment|arrested|complaint)\b/i.test(title)) return "charged";
  return "see release";
}

const NAME_TO_CODE = new Map(ELECTION_OFFICES.map((o) => [o.name, o.code]));

export function toRelease(r: RawRelease): NoncitizenVotingRelease | null {
  const title = (r.title ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  if (!r.uuid || !r.url || !title || !isNoncitizenVotingTitle(title)) return null;
  const offices = (r.component ?? []).map((c) => c.name ?? "").filter((n) => n.startsWith("USAO - "));
  const codes = [...new Set(offices.flatMap((o) => usaoToCodes(o, NAME_TO_CODE)))];
  const secs = Number(r.date);
  return {
    uuid: r.uuid,
    title,
    date: Number.isFinite(secs) ? new Date(secs * 1000).toISOString().slice(0, 10) : "",
    url: r.url,
    offices,
    codes,
    stage: classifyStage(title)
  };
}

async function fetchTerm(term: string, fetchImpl: typeof fetch): Promise<{ raw: string; results: RawRelease[] }> {
  const url = `${DOJ_PRESS_API}?pagesize=${PAGE_SIZE}&page=0&sort=date&direction=DESC&parameters%5Btitle%5D=${encodeURIComponent(term)}`;
  const res = await fetchImpl(url, { headers: { Accept: "application/json", "User-Agent": "brain-lab-election-sources/1.0" }, cache: "no-store" });
  const raw = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const parsed = JSON.parse(raw) as { results?: RawRelease[] };
  return { raw, results: Array.isArray(parsed.results) ? parsed.results : [] };
}

export async function fetchNoncitizenVotingReleases(fetchImpl: typeof fetch = fetch): Promise<NoncitizenVotingFeed> {
  const pages = await Promise.allSettled(NONCITIZEN_VOTING_TERMS.map((t) => fetchTerm(t, fetchImpl)));
  const errors: string[] = [];
  const hash = createHash("sha256");
  const byUuid = new Map<string, NoncitizenVotingRelease>();
  pages.forEach((p, i) => {
    if (p.status === "rejected") {
      errors.push(`${NONCITIZEN_VOTING_TERMS[i]}: ${p.reason instanceof Error ? p.reason.message : String(p.reason)}`);
      return;
    }
    hash.update(p.value.raw);
    for (const raw of p.value.results) {
      const rel = toRelease(raw);
      if (rel && !byUuid.has(rel.uuid)) byUuid.set(rel.uuid, rel);
    }
  });
  return {
    retrievedAt: new Date().toISOString(),
    sourceUrl: DOJ_PRESS_API,
    terms: NONCITIZEN_VOTING_TERMS,
    sha256: hash.digest("hex"),
    pagesOk: pages.length - errors.length,
    pagesTotal: pages.length,
    errors,
    releases: [...byUuid.values()].sort((a, b) => b.date.localeCompare(a.date))
  };
}

let cached: { at: number; feed: NoncitizenVotingFeed } | undefined;
let inflight: Promise<NoncitizenVotingFeed> | undefined;

export async function getNoncitizenVotingFeed(): Promise<NoncitizenVotingFeed> {
  if (cached && Date.now() - cached.at < TTL_MS && cached.feed.pagesOk > 0) return cached.feed;
  inflight ??= fetchNoncitizenVotingReleases()
    .then((feed) => {
      cached = { at: Date.now(), feed };
      return feed;
    })
    .finally(() => {
      inflight = undefined;
    });
  return inflight;
}

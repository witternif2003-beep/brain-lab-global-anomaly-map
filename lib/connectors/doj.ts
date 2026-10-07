/**
 * DOJ press-release connector — public national-security case announcements.
 *
 * LIVE-CONTRACT (verified 2026-09-28 against justice.gov/api/v1): only the
 * `parameters[title]` filter is honoured (topic/component/body filters are
 * ignored), so we query by title term and filter client-side to releases
 * tagged with the National Security Division component or the "National
 * Security" topic. Jurisdiction attribution comes solely from the issuing
 * "USAO - <District>" component. A release announces a charge, plea, or
 * sentence; a charge is an allegation, not a finding.
 */
import { makeProvenance, Provenance } from "../provenance";

const DOJ = "https://www.justice.gov/api/v1/press_releases.json";
const PAGE_SIZE = 50;
const PAGES_PER_TERM = 2;

export const DOJ_TITLE_TERMS = ["espionage", "national defense information", "agent of", "trade secret", "export"];

export interface DojRelease {
  uuid: string;
  title: string;
  date: string;
  url: string;
  offices: string[];
  matched_term: string;
  provenance: Provenance;
}

interface RawRelease {
  uuid?: string;
  title?: string;
  date?: string;
  url?: string;
  component?: Array<{ name?: string }> | null;
  topic?: Array<{ name?: string }> | "" | null;
}

const isNatsec = (r: RawRelease): boolean =>
  (r.component ?? []).some((c) => (c.name ?? "").includes("National Security Division")) ||
  (Array.isArray(r.topic) && r.topic.some((t) => t.name === "National Security"));

async function fetchPage(term: string, page: number) {
  const url =
    `${DOJ}?pagesize=${PAGE_SIZE}&page=${page}&sort=date&direction=DESC` +
    `&parameters%5Btitle%5D=${encodeURIComponent(term)}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" },
    cache: "no-store"
  });
  const raw = await res.text();
  let results: RawRelease[] = [];
  try {
    const parsed = JSON.parse(raw) as { results?: RawRelease[] };
    results = Array.isArray(parsed.results) ? parsed.results : [];
  } catch {
    /* non-JSON body -> zero results, status captured in provenance */
  }
  const provenance = makeProvenance({
    source_id: "DOJ-PRESS",
    jurisdiction: "ALL",
    source_url: url,
    body: raw,
    http_status: res.status,
    record_count: results.length,
    access_note: "justice.gov public press-release API, no key. Announcements of charges/pleas/sentences, not findings."
  });
  return { ok: res.ok, status: res.status, raw, results, provenance };
}

export interface DojFeed {
  releases: DojRelease[];
  errors: string[];
  pages_ok: number;
  pages_total: number;
  feed: Provenance | null;
}

export async function fetchDojNatsecReleases(): Promise<DojFeed> {
  const jobs = DOJ_TITLE_TERMS.flatMap((term) =>
    Array.from({ length: PAGES_PER_TERM }, (_, page) => ({ term, page }))
  );
  const pages = await Promise.all(
    jobs.map(async (j) => {
      try {
        return { ...j, ...(await fetchPage(j.term, j.page)), error: null as string | null };
      } catch (e) {
        return {
          ...j,
          ok: false,
          status: 0,
          raw: "",
          results: [] as RawRelease[],
          provenance: null,
          error: e instanceof Error ? e.message : "fetch error"
        };
      }
    })
  );
  const errors: string[] = [];
  const byUuid = new Map<string, DojRelease>();
  for (const p of pages) {
    if (!p.ok || !p.provenance) {
      errors.push(`${p.term} p${p.page}: ${p.error ?? `HTTP ${p.status}`}`);
      continue;
    }
    for (const r of p.results) {
      if (!r.uuid || !r.url || !r.title || !isNatsec(r) || byUuid.has(r.uuid)) continue;
      const secs = Number(r.date);
      byUuid.set(r.uuid, {
        uuid: r.uuid,
        title: r.title.trim(),
        date: Number.isFinite(secs) ? new Date(secs * 1000).toISOString().slice(0, 10) : "",
        url: r.url,
        offices: (r.component ?? []).map((c) => c.name ?? "").filter((n) => n.startsWith("USAO - ")),
        matched_term: p.term,
        provenance: p.provenance
      });
    }
  }
  const releases = [...byUuid.values()].sort((a, b) => b.date.localeCompare(a.date));
  const okPages = pages.filter((p) => p.ok && p.provenance);
  const feed = okPages.length
    ? makeProvenance({
        source_id: "DOJ-PRESS",
        jurisdiction: "ALL",
        source_url: DOJ,
        body: okPages.map((p) => p.raw).join("\n"),
        http_status: 200,
        record_count: releases.length,
        access_note:
          `sha256 over ${okPages.length}/${pages.length} page bodies (terms: ${DOJ_TITLE_TERMS.join(", ")}; ` +
          `pagesize=${PAGE_SIZE}, pages 0-${PAGES_PER_TERM - 1}, sort=date DESC), NSD/National Security filtered.`
      })
    : null;
  return { releases, errors, pages_ok: okPages.length, pages_total: pages.length, feed };
}

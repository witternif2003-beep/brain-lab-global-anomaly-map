/**
 * Federal Register connector — NATIONAL document counts per federal agency
 * (trailing 12 months). Used ONLY for handbook entities that publish no
 * per-state series; every value is labeled NATIONAL and the provenance
 * jurisdiction is ALL.
 * LIVE-VERIFIED 2026-09-28: /api/v1/documents.json with
 * conditions[agencies][]=<slug> + publication_date gte returns `count`
 * (FTC 76, FEC 6, CFTC 88, NRC 458, FED 294, NTSB 8, NCUA 83, TVA 16,
 * FDIC 109, NARA 46, NLRB 2). No key.
 */
import { makeProvenance, Provenance } from "../provenance";

const FR_DOCS = "https://www.federalregister.gov/api/v1/documents.json";

export interface FrAgencyCount {
  slug: string;
  count: number;
  provenance: Provenance;
}

export interface FrDocument {
  title: string;
  date: string;
  doc_type: string;
  url: string;
}

export interface FrRecentResult {
  slug: string;
  docs: FrDocument[];
  provenance: Provenance;
}

export interface FederalRegisterResult {
  counts: Map<string, FrAgencyCount>;
  errors: string[];
}

async function fetchOne(slug: string, gte: string): Promise<FrAgencyCount> {
  const url = `${FR_DOCS}?conditions%5Bagencies%5D%5B%5D=${encodeURIComponent(slug)}&conditions%5Bpublication_date%5D%5Bgte%5D=${gte}&per_page=1`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res: Response;
  let text: string;
  try {
    res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" },
      cache: "no-store"
    });
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`Federal Register HTTP ${res.status} for ${slug}`);
  let count: number | null = null;
  try {
    const payload = JSON.parse(text) as { count?: unknown };
    if (typeof payload?.count === "number") count = payload.count;
  } catch {
    count = null;
  }
  if (count === null) throw new Error(`Federal Register unparseable for ${slug}`);
  return {
    slug,
    count,
    provenance: makeProvenance({
      source_id: "FED-REGISTER",
      jurisdiction: "ALL",
      source_url: url,
      body: text,
      http_status: res.status,
      record_count: count,
      access_note: "Federal Register public API, no key. NATIONAL trailing-12-month document count — not state-specific."
    })
  };
}

const FR_BATCH = 6;
const FR_RETRY_WAIT_MS = 1500;

export async function fetchFederalRegisterCounts(slugs: string[]): Promise<FederalRegisterResult> {
  const gte = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const counts = new Map<string, FrAgencyCount>();
  let pending = [...slugs];
  // Batched fetch + one retry pass: 36-way parallel bursts get throttled.
  for (let pass = 0; pass < 2 && pending.length > 0; pass++) {
    if (pass > 0) await new Promise((r) => setTimeout(r, FR_RETRY_WAIT_MS));
    const failed: string[] = [];
    for (let i = 0; i < pending.length; i += FR_BATCH) {
      const batch = pending.slice(i, i + FR_BATCH);
      const settled = await Promise.all(batch.map(async (s) => {
        try {
          return { ok: true as const, v: await fetchOne(s, gte) };
        } catch {
          return { ok: false as const, slug: s };
        }
      }));
      for (const r of settled) {
        if (r.ok) counts.set(r.v.slug, r.v);
        else failed.push(r.slug);
      }
    }
    pending = failed;
  }
  const errors = pending.map((s) => `${s}: unavailable after retry`);
  if (counts.size === 0) throw new Error(`Federal Register total failure: ${errors.slice(0, 3).join("; ")}`);
  return { counts, errors };
}

function frTypeOf(raw: unknown): string {
  if (typeof raw === "string" && raw) return raw;
  if (typeof raw === "object" && raw !== null) {
    const o = raw as { slug?: unknown; title?: unknown };
    if (typeof o.slug === "string" && o.slug) return o.slug;
    if (typeof o.title === "string" && o.title) return o.title;
  }
  return "document";
}

async function fetchRecentOne(slug: string, gte: string, perPage: number): Promise<FrRecentResult> {
  const url =
    `${FR_DOCS}?conditions%5Bagencies%5D%5B%5D=${encodeURIComponent(slug)}` +
    `&conditions%5Bpublication_date%5D%5Bgte%5D=${gte}&order=newest&per_page=${perPage}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res: Response;
  let text: string;
  try {
    res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" },
      cache: "no-store"
    });
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`FR recent HTTP ${res.status} for ${slug}`);
  const docs: FrDocument[] = [];
  try {
    const payload = JSON.parse(text) as {
      results?: Array<{ title?: unknown; publication_date?: unknown; type?: unknown; html_url?: unknown }>;
    };
    for (const r of payload.results ?? []) {
      if (typeof r.title === "string" && typeof r.html_url === "string") {
        docs.push({
          title: r.title,
          date: typeof r.publication_date === "string" ? r.publication_date : "",
          doc_type: frTypeOf(r.type),
          url: r.html_url
        });
      }
    }
  } catch {
    throw new Error(`FR recent unparseable for ${slug}`);
  }
  return {
    slug,
    docs,
    provenance: makeProvenance({
      source_id: "FED-REGISTER",
      jurisdiction: "ALL",
      source_url: url,
      body: text,
      http_status: res.status,
      record_count: docs.length,
      access_note: "Federal Register public API, no key. NATIONAL newest-first documents. Live per build."
    })
  };
}

/**
 * Recent documents for many slugs — batched (FR throttles bursts), never
 * throws: entities without docs simply show the count.
 */
export async function fetchRecentDocumentsBatch(
  slugs: string[],
  perPage = 5
): Promise<{ docs: Map<string, FrRecentResult>; errors: string[] }> {
  const gte = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const docs = new Map<string, FrRecentResult>();
  const errors: string[] = [];
  for (let i = 0; i < slugs.length; i += FR_BATCH) {
    const settled = await Promise.all(
      slugs.slice(i, i + FR_BATCH).map(async (s) => {
        try {
          return { ok: true as const, v: await fetchRecentOne(s, gte, perPage) };
        } catch (e) {
          return { ok: false as const, slug: s };
        }
      })
    );
    for (const r of settled) {
      if (r.ok) docs.set(r.v.slug, r.v);
      else errors.push(r.slug);
    }
  }
  return { docs, errors };
}

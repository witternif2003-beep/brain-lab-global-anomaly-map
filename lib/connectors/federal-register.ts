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

export async function fetchFederalRegisterCounts(slugs: string[]): Promise<Map<string, FrAgencyCount>> {
  const gte = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10);
  const out = new Map<string, FrAgencyCount>();
  const settled = await Promise.all(slugs.map(async (s) => {
    try {
      return { ok: true as const, v: await fetchOne(s, gte) };
    } catch (e) {
      return { ok: false as const, slug: s, error: e instanceof Error ? e.message : "fetch error" };
    }
  }));
  const failures = settled.filter((r) => !r.ok);
  if (failures.length > 0) {
    throw new Error(`Federal Register failures: ${failures.map((f) => `${(f as { slug: string }).slug}`).join(", ")}`);
  }
  for (const r of settled) if (r.ok) out.set(r.v.slug, r.v);
  return out;
}

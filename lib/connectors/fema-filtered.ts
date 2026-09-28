import { makeProvenance, Provenance } from "../provenance";

export interface FemaFilteredFetch {
  records: Array<Record<string, unknown>>;
  provenance: Provenance;
  note: string;
  total_count: number | null;
}

const ENTITY_KEY = "DisasterDeclarationsSummaries";

/**
 * OpenFEMA v2 state-filtered declarations fetch (powers territory tabs — no
 * territory runs its own data portal). Distinct from connectors/fema.ts,
 * which pulls the unfiltered national feed for jurisdiction cards.
 * Response shape is NOT standard OData:
 * { metadata: { count }, [ENTITY_KEY]: [...] }. $count=true is required for
 * metadata.count; newest-first via $orderby incidentBeginDate desc.
 */
export async function fetchFemaFiltered(a: {
  baseUrl: string;
  stateCode: string;
  sourceId: string;
  jurisdiction: string;
  rows?: number;
  fields?: string[];
}): Promise<FemaFilteredFetch> {
  const rows = Math.max(1, Math.min(100, a.rows ?? 12));
  const base = a.baseUrl.replace(/\/$/, "");
  const url =
    `${base}?$filter=${encodeURIComponent(`state eq '${a.stateCode}'`)}` +
    `&$orderby=${encodeURIComponent("incidentBeginDate desc")}` +
    `&$top=${rows}&$count=true`;
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

  const keep = a.fields && a.fields.length > 0 ? new Set(a.fields) : null;
  let total: number | null = null;
  let recs: Array<Record<string, unknown>> = [];
  try {
    const payload = JSON.parse(text) as {
      metadata?: { count?: unknown };
      [k: string]: unknown;
    };
    const c = payload?.metadata?.count;
    total = typeof c === "number" ? c : null;
    const raw = payload?.[ENTITY_KEY];
    if (Array.isArray(raw)) {
      recs = (raw as Array<Record<string, unknown>>).map((r) =>
        keep ? Object.fromEntries(Object.entries(r).filter(([k]) => keep.has(k))) : r
      );
    }
  } catch {
    recs = [];
  }

  const prov = makeProvenance({
    source_id: a.sourceId,
    jurisdiction: a.jurisdiction,
    source_url: url,
    body: text,
    http_status: res.status,
    record_count: recs.length,
    access_note: "OpenFEMA v2 public API, no key. Server-side fetch; not a verified finding."
  });
  const note = `${(total ?? recs.length).toLocaleString()} TOTAL DECLARATIONS • SHOWING ${recs.length} NEWEST`;
  return { records: recs, provenance: prov, note, total_count: total };
}

import { makeProvenance, Provenance } from "../provenance";

export interface CkanFetch {
  records: Array<Record<string, unknown>>;
  provenance: Provenance;
  note: string;
  total_count: number | null;
}

/**
 * CKAN datastore_search fetch for a mapped state dataset. datastore_search
 * returns result.total (full table count) plus the requested page, so one
 * call yields both rows and the honest total. Provenance matches the Socrata
 * and federal connectors. "Fetched" = returned live in this run, not a
 * verified finding. sort is raw CKAN sort syntax ("" = datastore order).
 */
export async function fetchCkanDataset(a: {
  portal: string;
  resourceId: string;
  sourceId: string;
  jurisdiction: string;
  fields?: string[];
  sort?: string;
  rows?: number;
}): Promise<CkanFetch> {
  const rows = Math.max(1, Math.min(100, a.rows ?? 12));
  const base = a.portal.replace(/\/$/, "");
  const params = new URLSearchParams({
    resource_id: a.resourceId,
    limit: String(rows)
  });
  if (a.fields && a.fields.length > 0) params.set("fields", a.fields.join(","));
  if (a.sort && a.sort.length > 0) params.set("sort", a.sort);
  const url = `${base}/api/3/action/datastore_search?${params.toString()}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25000);
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

  let records: Array<Record<string, unknown>> = [];
  let total_count: number | null = null;
  try {
    const parsed = JSON.parse(text) as {
      success?: boolean;
      result?: { records?: unknown; total?: unknown };
    };
    if (parsed.success === true) {
      if (Array.isArray(parsed.result?.records))
        records = parsed.result.records as Array<Record<string, unknown>>;
      if (typeof parsed.result?.total === "number") total_count = parsed.result.total;
    }
  } catch {
    records = [];
  }

  const prov = makeProvenance({
    source_id: a.sourceId,
    jurisdiction: a.jurisdiction,
    source_url: url,
    body: text,
    http_status: res.status,
    record_count: records.length,
    access_note: "State CKAN datastore_search, no key. Fetched live; not a verified finding."
  });

  const ordered = (a.sort ?? "").length > 0;
  const note =
    total_count !== null
      ? `${total_count.toLocaleString()} TOTAL ROWS • SHOWING ${records.length}${ordered ? " NEWEST" : " ROWS"}`
      : `${records.length} ROWS FETCHED (TOTAL COUNT UNAVAILABLE)`;
  return { records, provenance: prov, note, total_count };
}

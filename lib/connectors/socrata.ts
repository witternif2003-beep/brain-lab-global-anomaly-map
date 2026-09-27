import { makeProvenance, Provenance } from "../provenance";

export interface SocrataFetch {
  records: Array<Record<string, unknown>>;
  provenance: Provenance;
  note: string;
  total_count: number | null;
}

/**
 * Generic Socrata SODA fetch for a mapped state dataset. Pulls the N newest
 * rows (slim $select) plus a dataset-wide count(*) in parallel. Every call
 * carries provenance (source_url + retrieved_at + sha256) like the federal
 * connectors. "Fetched" = returned live in this run, not a verified finding.
 */
export async function fetchSocrataDataset(a: {
  portal: string;
  datasetId: string;
  sourceId: string;
  jurisdiction: string;
  orderBy: string;
  select: string[];
  rows?: number;
}): Promise<SocrataFetch> {
  const rows = Math.max(1, Math.min(100, a.rows ?? 12));
  const base = a.portal.replace(/\/$/, "");
  const sel = a.select.map((f) => encodeURIComponent(f)).join(",");
  const order =
    a.orderBy.length > 0 ? `&$order=${encodeURIComponent(a.orderBy)}%20DESC` : "";
  const rowsUrl = `${base}/resource/${a.datasetId}.json?$select=${sel}${order}&$limit=${rows}`;
  const countUrl = `${base}/resource/${a.datasetId}.json?$select=count(*)`;

  const get = async (url: string) => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 25000);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" },
        cache: "no-store"
      });
      const text = await res.text();
      return { res, text };
    } finally {
      clearTimeout(timer);
    }
  };

  const [r, c] = await Promise.all([get(rowsUrl), get(countUrl)]);
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(r.text);
  } catch {
    parsed = null;
  }
  const records: Array<Record<string, unknown>> = Array.isArray(parsed)
    ? (parsed as Array<Record<string, unknown>>)
    : [];
  const prov = makeProvenance({
    source_id: a.sourceId,
    jurisdiction: a.jurisdiction,
    source_url: rowsUrl,
    body: r.text,
    http_status: r.res.status,
    record_count: records.length,
    access_note: "State Socrata SODA API, no key. Fetched live; not a verified finding."
  });

  let total_count: number | null = null;
  try {
    const cp = JSON.parse(c.text) as Array<Record<string, unknown>>;
    const first = Array.isArray(cp) ? cp[0] : null;
    if (first) {
      const k = Object.keys(first).find((x) => x.toLowerCase().startsWith("count"));
      const v = k ? Number(first[k]) : NaN;
      if (Number.isFinite(v)) total_count = v;
    }
  } catch {
    total_count = null;
  }

  const note =
    total_count !== null
      ? `${total_count.toLocaleString()} TOTAL ROWS • SHOWING ${records.length} NEWEST`
      : `${records.length} ROWS FETCHED (TOTAL COUNT UNAVAILABLE)`;
  return { records, provenance: prov, note, total_count };
}

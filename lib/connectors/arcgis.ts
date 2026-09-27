import { makeProvenance, Provenance } from "../provenance";

export interface ArcgisFetch {
  records: Array<Record<string, unknown>>;
  provenance: Provenance;
  note: string;
  total_count: number | null;
}

/**
 * ArcGIS FeatureServer/MapServer layer query for a mapped dataset (DC).
 * Runs returnCountOnly + newest-first page in parallel. outFields doubles as
 * a privacy allowlist — only listed columns are ever fetched. Dates arrive
 * as ms-epoch ints; card templates render them via the :epoch modifier.
 */
export async function fetchArcgisLayer(a: {
  layerUrl: string;
  sourceId: string;
  jurisdiction: string;
  outFields: string[];
  orderBy: string;
  rows?: number;
}): Promise<ArcgisFetch> {
  const rows = Math.max(1, Math.min(100, a.rows ?? 12));
  const base = a.layerUrl.replace(/\/$/, "");
  const fields = a.outFields.length > 0 ? a.outFields.join(",") : "*";
  const countUrl = `${base}/query?where=1%3D1&returnCountOnly=true&f=json`;
  const order = a.orderBy.length > 0 ? `&orderByFields=${encodeURIComponent(a.orderBy)}%20DESC` : "";
  const rowsUrl =
    `${base}/query?where=1%3D1&outFields=${encodeURIComponent(fields)}` +
    `&resultRecordCount=${rows}${order}&f=json`;

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
  let records: Array<Record<string, unknown>> = [];
  try {
    const parsed = JSON.parse(r.text) as {
      features?: Array<{ attributes?: unknown }>;
    };
    if (Array.isArray(parsed.features))
      records = parsed.features.map(
        (f) => (f.attributes ?? {}) as Record<string, unknown>
      );
  } catch {
    records = [];
  }
  let total_count: number | null = null;
  try {
    const cp = JSON.parse(c.text) as { count?: unknown };
    if (typeof cp.count === "number") total_count = cp.count;
  } catch {
    total_count = null;
  }

  const prov = makeProvenance({
    source_id: a.sourceId,
    jurisdiction: a.jurisdiction,
    source_url: rowsUrl,
    body: r.text,
    http_status: r.res.status,
    record_count: records.length,
    access_note: "ArcGIS REST layer query, no key. Fetched live; not a verified finding."
  });

  const ordered = a.orderBy.length > 0;
  const note =
    total_count !== null
      ? `${total_count.toLocaleString()} TOTAL ROWS • SHOWING ${records.length}${ordered ? " NEWEST" : " ROWS"}`
      : `${records.length} ROWS FETCHED (TOTAL COUNT UNAVAILABLE)`;
  return { records, provenance: prov, note, total_count };
}

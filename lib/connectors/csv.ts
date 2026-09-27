import { makeProvenance, Provenance } from "../provenance";

export interface CsvFetch {
  records: Array<Record<string, unknown>>;
  provenance: Provenance;
  note: string;
  total_count: number | null;
}

/** Quote-aware CSV parse (embedded newlines, doubled quotes, CRLF, BOM). */
function parseCsv(text: string): Array<Record<string, string>> {
  const t = text.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let cur = "";
  let row: string[] = [];
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (q) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else {
      if (c === '"') q = true;
      else if (c === ",") {
        row.push(cur);
        cur = "";
      } else if (c === "\n") {
        row.push(cur);
        rows.push(row);
        row = [];
        cur = "";
      } else if (c === "\r") {
        /* drop */
      } else cur += c;
    }
  }
  if (cur !== "" || row.length > 0) {
    row.push(cur);
    rows.push(row);
  }
  if (rows.length === 0) return [];
  const head = rows[0].map((h) => h.trim());
  return rows
    .slice(1)
    .filter((r) => r.some((v) => v.trim() !== ""))
    .map((r) => {
      const o: Record<string, string> = {};
      head.forEach((h, j) => {
        o[h] = (r[j] ?? "").trim();
      });
      return o;
    });
}

/** M/D/YYYY prefix -> YYYYMMDD int for newest-first sort (-1 if unparseable). */
function mdyKey(s: string): number {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(s || "");
  return m ? +m[3] * 10000 + +m[1] * 100 + +m[2] : -1;
}

/**
 * Direct-CSV dataset fetch (for portals whose resources lack datastore
 * activation). serviceUrl is either a raw CSV URL or
 * "ckan-package:<name>" (resolved live via package_show so monthly-rotated
 * filenames never rot the mapping). Parses server-side, sorts newest-first
 * by a M/D/YYYY column when configured, ships only the requested page.
 */
export async function fetchCsvDataset(a: {
  serviceUrl: string;
  portal: string;
  sourceId: string;
  jurisdiction: string;
  sortField?: string;
  rows?: number;
  fields?: string[];
}): Promise<CsvFetch> {
  const rows = Math.max(1, Math.min(100, a.rows ?? 12));
  let csvUrl = a.serviceUrl;
  if (csvUrl.startsWith("ckan-package:")) {
    const name = csvUrl.slice("ckan-package:".length);
    const base = a.portal.replace(/\/$/, "");
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(`${base}/api/3/action/package_show?id=${encodeURIComponent(name)}`, {
        signal: ctrl.signal,
        headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" },
        cache: "no-store"
      });
      const pkg = (await res.json()) as {
        success?: boolean;
        result?: { resources?: Array<{ format?: string; url?: string }> };
      };
      const csv = (pkg.result?.resources ?? []).find(
        (x) => (x.format ?? "").toUpperCase() === "CSV" && (x.url ?? "").length > 0
      );
      if (!csv?.url) throw new Error("no CSV resource on package " + name);
      csvUrl = csv.url;
    } finally {
      clearTimeout(timer);
    }
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  let res: Response;
  let text: string;
  try {
    res = await fetch(csvUrl, {
      signal: ctrl.signal,
      headers: { Accept: "text/csv,*/*", "User-Agent": "brain-lab-ingest/1.0" },
      cache: "no-store"
    });
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }

  const parsed = parseCsv(text);
  if (a.sortField && a.sortField.length > 0) {
    const f = a.sortField;
    parsed.sort((x, y) => mdyKey(y[f] ?? "") - mdyKey(x[f] ?? ""));
  }
  const keep = a.fields && a.fields.length > 0 ? new Set(a.fields) : null;
  const thin = (r: Record<string, string>): Record<string, unknown> =>
    keep ? Object.fromEntries(Object.entries(r).filter(([k]) => keep.has(k))) : r;
  const page = parsed.slice(0, rows).map(thin);
  const prov = makeProvenance({
    source_id: a.sourceId,
    jurisdiction: a.jurisdiction,
    source_url: csvUrl,
    body: text,
    http_status: res.status,
    record_count: page.length,
    access_note: "Direct CSV resource, no key. Parsed server-side; not a verified finding."
  });
  const ordered = (a.sortField ?? "").length > 0;
  const note = `${parsed.length.toLocaleString()} TOTAL ROWS • SHOWING ${page.length}${ordered ? " NEWEST" : " ROWS"}`;
  return {
    records: page as Array<Record<string, unknown>>,
    provenance: prov,
    note,
    total_count: parsed.length
  };
}

/**
 * SEC EDGAR connector — registrants by state/territory of incorporation.
 * Parses the Atom feed directly; no dependency.
 *
 * LIVE-CONTRACT (verified 2026-09-27 against www.sec.gov): the State-search
 * Atom flavor returns one <entry> per registrant carrying ONLY <cik>, <state>,
 * <updated> and the filing-index <link>. Company names and filing types are
 * NOT returned (upstream SEC formatting bug leaks "ARRAY(0x…)" placeholders
 * into title/name attributes). We parse only real fields and say so.
 */
import { makeProvenance, Provenance } from "../provenance";

const EDGAR = "https://www.sec.gov/cgi-bin/browse-edgar";

export interface EdgarRecord {
  territory: string;
  cik: string;
  state: string;
  updated: string;
  edgar_url: string;
  provenance: Provenance;
}

export async function fetchEdgarByState(a: {
  territory: string;
  filingType?: string;
  count?: number;
}) {
  const count = a.count ?? 40;
  const type = a.filingType ?? "";
  const url =
    `${EDGAR}?action=getcompany&State=${encodeURIComponent(a.territory)}` +
    `&type=${encodeURIComponent(type)}&dateb=&owner=include&count=${count}&output=atom`;
  const res = await fetch(url, {
    headers: {
      Accept: "application/atom+xml, application/xml;q=0.9",
      "User-Agent": "brain-lab-ingest/1.0 (contact: admin@example.com)"
    },
    cache: "no-store"
  });
  const raw = await res.text();
  const prov = makeProvenance({
    source_id: "SEC-EDGAR",
    jurisdiction: a.territory,
    source_url: url,
    body: raw,
    http_status: res.status,
    record_count: 0,
    access_note:
      "SEC EDGAR public browse, User-Agent required, no key. State search returns registrant CIKs only; company names omitted upstream."
  });
  const entryRe = /<entry[^>]*>([\s\S]*?)<\/entry>/g;
  const records: EdgarRecord[] = [];
  let m: RegExpExecArray | null;
  while ((m = entryRe.exec(raw)) !== null) {
    const block = m[1];
    const pick = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(block);
      return r ? r[1].replace(/<[^>]+>/g, "").trim() : "";
    };
    const link = /<link href="([^"]+)"[^>]*>/.exec(block);
    const cik = pick("cik");
    if (!cik) continue;
    records.push({
      territory: a.territory,
      cik: cik.padStart(10, "0"),
      state: pick("state"),
      updated: pick("updated"),
      edgar_url: link ? link[1].replace(/&amp;/g, "&") : "",
      provenance: prov
    });
  }
  prov.record_count = records.length;
  return {
    records,
    provenance: prov,
    note: `${records.length} registrants by state of incorporation (CIK + filing index; names not supplied by SEC).`
  };
}

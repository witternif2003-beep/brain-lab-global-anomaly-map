/**
 * FDIC connector — count of FDIC-insured institutions chartered in a state.
 * LIVE-VERIFIED 2026-09-28: GET api.fdic.gov/banks/institutions with
 * filters=STALP:"XX" returns meta.total for states AND territories
 * (AZ 186, PR 40, GU 5, VI 7, AS 1, MP 0, DC 37). No key.
 * NOTE: documented /banks/socrata/* paths 404; /banks/institutions is live
 * (banks.data.fdic.gov/api/institutions 301-redirects here).
 */
import { makeProvenance, Provenance } from "../provenance";

const FDIC_URL = "https://api.fdic.gov/banks/institutions";

export interface FdicCount {
  code: string;
  total: number;
  provenance: Provenance;
  note: string;
}

export async function fetchFdicCount(a: { code: string }): Promise<FdicCount> {
  const url = `${FDIC_URL}?filters=${encodeURIComponent(`STALP:"${a.code}"`)}&fields=NAME&limit=1`;
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
  if (!res.ok) throw new Error(`FDIC HTTP ${res.status} for ${a.code}`);
  let total: number | null = null;
  try {
    const payload = JSON.parse(text) as { meta?: { total?: unknown } };
    if (typeof payload?.meta?.total === "number") total = payload.meta.total;
  } catch {
    total = null;
  }
  if (total === null) throw new Error(`FDIC unparseable for ${a.code}`);
  const prov = makeProvenance({
    source_id: "FDIC",
    jurisdiction: a.code,
    source_url: url,
    body: text,
    http_status: res.status,
    record_count: total,
    access_note: "FDIC BankFind Suite public API, no key. Institutions by charter state. Live per build."
  });
  return {
    code: a.code,
    total,
    provenance: prov,
    note: total === 0 ? `No FDIC-insured institutions chartered in ${a.code}.` : `FDIC-insured institutions chartered in ${a.code}.`
  };
}

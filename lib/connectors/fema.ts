/**
 * OpenFEMA — disaster declarations, one row per declaration.
 *
 * LIVE-CONTRACT (verified 2026-09-28): fema.gov/api/open/v1/FemaWebDisasterDeclarations
 * is keyless, supports $select/$top/$skip/$inlinecount, max $top 1000, and
 * covers all 56 jurisdictions via `stateCode` (VI, GU, AS, MP included).
 */
import { makeProvenance, Provenance } from "../provenance";

const FEMA = "https://www.fema.gov/api/open/v1/FemaWebDisasterDeclarations";
export const FEMA_PAGE = 1000;
const SELECT = "disasterNumber,declarationDate,disasterName,declarationType,stateCode,incidentType,disasterPageUrl";

export interface FemaDeclaration {
  disasterNumber: number;
  declarationDate: string;
  disasterName: string;
  declarationType: string;
  stateCode: string;
  incidentType: string;
  disasterPageUrl: string;
}

export interface FemaFeed {
  declarations: FemaDeclaration[];
  total: number;
  provenance: Provenance[];
  errors: string[];
}

async function fetchPage(skip: number) {
  const url = `${FEMA}?$select=${SELECT}&$orderby=declarationDate%20desc&$top=${FEMA_PAGE}&$skip=${skip}&$inlinecount=allpages`;
  const res = await fetch(url, { headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" }, cache: "no-store" });
  const raw = await res.text();
  let rows: FemaDeclaration[] = [];
  let total = 0;
  try {
    const parsed = JSON.parse(raw) as { metadata?: { count?: number }; FemaWebDisasterDeclarations?: FemaDeclaration[] };
    rows = parsed.FemaWebDisasterDeclarations ?? [];
    total = parsed.metadata?.count ?? 0;
  } catch {
    /* non-JSON body -> no rows, status captured in provenance */
  }
  const provenance = makeProvenance({
    source_id: "OPENFEMA-DECLARATIONS",
    jurisdiction: "ALL",
    source_url: url,
    body: raw,
    http_status: res.status,
    record_count: rows.length,
    access_note: "OpenFEMA FemaWebDisasterDeclarations (public, no key)."
  });
  return { rows, total, provenance, ok: res.ok };
}

export async function fetchFemaDeclarations(): Promise<FemaFeed> {
  const first = await fetchPage(0);
  const errors: string[] = first.ok ? [] : [`OpenFEMA HTTP ${first.provenance.http_status}`];
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, Math.ceil(first.total / FEMA_PAGE) - 1) }, (_, i) => fetchPage((i + 1) * FEMA_PAGE))
  );
  for (const p of rest) if (!p.ok) errors.push(`OpenFEMA HTTP ${p.provenance.http_status}`);
  const pages = [first, ...rest];
  return {
    declarations: pages.flatMap((p) => p.rows),
    total: first.total,
    provenance: pages.map((p) => p.provenance),
    errors
  };
}

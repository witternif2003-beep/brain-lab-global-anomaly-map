/**
 * EPA ECHO connector — territory compliance summary.
 *
 * LIVE-CONTRACT (verified 2026-09-27 against echodata.epa.gov): the
 * get_facilities service returns AGGREGATE summary counts under Results
 * (Message, QueryRows, CAARows, CWARows, RCRRows, TRIRows, INSPRows,
 * TotalPenalties, QueryID) — there is NO per-facility array, with or without
 * p_page. This connector therefore emits ONE summary record per territory and
 * never invents facility rows. PR currently reports 3,897 active facilities.
 */
import { makeProvenance, Provenance } from "../provenance";

const ECHO = "https://echodata.epa.gov/echo/echo_rest_services.get_facilities";

export interface EpaEchoRecord {
  territory: string;
  active_facilities: number;
  caa_rows: number;
  cwa_rows: number;
  rcra_rows: number;
  tri_rows: number;
  inspections: number;
  total_penalties: string;
  query_id: string;
  provenance: Provenance;
}

const num = (v: unknown): number => {
  const n =
    typeof v === "string"
      ? parseInt(v.replace(/[^0-9]/g, ""), 10)
      : typeof v === "number"
        ? v
        : NaN;
  return Number.isFinite(n) ? n : 0;
};

export async function fetchEpaEcho(a: { territory: string; rows?: number }) {
  const rows = a.rows ?? 100;
  const url = `${ECHO}?output=JSON&p_st=${encodeURIComponent(a.territory)}&p_act=Y&rows=${rows}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" },
    cache: "no-store"
  });
  const raw = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* non-JSON body -> handled below as zero records */
  }
  const R = parsed?.Results ?? {};
  const ok = R.Message === "Success";
  const prov = makeProvenance({
    source_id: "EPA-ECHO",
    jurisdiction: a.territory,
    source_url: url,
    body: raw,
    http_status: res.status,
    record_count: ok ? 1 : 0,
    access_note: "EPA ECHO public REST, no key. Aggregate compliance summary — counts only, not findings."
  });
  const capped = /Rows Returned would be (\d+)/.exec(String(R.Error?.ErrorMessage ?? ""));
  if (!ok && capped) {
    return {
      records: [],
      provenance: prov,
      capped_rows: Number(capped[1]),
      note: `ECHO reports ${Number(capped[1]).toLocaleString("en-US")} matching facilities but refuses aggregates above its queryset limit, so no penalty total is returned.`
    };
  }
  if (!ok) {
    return {
      records: [],
      provenance: prov,
      note: `ECHO query failed (HTTP ${res.status}): ${String(R.Message ?? R.Error?.ErrorMessage ?? "no response")}`
    };
  }
  const facilities = num(R.QueryRows);
  const records: EpaEchoRecord[] = [
    {
      territory: a.territory,
      active_facilities: facilities,
      caa_rows: num(R.CAARows),
      cwa_rows: num(R.CWARows),
      rcra_rows: num(R.RCRRows),
      tri_rows: num(R.TRIRows),
      inspections: num(R.INSPRows),
      total_penalties: String(R.TotalPenalties ?? ""),
      query_id: String(R.QueryID ?? ""),
      provenance: prov
    }
  ];
  return {
    records,
    provenance: prov,
    note: `${facilities.toLocaleString()} active facilities (aggregate summary).`
  };
}

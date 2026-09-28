/**
 * USAspending connector — current-fiscal-year federal award obligations by
 * awarding agency for one jurisdiction (place of performance).
 * LIVE-VERIFIED 2026-09-28: POST /api/v2/search/spending_by_category
 * (NO trailing slash — slashed path 404s) with category=awarding_agency,
 * place_of_performance state filter and time_period returns per-agency
 * obligations for states AND territories (AZ 44 agencies FY26, PR/VI/GU
 * verified with distinct plausible totals). No key. Amounts are obligations
 * to date for the fiscal year; negative values are net deobligations.
 */
import { makeProvenance, Provenance } from "../provenance";

const USASPENDING_URL = "https://api.usaspending.gov/api/v2/search/spending_by_category";

export interface AgencyObligation {
  code: string;
  name: string;
  amount: number;
}

export interface StateAgencyAwards {
  stateCode: string;
  fyLabel: string;
  byCode: Map<string, AgencyObligation>;
  provenance: Provenance;
  note: string;
}

export function currentFy(): { fy: number; label: string; start: string; end: string } {
  const now = new Date();
  const fy = now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  return { fy, label: `FY${String(fy).slice(2)}`, start: `${fy - 1}-10-01`, end: `${fy}-09-30` };
}

export async function fetchStateAgencyAwards(a: { stateCode: string }): Promise<StateAgencyAwards> {
  const { label, start, end } = currentFy();
  const body = JSON.stringify({
    filters: {
      place_of_performance_locations: [{ country: "USA", state: a.stateCode }],
      time_period: [{ start_date: start, end_date: end }]
    },
    category: "awarding_agency",
    limit: 100
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30000);
  let res: Response;
  let text: string;
  try {
    res = await fetch(USASPENDING_URL, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "Content-Type": "application/json", "User-Agent": "brain-lab-ingest/1.0" },
      body,
      cache: "no-store"
    });
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`USAspending HTTP ${res.status} for ${a.stateCode}`);
  const byCode = new Map<string, AgencyObligation>();
  try {
    const payload = JSON.parse(text) as {
      results?: Array<{ code?: unknown; name?: unknown; amount?: unknown }>;
    };
    for (const r of payload.results ?? []) {
      if (typeof r.code === "string" && typeof r.name === "string" && typeof r.amount === "number") {
        byCode.set(r.code.toUpperCase(), { code: r.code.toUpperCase(), name: r.name, amount: r.amount });
      }
    }
  } catch {
    throw new Error(`USAspending unparseable for ${a.stateCode}`);
  }
  const prov = makeProvenance({
    source_id: "USASPENDING",
    jurisdiction: a.stateCode,
    source_url: `${USASPENDING_URL} (category=awarding_agency, place_of_performance=${a.stateCode}, ${label})`,
    body: text,
    http_status: res.status,
    record_count: byCode.size,
    access_note: `USAspending.gov public API, no key. ${label} obligations by awarding agency, place of performance. Live per build.`
  });
  return {
    stateCode: a.stateCode,
    fyLabel: label,
    byCode,
    provenance: prov,
    note: `${byCode.size} awarding agencies with ${label} obligations performed in ${a.stateCode}.`
  };
}

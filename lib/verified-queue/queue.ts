/**
 * Verified anomaly queue — per-jurisdiction feed built ONLY from live public
 * APIs (OpenFEMA declarations, NWS alerts, FBI CDE violent crime, EPA ECHO,
 * DOJ national-security releases, USAspending obligations). Every item
 * carries provenance from the fetch that produced it; feeds that fail are
 * listed under `unavailable` with the reason. Nothing is estimated and no
 * narrative is generated — titles are upstream values (declaration titles,
 * alert event names, press-release headlines, agency names).
 */
import { jurisdictionByCode } from "../territory-catalog";
import { fetchFemaFiltered } from "../connectors/fema-filtered";
import { fetchNwsAlerts } from "../connectors/nws";
import { fetchFbiViolentCrime } from "../connectors/fbi-cde";
import { fetchEpaEcho } from "../connectors/epa-echo";
import { fetchDojNatsecReleases } from "../connectors/doj";
import { fetchStateAgencyAwards } from "../connectors/usaspending";
import { releasesByCode } from "../jurisdiction-cards/pipeline";
import { fmtMoney } from "../jurisdiction-cards/handbook";
import type { Provenance } from "../provenance";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const FEMA_OPEN_V2 = "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries";
const FEMA_ROWS = 40;
const FEMA_CAP = 10;
const DOJ_CAP = 10;
const USA_TOP = 3;

const cache = new Map<string, { at: number; result: VerifiedQueue }>();

export interface QueueItem {
  id: string;
  code: string;
  source_id: string;
  title: string;
  detail: string;
  date: string | null;
  url: string | null;
  provenance: Provenance | null;
}

export interface VerifiedQueue {
  code: string;
  name: string;
  generated_at: string;
  count: number;
  items: QueueItem[];
  unavailable: string[];
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
const day = (v: unknown): string | null => (typeof v === "string" && v.length >= 10 ? v.slice(0, 10) : null);

export async function buildVerifiedQueue(code: string): Promise<VerifiedQueue> {
  const upper = code.toUpperCase();
  const hit = cache.get(upper);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const j = jurisdictionByCode(upper);
  const fbiYear = new Date().getUTCFullYear() - 1;
  const items: QueueItem[] = [];
  const unavailable: string[] = [];

  const [fema, nws, fbi, doj, usa] = await Promise.all([
    fetchFemaFiltered({ baseUrl: FEMA_OPEN_V2, stateCode: upper, sourceId: "FEMA-DECL", jurisdiction: upper, rows: FEMA_ROWS }).then(
      (data) => ({ ok: true as const, data }),
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "fetch error" })
    ),
    fetchNwsAlerts({ code: upper }).then(
      (data) => ({ ok: true as const, data }),
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "fetch error" })
    ),
    fetchFbiViolentCrime({ code: upper, name: j.name, year: fbiYear }).then(
      (data) => ({ ok: true as const, data }),
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "fetch error" })
    ),
    fetchDojNatsecReleases().then(
      (data) => ({ ok: true as const, data }),
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "fetch error" })
    ),
    fetchStateAgencyAwards({ stateCode: upper }).then(
      (data) => ({ ok: true as const, data }),
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "fetch error" })
    )
  ]);

  // EPA gets a second attempt (flaky upstream) before being declared unavailable.
  let epa: Awaited<ReturnType<typeof fetchEpaEcho>> | null = null;
  let epaError: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetchEpaEcho({ territory: upper, rows: 1 });
      if (r.records.length > 0 || r.capped_rows !== undefined || r.provenance.http_status === 429) {
        epa = r;
        break;
      }
      epa = r;
    } catch (e) {
      epaError = e instanceof Error ? e.message : "fetch error";
    }
  }

  if (fema.ok) {
    // Summaries grain is declaration × designated area — dedupe declarations.
    const seen = new Set<string>();
    for (const r of fema.data.records) {
      if (seen.size >= FEMA_CAP) break;
      const decl = str(r.femaDeclarationString);
      if (!decl || seen.has(decl)) continue;
      seen.add(decl);
      items.push({
        id: `${upper}-FEMA-${decl}`,
        code: upper,
        source_id: "FEMA-DECL",
        title: `${str(r.declarationTitle) || decl} (${decl})`,
        detail: `${str(r.state)} • ${str(r.incidentType)}${r.incidentBeginDate ? ` • began ${day(r.incidentBeginDate)}` : ""}`,
        date: day(r.declarationDate),
        url: null,
        provenance: fema.data.provenance
      });
    }
  } else {
    unavailable.push(`FEMA-DECL: ${fema.error}`);
  }

  if (nws.ok) {
    items.push({
      id: `${upper}-NWS-ACTIVE`,
      code: upper,
      source_id: "NWS",
      title: `${nws.data.count} active NWS alert${nws.data.count === 1 ? "" : "s"}`,
      detail: nws.data.count === 0 ? "No active alerts for this area." : nws.data.note,
      date: null,
      url: null,
      provenance: nws.data.provenance
    });
  } else {
    unavailable.push(`NWS: ${nws.error}`);
  }

  if (fbi.ok) {
    const r = fbi.data;
    if (r.kind === "ok") {
      items.push({
        id: `${upper}-FBI-${r.year}`,
        code: upper,
        source_id: "FBI-CDE",
        title: `${r.offenses.toLocaleString("en-US")} reported violent offenses (${r.year})`,
        detail: `${r.months} months reporting • ${r.coverage_pct}% population coverage • reported offenses, not convictions.`,
        date: String(r.year),
        url: null,
        provenance: r.provenance
      });
    } else if (r.kind === "not-reported") {
      unavailable.push(`FBI-CDE: no ${r.year} reporting coverage for ${upper}.`);
    } else {
      unavailable.push(`FBI-CDE: ${r.message}`);
    }
  } else {
    unavailable.push(`FBI-CDE: ${fbi.error}`);
  }

  if (doj.ok) {
    const list = upper === "AS" ? [] : (releasesByCode(doj.data).get(upper) ?? []);
    if (upper === "AS") unavailable.push("DOJ-PRESS: American Samoa has no U.S. Attorney's Office; no attribution.");
    list.slice(0, DOJ_CAP).forEach((rel, i) => {
      items.push({
        id: `${upper}-DOJ-${i}`,
        code: upper,
        source_id: "DOJ-PRESS",
        title: rel.title,
        detail: `${rel.date} • ${rel.offices.join(", ")} — charges are allegations.`,
        date: rel.date,
        url: rel.url,
        provenance: rel.provenance
      });
    });
  } else {
    unavailable.push(`DOJ-PRESS: ${doj.error}`);
  }

  if (usa.ok) {
    const top = [...usa.data.byCode.values()].sort((a, b) => b.amount - a.amount).slice(0, USA_TOP);
    top.forEach((a) => {
      items.push({
        id: `${upper}-USA-${a.code}`,
        code: upper,
        source_id: "USASPENDING",
        title: `${fmtMoney(a.amount)} ${usa.data.fyLabel} awards — ${a.name}`,
        detail: `Federal award obligations performed in ${upper} (awarding agency).`,
        date: null,
        url: null,
        provenance: usa.data.provenance
      });
    });
    if (top.length === 0) unavailable.push(`USASPENDING: no ${usa.data.fyLabel} obligations for ${upper}.`);
  } else {
    unavailable.push(`USASPENDING: ${usa.error}`);
  }

  if (epa) {
    const rec = epa.records[0];
    if (rec) {
      items.push({
        id: `${upper}-EPA-FAC`,
        code: upper,
        source_id: "EPA-ECHO",
        title: `${rec.active_facilities.toLocaleString("en-US")} EPA-regulated active facilities`,
        detail: "Active facilities in ECHO (aggregate count, not findings).",
        date: rec.provenance.retrieved_at.slice(0, 10),
        url: null,
        provenance: rec.provenance
      });
      if (rec.total_penalties) {
        items.push({
          id: `${upper}-EPA-PEN`,
          code: upper,
          source_id: "EPA-ECHO",
          title: `EPA total penalties ${rec.total_penalties}`,
          detail: "Total penalties reported across active facilities.",
          date: rec.provenance.retrieved_at.slice(0, 10),
          url: null,
          provenance: rec.provenance
        });
      }
    } else if (epa.capped_rows !== undefined) {
      items.push({
        id: `${upper}-EPA-FAC`,
        code: upper,
        source_id: "EPA-ECHO",
        title: `${epa.capped_rows.toLocaleString("en-US")} EPA-regulated active facilities`,
        detail: "Active facilities count from ECHO's queryset-limit response.",
        date: epa.provenance.retrieved_at.slice(0, 10),
        url: null,
        provenance: epa.provenance
      });
    } else {
      unavailable.push(`EPA-ECHO: ${epa.note}`);
    }
  } else {
    unavailable.push(`EPA-ECHO: ${epaError ?? "fetch error"}`);
  }

  const result: VerifiedQueue = {
    code: upper,
    name: j.name,
    generated_at: new Date().toISOString(),
    count: items.length,
    items,
    unavailable
  };
  cache.set(upper, { at: Date.now(), result });
  return result;
}

/**
 * Handbook resolver — maps every 1988 American Information Handbook entity
 * onto live per-jurisdiction metrics for the jurisdiction-cards section.
 *
 * Wiring, in priority order per entity:
 *  1. Shared card bindings (BLS/CENSUS/EPA/DOJ/FBI values already sourced on
 *     the card) — same verified fetch, zero extra cost.
 *  2. USAspending current-FY obligations by awarding agency (place of
 *     performance = this jurisdiction). Covers nearly every department and
 *     several independent agencies, states and territories alike.
 *  3. NWS active-alert count (State) and OpenFEMA declaration count
 *     (State, FEMA).
 *
 * Entities with no public per-jurisdiction feed resolve to `not-published`
 * with the reason — never an invented value. Entities whose feeds all failed
 * resolve to `error`.
 */
import { HANDBOOK_ENTITIES } from "../jurisdiction-feeds/handbook-seed";
import type { FemaFilteredFetch } from "../connectors/fema-filtered";
import type { NwsAlerts } from "../connectors/nws";
import { currentFy, type StateAgencyAwards } from "../connectors/usaspending";
import type { CardField, CardFieldId, CardFieldStatus, HandbookEntry } from "./types";

export type SourceResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface HandbookCtx {
  code: string;
  fields: Record<CardFieldId, CardField>;
  fema: SourceResult<FemaFilteredFetch>;
  nws: SourceResult<NwsAlerts>;
  usa: SourceResult<StateAgencyAwards>;
}

interface Metric {
  text: string;
  sourceId: string;
  provenance: CardField["provenance"];
}

interface EntityWire {
  shared?: CardFieldId[];
  awards?: string;
  fema?: boolean;
  nws?: boolean;
  extraNote?: string;
  unpublishable?: string;
}

const USGS_NOTE = "USGS event API publishes no state-level aggregate; not wired.";
const GSE_NOTE = "GSE; outside the USAspending award universe, no public per-state series.";

const WIRE: Record<string, EntityWire> = {
  "DEPT-STATE": { nws: true, fema: true, awards: "DOS" },
  "DEPT-TREASURY": { awards: "TREAS" },
  "DEPT-DEFENSE": { awards: "DOD", extraNote: USGS_NOTE },
  "DEPT-JUSTICE": { shared: ["fbi_crime", "doj_natsec"], awards: "DOJ" },
  "DEPT-INTERIOR": { awards: "DOI", extraNote: USGS_NOTE },
  "DEPT-AGRICULTURE": { awards: "USDA" },
  "DEPT-COMMERCE": { shared: ["population"], awards: "DOC" },
  "DEPT-LABOR": { shared: ["unemployment"], awards: "DOL" },
  "DEPT-HHS": { awards: "HHS" },
  "DEPT-HUD": { awards: "HUD" },
  "DEPT-TRANSPORTATION": { awards: "DOT" },
  "DEPT-ENERGY": { awards: "DOE" },
  "DEPT-EDUCATION": { awards: "ED" },
  "DEPT-VA": { awards: "VA" },
  "AGENCY-EPA": { shared: ["epa_facilities", "epa_penalties"], awards: "EPA" },
  "AGENCY-NASA": { awards: "NASA" },
  "AGENCY-NSF": { awards: "NSF" },
  "AGENCY-GSA": { awards: "GSA" },
  "AGENCY-SBA": { awards: "SBA" },
  "AGENCY-FEMA": { fema: true, extraNote: "FEMA award dollars roll up under DHS in USAspending; declarations shown." },
  "AGENCY-SEC": { awards: "SEC" },
  "AGENCY-FCC": { awards: "FCC" },
  "AGENCY-FTC": { awards: "FTC" },
  "AGENCY-FEC": { awards: "FEC" },
  "AGENCY-CFTC": { awards: "CFTC" },
  "AGENCY-FDIC": { awards: "FDIC", unpublishable: "FDIC is self-funded (deposit-insurance premiums); no state award series." },
  "AGENCY-NRC": { awards: "NRC" },
  "AGENCY-FED": { unpublishable: "Federal Reserve is self-funded; no federal award obligations." },
  "AGENCY-CIA": { unpublishable: "No public per-jurisdiction data (classified budgets)." },
  "AGENCY-SSA": { awards: "SSA" },
  "AGENCY-NARA": { awards: "NARA" },
  "AGENCY-NCUA": { awards: "NCUA", unpublishable: "NCUA is self-funded (credit-union premiums); no state award series." },
  "AGENCY-NLRB": { awards: "NLRB" },
  "AGENCY-NTSB": { awards: "NTSB" },
  "GSE-FANNIE-MAE": { unpublishable: "In federal conservatorship; " + GSE_NOTE.slice(5) },
  "GSE-FREDDIE-MAC": { unpublishable: "In federal conservatorship; " + GSE_NOTE.slice(5) },
  "GSE-FHLBANK": { unpublishable: GSE_NOTE },
  "GSE-GINNIE-MAE": { unpublishable: GSE_NOTE },
  "GSE-TVA": { awards: "TVA", unpublishable: "No TVA state award series in this build's USAspending response." },
  "GSE-AMTRAK": { unpublishable: "Amtrak is a grant recipient, not an awarding agency; no per-state series." },
  "GSE-EXIM": { awards: "EXIM" },
  "GSE-FARMER-MAC": { unpublishable: GSE_NOTE }
};

export function fmtMoney(n: number): string {
  const neg = n < 0;
  const a = Math.abs(n);
  const s =
    a >= 1e9 ? `$${(a / 1e9).toFixed(1)}B` :
    a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` :
    a >= 1e3 ? `$${(a / 1e3).toFixed(1)}K` :
    `$${Math.round(a).toLocaleString("en-US")}`;
  return neg ? `-${s}` : s;
}

function sharedMetric(f: CardField): Metric | null {
  if (f.status !== "sourced" || !f.value) return null;
  return {
    text: `${f.label} ${f.value}${f.as_of ? ` (${f.as_of})` : ""}`,
    sourceId: f.source_id,
    provenance: f.provenance
  };
}

export function buildHandbookEntries(ctx: HandbookCtx): HandbookEntry[] {
  const fyLabel = ctx.usa.ok ? ctx.usa.data.fyLabel : currentFy().label;
  const femaTotal = ctx.fema.ok ? ctx.fema.data.total_count : null;

  return HANDBOOK_ENTITIES.map((e) => {
    const w: EntityWire = WIRE[e.id] ?? {};
    const metrics: Metric[] = [];
    const errors: string[] = [];

    for (const id of w.shared ?? []) {
      const m = sharedMetric(ctx.fields[id]);
      if (m) metrics.push(m);
      else if (ctx.fields[id].status === "error") errors.push(`${ctx.fields[id].source_id}: ${ctx.fields[id].note}`);
    }
    if (w.awards) {
      if (ctx.usa.ok) {
        const hit = ctx.usa.data.byCode.get(w.awards);
        if (hit) {
          metrics.push({
            text: `${fmtMoney(hit.amount)} ${fyLabel} AWARDS`,
            sourceId: "USASPENDING",
            provenance: ctx.usa.data.provenance
          });
        }
      } else {
        errors.push(`USASPENDING: ${ctx.usa.error}`);
      }
    }
    if (w.fema) {
      if (ctx.fema.ok && femaTotal !== null) {
        metrics.push({
          text: `${femaTotal.toLocaleString("en-US")} FEMA DECLARATION${femaTotal === 1 ? "" : "S"}`,
          sourceId: "FEMA-DECL",
          provenance: ctx.fema.data.provenance
        });
      } else {
        errors.push(ctx.fema.ok ? "FEMA-DECL: no declaration count returned" : `FEMA-DECL: ${ctx.fema.error}`);
      }
    }
    if (w.nws) {
      if (ctx.nws.ok) {
        const n = ctx.nws.data.count;
        metrics.push({
          text: `${n} ACTIVE NWS ALERT${n === 1 ? "" : "S"}`,
          sourceId: "NWS",
          provenance: ctx.nws.data.provenance
        });
      } else {
        errors.push(`NWS: ${ctx.nws.error}`);
      }
    }

    let status: CardFieldStatus;
    let note: string;
    if (metrics.length > 0) {
      status = "sourced";
      note = w.extraNote ?? "";
    } else if (errors.length > 0) {
      status = "error";
      note = errors.slice(0, 2).join("; ");
    } else {
      status = "not-published";
      note =
        w.unpublishable ??
        (w.awards
          ? `No ${fyLabel} award obligations in ${ctx.code} (absent from this build's USAspending response).`
          : `No public per-jurisdiction feed publishes this entity for ${ctx.code}.`);
    }

    const sources = [...new Set(metrics.map((m) => m.sourceId))];
    return {
      id: e.id,
      name: e.name,
      branch: e.branch,
      category: e.category,
      status,
      sources,
      value: metrics.length > 0 ? metrics.map((m) => m.text).join(" • ") : null,
      note,
      provenance: metrics[0]?.provenance ?? null
    };
  });
}

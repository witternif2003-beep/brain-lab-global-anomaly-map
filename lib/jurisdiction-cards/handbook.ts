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
 *  4. FDIC insured-institution count by charter state (FDIC) and USGS
 *     disclosed-radius quake count (Defense, Interior).
 *  5. NATIONAL Federal Register trailing-12-month document counts — only for
 *     entities with no per-state series at all, always labeled NATIONAL.
 *
 * Entities with no public feed of any kind (CIA, most GSEs) resolve to
 * `not-published` with the reason — never an invented value. Entities whose
 * feeds all failed resolve to `error`.
 */
import { HANDBOOK_ENTITIES } from "../jurisdiction-feeds/handbook-seed";
import type { FemaFilteredFetch } from "../connectors/fema-filtered";
import type { NwsAlerts } from "../connectors/nws";
import { currentFy, type StateAgencyAwards } from "../connectors/usaspending";
import type { FdicCount } from "../connectors/fdic";
import { USGS_MIN_MAG, USGS_RADIUS_KM, USGS_WINDOW_DAYS, type UsgsCount } from "../connectors/usgs";
import type { FederalRegisterResult } from "../connectors/federal-register";
import type { CardField, CardFieldId, CardFieldStatus, HandbookEntry } from "./types";

export type SourceResult<T> = { ok: true; data: T } | { ok: false; error: string };

export interface HandbookCtx {
  code: string;
  fields: Record<CardFieldId, CardField>;
  fema: SourceResult<FemaFilteredFetch>;
  nws: SourceResult<NwsAlerts>;
  usa: SourceResult<StateAgencyAwards>;
  fdic: SourceResult<FdicCount>;
  usgs: SourceResult<UsgsCount>;
  /** National Federal Register counts — same object shared by all 56 cards. */
  fr: SourceResult<FederalRegisterResult>;
}

/**
 * Federal Register slugs (all verified live 2026-09-28 with real counts).
 * Departments + big agencies use them as fallback-only (shown only when no
 * jurisdiction-specific metric exists); feed-less entities use them primary.
 */
export const FR_SLUGS = [
  "state-department",
  "treasury-department",
  "defense-department",
  "justice-department",
  "interior-department",
  "agriculture-department",
  "commerce-department",
  "labor-department",
  "health-and-human-services-department",
  "housing-and-urban-development-department",
  "transportation-department",
  "energy-department",
  "education-department",
  "veterans-affairs-department",
  "environmental-protection-agency",
  "national-aeronautics-and-space-administration",
  "national-science-foundation",
  "general-services-administration",
  "small-business-administration",
  "federal-emergency-management-agency",
  "securities-and-exchange-commission",
  "federal-communications-commission",
  "social-security-administration",
  "export-import-bank",
  "federal-trade-commission",
  "federal-election-commission",
  "commodity-futures-trading-commission",
  "nuclear-regulatory-commission",
  "federal-reserve-system",
  "central-intelligence-agency",
  "national-credit-union-administration",
  "national-transportation-safety-board",
  "national-labor-relations-board",
  "national-archives-and-records-administration",
  "tennessee-valley-authority",
  "federal-deposit-insurance-corporation"
];

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
  fdic?: boolean;
  usgs?: boolean;
  fr?: string;
  /** Show the FR national metric only when no jurisdiction metric exists. */
  frFallbackOnly?: boolean;
  extraNote?: string;
  unpublishable?: string;
}

const USGS_METHOD =
  `USGS: M${USGS_MIN_MAG}+ quakes within ${USGS_RADIUS_KM} km of the card centroid, trailing ${USGS_WINDOW_DAYS} d ` +
  "(disclosed radial method; not a state-boundary query).";
const FR_NOTE =
  "Federal Register count is a NATIONAL trailing-12-month aggregate; the agency publishes no per-state series.";
const GSE_NOTE = "GSE; outside the USAspending award universe, no public per-state series.";

const WIRE: Record<string, EntityWire> = {
  "DEPT-STATE": { nws: true, fema: true, awards: "DOS", fr: "state-department", frFallbackOnly: true },
  "DEPT-TREASURY": { awards: "TREAS", fr: "treasury-department", frFallbackOnly: true },
  "DEPT-DEFENSE": { awards: "DOD", usgs: true, fr: "defense-department", frFallbackOnly: true, extraNote: USGS_METHOD },
  "DEPT-JUSTICE": { shared: ["fbi_crime", "doj_natsec"], awards: "DOJ", fr: "justice-department", frFallbackOnly: true },
  "DEPT-INTERIOR": { awards: "DOI", usgs: true, fr: "interior-department", frFallbackOnly: true, extraNote: USGS_METHOD },
  "DEPT-AGRICULTURE": { awards: "USDA", fr: "agriculture-department", frFallbackOnly: true },
  "DEPT-COMMERCE": { shared: ["population"], awards: "DOC", fr: "commerce-department", frFallbackOnly: true },
  "DEPT-LABOR": { shared: ["unemployment"], awards: "DOL", fr: "labor-department", frFallbackOnly: true },
  "DEPT-HHS": { awards: "HHS", fr: "health-and-human-services-department", frFallbackOnly: true },
  "DEPT-HUD": { awards: "HUD", fr: "housing-and-urban-development-department", frFallbackOnly: true },
  "DEPT-TRANSPORTATION": { awards: "DOT", fr: "transportation-department", frFallbackOnly: true },
  "DEPT-ENERGY": { awards: "DOE", fr: "energy-department", frFallbackOnly: true },
  "DEPT-EDUCATION": { awards: "ED", fr: "education-department", frFallbackOnly: true },
  "DEPT-VA": { awards: "VA", fr: "veterans-affairs-department", frFallbackOnly: true },
  "AGENCY-EPA": { shared: ["epa_facilities", "epa_penalties"], awards: "EPA", fr: "environmental-protection-agency", frFallbackOnly: true },
  "AGENCY-NASA": { awards: "NASA", fr: "national-aeronautics-and-space-administration", frFallbackOnly: true },
  "AGENCY-NSF": { awards: "NSF", fr: "national-science-foundation", frFallbackOnly: true },
  "AGENCY-GSA": { awards: "GSA", fr: "general-services-administration", frFallbackOnly: true },
  "AGENCY-SBA": { awards: "SBA", fr: "small-business-administration", frFallbackOnly: true },
  "AGENCY-FEMA": { fema: true, fr: "federal-emergency-management-agency", frFallbackOnly: true, extraNote: "FEMA award dollars roll up under DHS in USAspending; declarations shown." },
  "AGENCY-SEC": { awards: "SEC", fr: "securities-and-exchange-commission", frFallbackOnly: true },
  "AGENCY-FCC": { awards: "FCC", fr: "federal-communications-commission", frFallbackOnly: true },
  "AGENCY-FTC": { awards: "FTC", fr: "federal-trade-commission" },
  "AGENCY-FEC": { awards: "FEC", fr: "federal-election-commission" },
  "AGENCY-CFTC": { awards: "CFTC", fr: "commodity-futures-trading-commission" },
  "AGENCY-FDIC": { awards: "FDIC", fdic: true, fr: "federal-deposit-insurance-corporation", frFallbackOnly: true },
  "AGENCY-NRC": { awards: "NRC", fr: "nuclear-regulatory-commission" },
  "AGENCY-FED": { fr: "federal-reserve-system" },
  "AGENCY-CIA": { fr: "central-intelligence-agency" },
  "AGENCY-SSA": { awards: "SSA", fr: "social-security-administration", frFallbackOnly: true },
  "AGENCY-NARA": { awards: "NARA", fr: "national-archives-and-records-administration" },
  "AGENCY-NCUA": { awards: "NCUA", fr: "national-credit-union-administration" },
  "AGENCY-NLRB": { awards: "NLRB", fr: "national-labor-relations-board" },
  "AGENCY-NTSB": { awards: "NTSB", fr: "national-transportation-safety-board" },
  "GSE-FANNIE-MAE": { unpublishable: "In federal conservatorship; " + GSE_NOTE.slice(5) },
  "GSE-FREDDIE-MAC": { unpublishable: "In federal conservatorship; " + GSE_NOTE.slice(5) },
  "GSE-FHLBANK": { unpublishable: GSE_NOTE },
  "GSE-GINNIE-MAE": { unpublishable: GSE_NOTE },
  "GSE-TVA": { awards: "TVA", fr: "tennessee-valley-authority" },
  "GSE-AMTRAK": { unpublishable: "Amtrak is a grant recipient, not an awarding agency; no per-state series." },
  "GSE-EXIM": { awards: "EXIM", fr: "export-import-bank", frFallbackOnly: true },
  "GSE-FARMER-MAC": { unpublishable: GSE_NOTE }
};

/** Shared wiring (awards codes, FR slugs, unpublishable reasons) for reuse. */
export const HANDBOOK_WIRE: Record<string, EntityWire> = WIRE;

export function fmtMoney(n: number): string {
  const neg = n < 0;
  const a = Math.abs(n);
  const s =
    a >= 1e12 ? `$${(a / 1e12).toFixed(1)}T` :
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
    const notes: string[] = w.extraNote ? [w.extraNote] : [];

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
    if (w.fdic) {
      if (ctx.fdic.ok) {
        const n = ctx.fdic.data.total;
        metrics.push({
          text: `${n.toLocaleString("en-US")} FDIC-INSURED INSTITUTION${n === 1 ? "" : "S"}`,
          sourceId: "FDIC",
          provenance: ctx.fdic.data.provenance
        });
      } else {
        errors.push(`FDIC: ${ctx.fdic.error}`);
      }
    }
    if (w.usgs) {
      if (ctx.usgs.ok) {
        metrics.push({
          text: `${ctx.usgs.data.count} QUAKES M${USGS_MIN_MAG}+ (${USGS_RADIUS_KM}KM/${USGS_WINDOW_DAYS}D)`,
          sourceId: "USGS",
          provenance: ctx.usgs.data.provenance
        });
      } else {
        errors.push(`USGS: ${ctx.usgs.error}`);
      }
    }
    if (w.fr) {
      const otherwiseEmpty = metrics.length === 0;
      if (ctx.fr.ok) {
        const hit = ctx.fr.data.counts.get(w.fr);
        if (hit) {
          if (!(w.frFallbackOnly && !otherwiseEmpty)) {
            metrics.push({
              text: `${hit.count.toLocaleString("en-US")} FR DOCS (NATIONAL, 12 MO)`,
              sourceId: "FED-REGISTER",
              provenance: hit.provenance
            });
            notes.push(FR_NOTE);
          }
        } else if (otherwiseEmpty) {
          errors.push(`FED-REGISTER: ${w.fr} unavailable this build`);
        }
      } else if (otherwiseEmpty) {
        errors.push(`FED-REGISTER: ${ctx.fr.error}`);
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
      note = notes.join(" ");
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

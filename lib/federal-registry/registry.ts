/**
 * Federal Registry — national directory of the 42 handbook entities with
 * live national metrics: USAspending FY obligations by awarding agency,
 * Federal Register trailing-12-month document counts, and newest FR
 * documents per entity. All values are NATIONAL (jurisdiction ALL);
 * per-jurisdiction views live on the jurisdiction cards.
 */
import { HANDBOOK_ENTITIES } from "../jurisdiction-feeds/handbook-seed";
import { FR_SLUGS, HANDBOOK_WIRE, fmtMoney } from "../jurisdiction-cards/handbook";
import { fetchNationalAwardsByAgency } from "../connectors/usaspending";
import {
  fetchFederalRegisterCounts,
  fetchRecentDocumentsBatch,
  type FrDocument
} from "../connectors/federal-register";
import type { Provenance } from "../provenance";
import type { CardFieldStatus } from "../jurisdiction-cards/types";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let cache: { at: number; result: FederalRegistry } | null = null;

export interface RegistryEntity {
  id: string;
  name: string;
  branch: string;
  category: string;
  status: CardFieldStatus;
  sources: string[];
  awards_usd: number | null;
  awards_label: string | null;
  fr_slug: string | null;
  fr_count_12mo: number | null;
  fr_recent: FrDocument[];
  note: string;
  provenance: Provenance | null;
  docs_provenance: Provenance | null;
}

export interface FederalRegistry {
  generated_at: string;
  fy_label: string;
  count: number;
  live_count: number;
  entities: RegistryEntity[];
}

export async function buildFederalRegistry(opts: { fresh?: boolean } = {}): Promise<FederalRegistry> {
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.result;

  const [awardsRes, frRes] = await Promise.all([
    fetchNationalAwardsByAgency().then(
      (data) => ({ ok: true as const, data }),
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "fetch error" })
    ),
    fetchFederalRegisterCounts(FR_SLUGS).then(
      (data) => ({ ok: true as const, data }),
      (e: unknown) => ({ ok: false as const, error: e instanceof Error ? e.message : "fetch error" })
    )
  ]);

  // Recent docs only for slugs that have documents (saves calls on zeros).
  const docSlugs = frRes.ok
    ? [...frRes.data.counts.values()].filter((c) => c.count > 0).map((c) => c.slug)
    : [];
  const recent = await fetchRecentDocumentsBatch(docSlugs, 5);

  const fyLabel = awardsRes.ok ? awardsRes.data.fyLabel : "FY?";
  const entities: RegistryEntity[] = HANDBOOK_ENTITIES.map((e) => {
    const w = HANDBOOK_WIRE[e.id] ?? {};
    const sources: string[] = [];
    let awards_usd: number | null = null;
    let fr_count: number | null = null;
    let prov: Provenance | null = null;
    const errors: string[] = [];

    if (w.awards) {
      if (awardsRes.ok) {
        const hit = awardsRes.data.byCode.get(w.awards);
        if (hit) {
          awards_usd = hit.amount;
          sources.push("USASPENDING");
          prov = awardsRes.data.provenance;
        }
      } else {
        errors.push(`USASPENDING: ${awardsRes.error}`);
      }
    }
    let frRecent: FrDocument[] = [];
    let docsProv: Provenance | null = null;
    if (w.fr) {
      if (frRes.ok) {
        const hit = frRes.data.counts.get(w.fr);
        if (hit) {
          fr_count = hit.count;
          sources.push("FED-REGISTER");
          if (!prov) prov = hit.provenance;
          const rec = recent.docs.get(w.fr);
          if (rec) {
            frRecent = rec.docs;
            docsProv = rec.provenance;
          }
        } else {
          errors.push(`FED-REGISTER: ${w.fr} unavailable this build`);
        }
      } else {
        errors.push(`FED-REGISTER: ${frRes.error}`);
      }
    }

    let status: CardFieldStatus;
    let note: string;
    if (sources.length > 0) {
      status = "sourced";
      const parts: string[] = [];
      if (awards_usd !== null) parts.push(`${fmtMoney(awards_usd)} ${fyLabel} NATIONAL AWARDS`);
      if (fr_count !== null) parts.push(`${fr_count.toLocaleString("en-US")} FR DOCS (12 MO)`);
      note = parts.join(" • ");
    } else if (errors.length > 0) {
      status = "error";
      note = errors.slice(0, 2).join("; ");
    } else {
      status = "not-published";
      note = w.unpublishable ?? "No national feed publishes this entity.";
    }

    return {
      id: e.id,
      name: e.name,
      branch: e.branch,
      category: e.category,
      status,
      sources,
      awards_usd,
      awards_label: awards_usd !== null ? `${fmtMoney(awards_usd)} ${fyLabel}` : null,
      fr_slug: w.fr ?? null,
      fr_count_12mo: fr_count,
      fr_recent: frRecent,
      note,
      provenance: prov,
      docs_provenance: docsProv
    };
  });

  const result: FederalRegistry = {
    generated_at: new Date().toISOString(),
    fy_label: fyLabel,
    count: entities.length,
    live_count: entities.filter((x) => x.status === "sourced").length,
    entities
  };
  cache = { at: Date.now(), result };
  return result;
}

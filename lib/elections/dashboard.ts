/**
 * Voter-registration dashboard builder — 56 cards from live public sources.
 *
 * Each card = pinned USA.gov office entry + live site probe + EAC 2024 EAVS
 * aggregate totals + justice.gov voting-related releases attributed by
 * title mention. Failed feeds land in `unavailable` with reasons. Cached 6h.
 */
import { ELECTION_OFFICES, getElectionOffice } from "./offices";
import { probeOffices } from "./probes";
import { fetchEavsTotals } from "./eavs";
import { fetchDojVotingReleases } from "./doj";
import type { VoterDashboard, VoterDashboardCard } from "./types";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const cache = new Map<string, { at: number; result: VoterDashboard }>();

export async function buildVoterDashboard(code: string): Promise<VoterDashboard> {
  const upper = code.toUpperCase();
  const key = upper === "ALL" ? "ALL" : upper;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.result;

  const offices = upper === "ALL"
    ? ELECTION_OFFICES
    : [getElectionOffice(upper)].filter((o) => o !== undefined);
  if (offices.length === 0) throw new Error(`Unknown jurisdiction: ${upper}`);

  const unavailable: string[] = [];
  const [probes, eavs, doj] = await Promise.all([
    probeOffices(offices).catch((e: unknown): [] => {
      unavailable.push(`office probes failed: ${e instanceof Error ? e.message : "fetch error"}`);
      return [];
    }),
    fetchEavsTotals().catch((e: unknown) => {
      unavailable.push(`EAC EAVS 2024 file unreachable: ${e instanceof Error ? e.message : "fetch error"}`);
      return null;
    }),
    fetchDojVotingReleases().catch((e: unknown) => {
      unavailable.push(`DOJ news feed error: ${e instanceof Error ? e.message : "fetch error"}`);
      return { available: false, reason: "fetch threw", fetchedAt: "", byCode: new Map() };
    }),
  ]);
  if (!doj.available && doj.reason) unavailable.push(`DOJ press releases unavailable: ${doj.reason}`);

  const probeByCode = new Map(probes.map((p) => [p.code, p]));
  const cards: VoterDashboardCard[] = offices.map((office) => ({
    office,
    probe: probeByCode.get(office.code) ?? null,
    eavs: eavs?.get(office.code) ?? null,
    dojReleases: doj.byCode.get(office.code) ?? [],
  }));

  const result: VoterDashboard = {
    generatedAt: new Date().toISOString(),
    cards,
    unavailable,
    dojAvailable: doj.available,
  };
  cache.set(key, { at: Date.now(), result });
  return result;
}

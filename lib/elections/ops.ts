import { getContentStores, type ChangeRecord } from "./change-store";
import { checkDirectoryDrift, type DirectoryDrift } from "./directory-drift";
import { ELECTION_OFFICE_DIRECTORY, ELECTION_OFFICES } from "./election-offices";
import { verifyOfficePage, type CitationVerification } from "./entity-name-verifier";
import { MemorySink, type ProbeRunEvent } from "./probe-telemetry";
import { runProbes, type RunnerSummary } from "./probe-runner";
import { getHealthStore } from "./source-health-store";
import { scoreRecord, type ReliabilityScore } from "./source-reliability";
import type { ElectionOffice, SourceProbe } from "./types";

export const PROBE_TTL_MS = 15 * 60 * 1000;
/** Forced re-probes closer together than this reuse the last run */
export const MIN_FORCE_INTERVAL_MS = 2 * 60 * 1000;

export interface OfficeRow {
  code: string;
  name: string;
  type: ElectionOffice["type"];
  url: string;
  probe?: SourceProbe;
  reliability: ReliabilityScore;
  verification: CitationVerification;
  lastChange?: Pick<ChangeRecord, "capturedAt" | "fromFingerprint" | "toFingerprint" | "diff">;
  changeCount: number;
}

export interface OpsReport {
  generatedAt: string;
  directory: typeof ELECTION_OFFICE_DIRECTORY;
  store: string;
  lastRun?: ProbeRunEvent & { summary: RunnerSummary };
  counts: {
    offices: number;
    healthy: number;
    degraded: number;
    failing: number;
    unknown: number;
    verified: number;
    notFound: number;
    unverifiable: number;
    changed: number;
  };
  rows: OfficeRow[];
  drift: DirectoryDrift | null;
}

interface CachedRun {
  at: number;
  event: ProbeRunEvent & { summary: RunnerSummary };
  texts: Map<string, string>;
}

let lastRun: CachedRun | undefined;
let inflight: Promise<CachedRun> | undefined;
let lastDrift: DirectoryDrift | null = null;

async function probeAll(): Promise<CachedRun> {
  const stores = { health: getHealthStore(), ...getContentStores() };
  const sink = new MemorySink();
  const result = await runProbes(ELECTION_OFFICES.map((o) => o.url), stores, { maxHostConcurrency: 12, perHostDelayMs: 400, telemetry: sink });
  const runEvent = sink.events.find((e): e is ProbeRunEvent => e.eventType === "roster.probe_run");
  if (!runEvent) throw new Error("probe run emitted no summary event");
  return { at: Date.now(), event: { ...runEvent, summary: result.summary }, texts: result.texts };
}

/**
 * Builds the ops report. Probes run when the last run is older than
 * PROBE_TTL_MS, or on `probe` once MIN_FORCE_INTERVAL_MS has passed;
 * concurrent callers share one in-flight run.
 */
export async function buildOpsReport(opts: { probe?: boolean } = {}): Promise<OpsReport> {
  const age = lastRun ? Date.now() - lastRun.at : Number.POSITIVE_INFINITY;
  if (age > PROBE_TTL_MS || (opts.probe && age > MIN_FORCE_INTERVAL_MS)) {
    inflight ??= Promise.all([probeAll(), checkDirectoryDrift(ELECTION_OFFICES)])
      .then(([run, drift]) => {
        lastRun = run;
        lastDrift = drift;
        return run;
      })
      .finally(() => {
        inflight = undefined;
      });
    await inflight;
  }

  const health = getHealthStore();
  const { changes } = getContentStores();
  const texts = lastRun?.texts ?? new Map<string, string>();

  const rows: OfficeRow[] = await Promise.all(
    ELECTION_OFFICES.map(async (o) => {
      const rec = await health.getByUrl(o.url);
      const list = await changes.listByUrl(o.url);
      const latest = list[0];
      return {
        code: o.code,
        name: o.name,
        type: o.type,
        url: o.url,
        probe: rec?.lastProbe,
        reliability: scoreRecord(rec, o.url),
        verification: verifyOfficePage(o, rec?.lastProbe, texts.get(o.url)),
        lastChange: latest && { capturedAt: latest.capturedAt, fromFingerprint: latest.fromFingerprint, toFingerprint: latest.toFingerprint, diff: latest.diff },
        changeCount: list.length
      };
    })
  );

  const count = (f: (r: OfficeRow) => boolean) => rows.filter(f).length;
  return {
    generatedAt: new Date().toISOString(),
    directory: ELECTION_OFFICE_DIRECTORY,
    store: health.kind,
    lastRun: lastRun?.event,
    counts: {
      offices: rows.length,
      healthy: count((r) => r.reliability.band === "healthy"),
      degraded: count((r) => r.reliability.band === "degraded"),
      failing: count((r) => r.reliability.band === "failing"),
      unknown: count((r) => r.reliability.band === "unknown"),
      verified: count((r) => r.verification.verdict === "verified"),
      notFound: count((r) => r.verification.verdict === "not-found"),
      unverifiable: count((r) => r.verification.verdict === "unverifiable"),
      changed: count((r) => r.changeCount > 0)
    },
    rows,
    drift: lastDrift
  };
}

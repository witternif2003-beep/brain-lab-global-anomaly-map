import { buildChangeRecord, captureContent, type ChangeStore, type ContentStore } from "./change-store";
import { applyProbe, isHealthy, probeSource, type ProbeOptions } from "./source-health";
import type { SourceHealthStore } from "./source-health-store";
import { hostOf } from "./source-probe-policy";
import { toProbeEvent, type TelemetrySink } from "./probe-telemetry";
import type { SourceHealthRecord, SourceProbe } from "./types";

export interface RunnerOptions {
  /** Hosts probed at the same time */
  maxHostConcurrency?: number;
  /** Pause between two probes to the same host */
  perHostDelayMs?: number;
  probeOptions?: ProbeOptions;
  telemetry?: TelemetrySink;
  onProbe?: (info: { url: string; probe: SourceProbe; index: number; total: number }) => void;
}

export interface RunnerSummary {
  total: number;
  ok: number;
  notModified: number;
  blocked: number;
  httpError: number;
  dnsError: number;
  tlsError: number;
  timeout: number;
  networkError: number;
  tooLarge: number;
  changed: number;
}

export interface RunnerResult {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  records: SourceHealthRecord[];
  /** Normalized text of each page read this run, keyed by URL */
  texts: Map<string, string>;
  summary: RunnerSummary;
}

export interface RunnerStores {
  health: SourceHealthStore;
  content: ContentStore;
  changes: ChangeStore;
}

const SUMMARY_KEY: Record<SourceProbe["status"], keyof RunnerSummary> = {
  ok: "ok",
  "not-modified": "notModified",
  blocked: "blocked",
  "http-error": "httpError",
  "dns-error": "dnsError",
  "tls-error": "tlsError",
  timeout: "timeout",
  "network-error": "networkError",
  "too-large": "tooLarge"
};

/** Probes every URL: hosts run in parallel up to the cap, URLs on one host run one at a time. */
export async function runProbes(urls: string[], stores: RunnerStores, opts: RunnerOptions = {}): Promise<RunnerResult> {
  const startedAtMs = Date.now();
  const unique = [...new Set(urls)];
  const byHost = new Map<string, string[]>();
  for (const u of unique) {
    const h = hostOf(u) || "__invalid__";
    byHost.set(h, [...(byHost.get(h) ?? []), u]);
  }

  const maxHosts = Math.max(1, opts.maxHostConcurrency ?? 8);
  const perHostDelay = opts.perHostDelayMs ?? 500;
  const records: SourceHealthRecord[] = [];
  const texts = new Map<string, string>();
  const summary: RunnerSummary = {
    total: 0, ok: 0, notModified: 0, blocked: 0, httpError: 0, dnsError: 0, tlsError: 0, timeout: 0, networkError: 0, tooLarge: 0, changed: 0
  };
  let index = 0;

  const probeOne = async (url: string) => {
    const prior = await stores.health.getByUrl(url);
    const { probe, normalized } = await probeSource(url, {
      etag: prior?.lastFingerprint ? prior.lastProbe.etag : undefined,
      lastModified: prior?.lastFingerprint ? prior.lastProbe.lastModified : undefined,
      ...opts.probeOptions
    });
    const record = applyProbe(prior, probe);
    const changed = !!prior?.lastFingerprint && !!record.lastFingerprint && prior.lastFingerprint !== record.lastFingerprint;

    if (normalized !== undefined && probe.fingerprint) {
      texts.set(url, normalized);
      const current = captureContent(url, probe.fingerprint, normalized, probe.probedAt);
      const before = await stores.content.get(url);
      if (before && before.fingerprint !== current.fingerprint) await stores.changes.record(buildChangeRecord(before, current));
      if (!before || before.fingerprint !== current.fingerprint) await stores.content.put(current);
    } else if (probe.status === "not-modified") {
      const stored = await stores.content.get(url);
      if (stored) texts.set(url, stored.normalized);
    }

    records.push(record);
    summary.total++;
    summary[SUMMARY_KEY[probe.status]]++;
    if (changed) summary.changed++;
    opts.telemetry?.emit(toProbeEvent(record.lastProbe, changed));
    opts.onProbe?.({ url, probe: record.lastProbe, index: index++, total: unique.length });
  };

  const hosts = [...byHost.values()];
  let next = 0;
  const worker = async () => {
    while (next < hosts.length) {
      const list = hosts[next++];
      for (let i = 0; i < list.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, perHostDelay));
        await probeOne(list[i]);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(maxHosts, hosts.length) }, worker));
  await stores.health.upsertMany(records);

  const finishedAtMs = Date.now();
  const failed = records.filter((r) => !isHealthy(r.lastProbe.status)).length;
  opts.telemetry?.emit({
    eventType: "roster.probe_run",
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    total: summary.total,
    ok: summary.ok + summary.notModified,
    failed,
    changed: summary.changed
  });

  return {
    startedAt: new Date(startedAtMs).toISOString(),
    finishedAt: new Date(finishedAtMs).toISOString(),
    durationMs: finishedAtMs - startedAtMs,
    records,
    texts,
    summary
  };
}

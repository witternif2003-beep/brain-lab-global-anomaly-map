import { isHealthy } from "./source-health";
import type { SourceHealthRecord } from "./types";

export type ReliabilityBand = "healthy" | "degraded" | "failing" | "unknown";

export interface ReliabilityScore {
  url: string;
  samples: number;
  okCount: number;
  failCount: number;
  /** okCount / samples over the stored window; null with no samples */
  uptime: number | null;
  medianLatencyMs: number | null;
  consecutiveFailures: number;
  lastOkAt?: string;
  band: ReliabilityBand;
  reason: string;
}

function median(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

/** Score derived only from the probes actually observed for this URL. */
export function scoreRecord(r: SourceHealthRecord | undefined, url: string): ReliabilityScore {
  if (!r || r.recentProbes.length === 0) {
    return { url, samples: 0, okCount: 0, failCount: 0, uptime: null, medianLatencyMs: null, consecutiveFailures: 0, band: "unknown", reason: "never probed" };
  }
  const samples = r.recentProbes.length;
  const okProbes = r.recentProbes.filter((p) => isHealthy(p.status));
  const okCount = okProbes.length;
  const uptime = okCount / samples;
  const last = r.lastProbe.status;
  const permanent = last === "dns-error" || (last === "http-error" && (r.lastProbe.httpStatus === 404 || r.lastProbe.httpStatus === 410));

  let band: ReliabilityBand;
  let reason: string;
  if (r.consecutiveFailures === 0 && uptime >= 0.9) {
    band = "healthy";
    reason = `${okCount}/${samples} probes ok`;
  } else if (permanent || r.consecutiveFailures >= 3 || (samples >= 2 && uptime < 0.5)) {
    band = "failing";
    reason = permanent ? `last probe ${last}${r.lastProbe.httpStatus ? " " + r.lastProbe.httpStatus : ""}` : `${r.consecutiveFailures} consecutive failures, ${okCount}/${samples} ok`;
  } else {
    band = "degraded";
    reason = r.consecutiveFailures > 0 ? `last probe ${last}, ${okCount}/${samples} ok` : `${okCount}/${samples} probes ok`;
  }

  return {
    url,
    samples,
    okCount,
    failCount: samples - okCount,
    uptime,
    medianLatencyMs: median(okProbes.map((p) => p.latencyMs)),
    consecutiveFailures: r.consecutiveFailures,
    lastOkAt: r.lastOkAt,
    band,
    reason
  };
}

export function computeReliability(records: SourceHealthRecord[]): ReliabilityScore[] {
  return records.map((r) => scoreRecord(r, r.url));
}

export type ProbeStatus =
  | "ok"
  | "not-modified"
  | "blocked"
  | "http-error"
  | "dns-error"
  | "tls-error"
  | "timeout"
  | "network-error"
  | "too-large";

export interface SourceProbe {
  url: string;
  status: ProbeStatus;
  probedAt: string;
  latencyMs: number;
  attempts: number;
  httpStatus?: number;
  finalUrl?: string;
  contentType?: string;
  byteLength?: number;
  /** SHA-256 of the normalized page text */
  fingerprint?: string;
  title?: string;
  error?: string;
  etag?: string;
  lastModified?: string;
}

export interface ProbeHistoryEntry {
  status: ProbeStatus;
  at: string;
  latencyMs: number;
}

export interface SourceHealthRecord {
  url: string;
  lastProbe: SourceProbe;
  consecutiveFailures: number;
  lastOkAt?: string;
  /** Fingerprint from the most recent probe that read the page */
  lastFingerprint?: string;
  previousFingerprint?: string;
  fingerprintChangedAt?: string;
  recentProbes: ProbeHistoryEntry[];
}

export interface ElectionOffice {
  code: string;
  name: string;
  type: "state" | "district" | "territory";
  /** Official election-office site as listed by the directory source */
  url: string;
  /** Strings that identify the jurisdiction on its own office site */
  aliases: string[];
}

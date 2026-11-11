import { extractTitle, fingerprintPage } from "./page-fingerprint";
import { getPolicyFor, hostOf } from "./source-probe-policy";
import type { ProbeHistoryEntry, ProbeStatus, SourceHealthRecord, SourceProbe } from "./types";

export const DEFAULT_MAX_BYTES = 5 * 1024 * 1024;
export const HISTORY_DEPTH = 20;

const TRANSIENT_HTTP = new Set([408, 425, 429, 500, 502, 503, 504]);
const TRANSIENT_STATUS = new Set<ProbeStatus>(["timeout", "network-error"]);
const BLOCK_HTTP = new Set([401, 403, 429]);
const BOT_WALL_HOSTS = ["perfdrive.com", "captcha", "challenges.cloudflare.com"];
const BOT_WALL_TITLES = [/^just a moment/i, /attention required/i, /^access denied/i, /request rejected/i, /bot (check|verification)/i];
const TLS_CODES = /CERT|SSL|TLS|UNABLE_TO_VERIFY|SELF_SIGNED|DEPTH_ZERO/i;

export interface ProbeOptions {
  timeoutMs?: number;
  maxBytes?: number;
  maxRetries?: number;
  etag?: string;
  lastModified?: string;
  fetchImpl?: typeof fetch;
}

export interface ProbeResult {
  probe: SourceProbe;
  /** Normalized visible text; only set when the body was read successfully */
  normalized?: string;
}

export function isHealthy(status: ProbeStatus): boolean {
  return status === "ok" || status === "not-modified";
}

function errorCode(err: unknown): string {
  if (err instanceof Error) {
    const cause = (err as Error & { cause?: unknown }).cause;
    if (cause instanceof Error) {
      const code = (cause as Error & { code?: unknown }).code;
      return `${typeof code === "string" ? code + " " : ""}${cause.message}`;
    }
    return `${err.name} ${err.message}`;
  }
  return String(err);
}

export function classifyFetchError(err: unknown): { status: ProbeStatus; error: string } {
  const msg = errorCode(err);
  if (/TimeoutError|AbortError|aborted|timed? ?out/i.test(msg)) return { status: "timeout", error: msg };
  if (/ENOTFOUND|EAI_AGAIN|getaddrinfo/i.test(msg)) return { status: "dns-error", error: msg };
  if (TLS_CODES.test(msg)) return { status: "tls-error", error: msg };
  return { status: "network-error", error: msg };
}

async function readCapped(res: Response, maxBytes: number): Promise<{ text: string; bytes: number; truncated: boolean }> {
  if (!res.body) return { text: "", bytes: 0, truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > maxBytes) {
      await reader.cancel().catch(() => undefined);
      return { text: "", bytes, truncated: true };
    }
    chunks.push(value);
  }
  return { text: new TextDecoder("utf-8").decode(Buffer.concat(chunks)), bytes, truncated: false };
}

function looksLikeBotWall(finalUrl: string, title: string | undefined): boolean {
  const host = hostOf(finalUrl);
  if (BOT_WALL_HOSTS.some((h) => host.includes(h))) return true;
  return !!title && BOT_WALL_TITLES.some((re) => re.test(title));
}

async function singleProbe(url: string, o: Required<Pick<ProbeOptions, "timeoutMs" | "maxBytes">> & ProbeOptions, attempt: number): Promise<ProbeResult> {
  const policy = getPolicyFor(url);
  const start = Date.now();
  const base = { url, probedAt: new Date(start).toISOString(), attempts: attempt };
  const headers: Record<string, string> = {
    "user-agent": policy.userAgent,
    accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.5",
    "accept-language": "en-US,en;q=0.8"
  };
  if (o.etag) headers["if-none-match"] = o.etag;
  if (o.lastModified) headers["if-modified-since"] = o.lastModified;

  const doFetch = o.fetchImpl ?? fetch;
  let res: Response;
  try {
    res = await doFetch(url, { headers, redirect: "follow", signal: AbortSignal.timeout(o.timeoutMs), cache: "no-store" });
  } catch (err) {
    const { status, error } = classifyFetchError(err);
    return { probe: { ...base, status, error, latencyMs: Date.now() - start } };
  }

  const meta = {
    ...base,
    httpStatus: res.status,
    finalUrl: res.url || url,
    contentType: res.headers.get("content-type") ?? undefined,
    etag: res.headers.get("etag") ?? undefined,
    lastModified: res.headers.get("last-modified") ?? undefined
  };

  if (res.status === 304) {
    return { probe: { ...meta, status: "not-modified", latencyMs: Date.now() - start } };
  }

  let body: { text: string; bytes: number; truncated: boolean };
  try {
    body = await readCapped(res, o.maxBytes);
  } catch (err) {
    const { status, error } = classifyFetchError(err);
    return { probe: { ...meta, status, error, latencyMs: Date.now() - start } };
  }
  const latencyMs = Date.now() - start;

  if (body.truncated) {
    return { probe: { ...meta, status: "too-large", byteLength: body.bytes, latencyMs, error: `body exceeds ${o.maxBytes} bytes` } };
  }

  const title = extractTitle(body.text);
  const botWall = looksLikeBotWall(meta.finalUrl, title);
  if (BLOCK_HTTP.has(res.status) || botWall) {
    return {
      probe: {
        ...meta,
        status: "blocked",
        title,
        byteLength: body.bytes,
        latencyMs,
        error: botWall ? `bot-management wall at ${hostOf(meta.finalUrl)}` : `HTTP ${res.status} ${res.statusText}`.trim()
      }
    };
  }
  if (!res.ok) {
    return { probe: { ...meta, status: "http-error", title, byteLength: body.bytes, latencyMs, error: `HTTP ${res.status} ${res.statusText}`.trim() } };
  }

  const { normalized, sha256 } = fingerprintPage(body.text);
  return {
    probe: { ...meta, status: "ok", title, byteLength: body.bytes, fingerprint: sha256, latencyMs },
    normalized
  };
}

/** Fetch one source URL with the host's retry policy. Never throws. */
export async function probeSource(url: string, opts: ProbeOptions = {}): Promise<ProbeResult> {
  const policy = getPolicyFor(url);
  const timeoutMs = opts.timeoutMs ?? policy.timeoutMs;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const maxRetries = opts.maxRetries ?? policy.maxRetries;

  let result: ProbeResult | undefined;
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    result = await singleProbe(url, { ...opts, timeoutMs, maxBytes }, attempt);
    const p = result.probe;
    const retryable =
      TRANSIENT_STATUS.has(p.status) ||
      (p.status === "http-error" && TRANSIENT_HTTP.has(p.httpStatus ?? 0)) ||
      (p.status === "blocked" && policy.retryOn403 && p.httpStatus === 403);
    if (!retryable || attempt > maxRetries) break;
    await new Promise((r) => setTimeout(r, policy.backoffMs * 2 ** (attempt - 1)));
  }
  return result as ProbeResult;
}

/** Fold a probe into the stored record for that URL. */
export function applyProbe(prior: SourceHealthRecord | undefined, probe: SourceProbe): SourceHealthRecord {
  const ok = isHealthy(probe.status);
  const entry: ProbeHistoryEntry = { status: probe.status, at: probe.probedAt, latencyMs: probe.latencyMs };
  const recentProbes = [...(prior?.recentProbes ?? []), entry].slice(-HISTORY_DEPTH);

  const lastProbe: SourceProbe =
    probe.status === "not-modified" && prior?.lastFingerprint
      ? { ...probe, fingerprint: prior.lastFingerprint, title: probe.title ?? prior.lastProbe.title }
      : probe;

  const priorFp = prior?.lastFingerprint;
  const changed = !!priorFp && !!lastProbe.fingerprint && priorFp !== lastProbe.fingerprint;

  return {
    url: probe.url,
    lastProbe,
    consecutiveFailures: ok ? 0 : (prior?.consecutiveFailures ?? 0) + 1,
    lastOkAt: ok ? probe.probedAt : prior?.lastOkAt,
    lastFingerprint: lastProbe.fingerprint ?? priorFp,
    previousFingerprint: changed ? priorFp : prior?.previousFingerprint,
    fingerprintChangedAt: changed ? probe.probedAt : prior?.fingerprintChangedAt,
    recentProbes
  };
}

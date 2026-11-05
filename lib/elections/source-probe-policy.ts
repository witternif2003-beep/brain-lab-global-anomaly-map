export interface HostPolicy {
  userAgent: string;
  timeoutMs: number;
  maxRetries: number;
  backoffMs: number;
  retryOn403: boolean;
}

export const MONITOR_USER_AGENT =
  "Mozilla/5.0 (compatible; brain-lab-election-source-monitor/1.0; +https://brain-lab-six.vercel.app/election-sources)";

const DEFAULT_POLICY: HostPolicy = {
  userAgent: MONITOR_USER_AGENT,
  timeoutMs: 15_000,
  maxRetries: 1,
  backoffMs: 750,
  retryOn403: false
};

/**
 * Per-host overrides. Only add a host here after a probe run shows the
 * default policy failing for it.
 */
const POLICIES: Record<string, Partial<HostPolicy>> = {
  "www.michigan.gov": { timeoutMs: 25_000 },
  "www.dos.pa.gov": { timeoutMs: 25_000 },
  "www.nm.gov": { timeoutMs: 25_000 }
};

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

export function getPolicyFor(url: string): HostPolicy {
  return { ...DEFAULT_POLICY, ...(POLICIES[hostOf(url)] ?? {}) };
}

export function listPolicies(): Array<{ hostname: string; policy: HostPolicy }> {
  return Object.keys(POLICIES).map((hostname) => ({ hostname, policy: { ...DEFAULT_POLICY, ...POLICIES[hostname] } }));
}

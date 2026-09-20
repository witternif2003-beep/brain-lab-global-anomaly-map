import { createHash } from "crypto";

export type ManifestState = 'candidate' | 'validating' | 'active' | 'stale' | 'deprecated' | 'reject';
export type FeedType = 'json_api' | 'csv' | 'html_index' | 'data_json';
export type SourceTier = 'federal_statistical' | 'federal_other' | 'academic_nonprofit' | 'state_official' | 'third_party';
export type Cadence = 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';

export interface ManifestEntry {
  id: string;
  slug: string;
  name: string;
  url: string;
  feedType: FeedType;
  tier: SourceTier;
  license: string;
  cadence: Cadence;
  halfLifeHours: number;
  refreshWindowHours: number;
  discoveredBy: string;
  discoveryQuery?: string;
  firstSeen: string;
  lastProbed: string | null;
  lastOk: string | null;
  lastError: string | null;
  consecutiveFails: number;
  schemaFingerprint: string;
  payloadHash: string;
  etag: string | null;
  lastModified: string | null;
  state: ManifestState;
  stateChangedAt: string;
  // Corroboration and graph metrics
  corroborationsCount: number;
  admiraltyReliability: 'A' | 'B' | 'C' | 'D' | 'E';
  admiraltyCredibility: '1' | '2' | '3' | '4' | '5' | '6';
  admiraltyGrade: string; // e.g., "A1", "B4"
  freshnessScore: number; // 0 - 100% computed via exponential decay
  outboundCitations?: string[];
}

export interface ManifestTransition {
  id: string;
  manifestId: string;
  slug: string;
  fromState: ManifestState | null;
  toState: ManifestState;
  reason: string;
  ts: string;
}

export interface IngestQueueItem {
  id: string;
  sourceId: string;
  name: string;
  state: 'pending' | 'fetching' | 'parsing' | 'verifying' | 'accepted' | 'rejected';
  attemptedAt: string;
  payloadHash: string;
  rejectReason?: string;
  createdAt: string;
}

/**
 * Exponential decay freshness scoring:
 * freshness = 100 * (0.5 ** (ageHours / halfLifeHours))
 */
export function calculateFreshness(halfLifeHours: number, lastOkIso: string | null): number {
  if (!lastOkIso) return 0;
  const lastOkTime = new Date(lastOkIso).getTime();
  const now = Date.now();
  const ageHours = Math.max(0, (now - lastOkTime) / 3600000);
  const decay = Math.pow(0.5, ageHours / Math.max(1, halfLifeHours));
  return Math.min(100, Math.max(0, Math.round(decay * 1000) / 10));
}

/**
 * Dynamic Admiralty Grading Function:
 * Reliability based on Tier; Credibility starts at 4 and climbs to 1 with corroborations.
 */
export function calculateAdmiraltyGrade(tier: SourceTier, corroborations: number): {
  reliability: 'A' | 'B' | 'C' | 'D' | 'E';
  credibility: '1' | '2' | '3' | '4' | '5' | '6';
  grade: string;
} {
  const reliabilityMap: Record<SourceTier, 'A' | 'B' | 'C' | 'D' | 'E'> = {
    federal_statistical: 'A', // BLS, Census, BEA, EIA
    federal_other: 'B',       // USAspending, EPA ECHO
    academic_nonprofit: 'B',  // IODA, university mirrors
    state_official: 'B',      // GA General Assembly
    third_party: 'C',
  };

  const reliability = reliabilityMap[tier] || 'C';
  // Credibility starts low (*4) and climbs only with 2+ independent corroborations
  const credibility: '1' | '2' | '3' | '4' | '5' | '6' =
    corroborations >= 3 ? '1' :
    corroborations >= 2 ? '2' :
    corroborations === 1 ? '3' : '4';

  return {
    reliability,
    credibility,
    grade: `${reliability}${credibility}`,
  };
}

/**
 * Shape extraction and sha256 schema fingerprint generation for change & drift detection
 */
export function computeSchemaFingerprint(jsonContent: any): string {
  function extractShape(value: any, depth = 0): any {
    if (depth > 5) return '…';
    if (value === null) return 'null';
    if (Array.isArray(value)) {
      return value.length ? [extractShape(value[0], depth + 1)] : [];
    }
    if (typeof value === 'object') {
      const out: Record<string, any> = {};
      for (const k of Object.keys(value).sort()) {
        out[k] = extractShape(value[k], depth + 1);
      }
      return out;
    }
    return typeof value;
  }

  const shape = extractShape(jsonContent);
  return createHash('sha256').update(JSON.stringify(shape)).digest('hex').substring(0, 16);
}

/**
 * Cycle detection across directed citation graphs
 */
export function detectCircularCitations(documents: { url: string; citations: string[] }[]) {
  const adj = new Map<string, string[]>();
  documents.forEach(d => adj.set(d.url, d.citations || []));

  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: string[][] = [];

  function dfs(curr: string, path: string[]) {
    visited.add(curr);
    recursionStack.add(curr);
    path.push(curr);

    const neighbors = adj.get(curr) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor, [...path]);
      } else if (recursionStack.has(neighbor)) {
        // Detected a cycle
        const cycleStartIndex = path.indexOf(neighbor);
        if (cycleStartIndex !== -1) {
          cycles.push(path.slice(cycleStartIndex));
        }
      }
    }

    recursionStack.delete(curr);
  }

  documents.forEach(d => {
    if (!visited.has(d.url)) {
      dfs(d.url, []);
    }
  });

  const involvedNodes = new Set(cycles.flat());
  const risk = documents.length > 0 ? +(involvedNodes.size / documents.length).toFixed(4) : 0;

  return {
    circularRisk: risk,
    cycleCount: cycles.length,
    cycles,
  };
}

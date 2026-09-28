/**
 * Federal telemetry bindings — types.
 *
 * HONESTY PROTOCOL: a binding is listed as LIVE only after its endpoint
 * returned HTTP 200 + parseable JSON in a verification probe. Bindings that
 * are sandbox-blocked (403 from the research network) are flagged
 * `sandboxBlocked` and their cards report live runtime status (OK or the
 * real error) — never assumed data. Key/OAuth/restricted/dead endpoints
 * live in the static COVERAGE_BOARD with reasons, and are never fetched.
 */

export interface TelemetryField {
  k: string;
  v: string;
}

export interface BindingExtract {
  count: number | null;
  fields: TelemetryField[];
}

export type ExtractFn = (json: unknown) => BindingExtract;

export interface TelemetryBinding {
  /** Stable id, e.g. "TREASURY-DEBT". */
  id: string;
  /** Owning entity, e.g. "Dept. of the Treasury". */
  entity: string;
  /** Card label. Reference queries say so explicitly. */
  label: string;
  /** Exact verified request URL. */
  url: string;
  /** Human-facing source link. */
  sourceUrl: string;
  /** True when the research network got 403 but the endpoint is plausibly open. */
  sandboxBlocked?: boolean;
  /** Parse the live payload into count + display fields. Must never throw. */
  extract: ExtractFn;
}

export interface EntitySnapshot {
  id: string;
  entity: string;
  label: string;
  ok: boolean;
  http: number;
  latencyMs: number;
  count: number | null;
  fields: TelemetryField[];
  error: string | null;
  sourceUrl: string;
  sandboxBlocked: boolean;
}

export interface CoverageRow {
  entity: string;
  endpoint: string;
  status: "KEY-REQUIRED" | "OAUTH-NO-CREDS" | "NO-API" | "DEAD-HOST" | "NON-JSON" | "WAF-BLOCKED";
  reason: string;
}

export interface TelemetrySnapshot {
  retrievedAt: string;
  liveCount: number;
  errorCount: number;
  entities: EntitySnapshot[];
  coverage: CoverageRow[];
}

export type GovEntityType = "department" | "agency" | "board" | "commission" | "GSE";
export type AuthMethod = "none" | "api_key" | "oauth";
export type DataAvailability = "full" | "partial" | "limited" | "none";

export interface TelemetryBinding {
  endpoint: string;
  authMethod: AuthMethod;
  pollingIntervalSec: number;
  description: string;
}

export interface GovEntity {
  id: string;
  name: string;
  parentDept: string;
  type: GovEntityType;
  bookSource: string;
  dataAvailability?: DataAvailability;
  telemetrySources: TelemetryBinding[];
}

export type ProbeStatus = "live" | "http_error" | "network_error" | "api_key_pending" | "oauth_pending" | "unknown_entity";

export interface TelemetrySummary {
  format: "json" | "html" | "text" | "empty";
  title?: string;
  topLevelKeys?: string[];
  recordCount?: number;
  preview: string;
}

export interface TelemetryPacket {
  entityId: string;
  sourceEndpoint: string;
  authMethod: AuthMethod | "n/a";
  status: ProbeStatus;
  fetchedAt: string;
  latencyMs: number;
  httpStatus: number;
  contentType: string | null;
  bytes: number;
  cached: boolean;
  data: TelemetrySummary | null;
  error?: string;
  schemaVersion: string;
}

export interface EntityMeta {
  id: string;
  name: string;
  type: GovEntityType;
  parentDept: string;
  dataAvailability: DataAvailability;
  bindingCount: number;
  authMethods: AuthMethod[];
  bindings: TelemetryBinding[];
}

export interface HealthSummary {
  totalEntities: number;
  totalBindings: number;
  withLiveApi: number;
  withoutApi: number;
  oauthRequired: number;
  apiKeyRequired: number;
  noAuthRequired: number;
  byType: Record<GovEntityType, number>;
  missingEnv: string[];
}

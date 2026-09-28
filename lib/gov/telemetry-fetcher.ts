import type {
  EntityMeta,
  GovEntity,
  GovEntityType,
  HealthSummary,
  TelemetryBinding,
  TelemetryPacket,
  TelemetrySummary,
} from "./types";
import { GOV_ENTITIES, getGovEntity } from "./registry";

const SCHEMA_VERSION = "lucid1-gov-telemetry/1.0";
const REQUEST_TIMEOUT_MS = 8000;
const MAX_BODY_CHARS = 400_000;
const PREVIEW_CHARS = 1800;
const MIN_TTL_MS = 60_000;
const MAX_TTL_MS = 15 * 60_000;
const ERROR_TTL_MS = 60_000;

interface ApiKeySpec {
  env: string;
  queryParam?: string;
  header?: string;
  bearer?: boolean;
}

const API_KEY_SPECS: Array<{ match: RegExp; spec: ApiKeySpec }> = [
  { match: /^api\.usa\.gov\/crime\/fbi\/cde/, spec: { env: "FBI_CDE_KEY", queryParam: "API_KEY" } },
  { match: /^api\.census\.gov/, spec: { env: "CENSUS_API_KEY", queryParam: "key" } },
  { match: /^api\.eia\.gov/, spec: { env: "EIA_API_KEY", queryParam: "api_key" } },
  { match: /^quickstats\.nass\.usda\.gov/, spec: { env: "NASS_API_KEY", queryParam: "key" } },
  { match: /^apps\.bea\.gov/, spec: { env: "BEA_API_KEY", queryParam: "UserID" } },
  { match: /^api\.stlouisfed\.org/, spec: { env: "FRED_API_KEY", queryParam: "api_key" } },
  { match: /^www\.huduser\.gov/, spec: { env: "HUD_API_TOKEN", bearer: true } },
  { match: /^aqs\.epa\.gov/, spec: { env: "EPA_AQS_KEY", queryParam: "key" } },
  { match: /^api\.trade\.gov/, spec: { env: "TRADE_GOV_API_KEY", header: "subscription-key" } },
  { match: /^api\.sam\.gov/, spec: { env: "SAM_API_KEY", queryParam: "api_key" } },
];

const DEFAULT_API_KEY_SPEC: ApiKeySpec = { env: "DATA_GOV_API_KEY", queryParam: "api_key", header: "X-Api-Key" };

export function apiKeySpecFor(endpoint: string): ApiKeySpec {
  const hostPath = endpoint.replace(/^https?:\/\//, "");
  return API_KEY_SPECS.find((s) => s.match.test(hostPath))?.spec ?? DEFAULT_API_KEY_SPEC;
}

// ─── Registry ───────────────────────────────────────────────────

function activeBindings(entity: GovEntity): TelemetryBinding[] {
  return entity.telemetrySources.filter((b) => b.endpoint && b.pollingIntervalSec > 0);
}

export function listEntities(): GovEntity[] {
  return GOV_ENTITIES;
}

export function getEntity(id: string): GovEntity | undefined {
  return getGovEntity(id);
}

export function toEntityMeta(entity: GovEntity): EntityMeta {
  const bindings = activeBindings(entity);
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    parentDept: entity.parentDept,
    dataAvailability: entity.dataAvailability ?? (bindings.length ? "full" : "none"),
    bindingCount: bindings.length,
    authMethods: Array.from(new Set(bindings.map((b) => b.authMethod))),
    bindings,
  };
}

export function getHealthSummary(): HealthSummary {
  const byType: Record<GovEntityType, number> = { department: 0, agency: 0, board: 0, commission: 0, GSE: 0 };
  let totalBindings = 0;
  let withLiveApi = 0;
  let oauthRequired = 0;
  let apiKeyRequired = 0;
  let noAuthRequired = 0;
  const missingEnv = new Set<string>();

  for (const entity of GOV_ENTITIES) {
    byType[entity.type] += 1;
    const bindings = activeBindings(entity);
    if (bindings.length) withLiveApi += 1;
    for (const b of bindings) {
      totalBindings += 1;
      if (b.authMethod === "oauth") oauthRequired += 1;
      else if (b.authMethod === "api_key") {
        apiKeyRequired += 1;
        const { env } = apiKeySpecFor(b.endpoint);
        if (!process.env[env]) missingEnv.add(env);
      } else noAuthRequired += 1;
    }
  }

  return {
    totalEntities: GOV_ENTITIES.length,
    totalBindings,
    withLiveApi,
    withoutApi: GOV_ENTITIES.length - withLiveApi,
    oauthRequired,
    apiKeyRequired,
    noAuthRequired,
    byType,
    missingEnv: Array.from(missingEnv).sort(),
  };
}

// ─── Cache ──────────────────────────────────────────────────────

const cache = new Map<string, { packet: TelemetryPacket; expiresAt: number }>();

export function clearCache(): void {
  cache.clear();
}

export function cacheSize(): number {
  return cache.size;
}

// ─── Normalization ──────────────────────────────────────────────

function largestArrayLength(value: unknown, depth = 0): number | undefined {
  if (Array.isArray(value)) return value.length;
  if (depth > 2 || !value || typeof value !== "object") return undefined;
  let best: number | undefined;
  for (const v of Object.values(value as Record<string, unknown>)) {
    const n = largestArrayLength(v, depth + 1);
    if (n !== undefined && (best === undefined || n > best)) best = n;
  }
  return best;
}

function summarize(body: string, contentType: string | null): TelemetrySummary {
  const trimmed = body.trim();
  if (!trimmed) return { format: "empty", preview: "" };

  const looksJson = (contentType ?? "").includes("json") || /^[[{]/.test(trimmed);
  if (looksJson) {
    try {
      const parsed: unknown = JSON.parse(trimmed);
      const topLevelKeys =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? Object.keys(parsed as Record<string, unknown>).slice(0, 16)
          : undefined;
      return {
        format: "json",
        topLevelKeys,
        recordCount: largestArrayLength(parsed),
        preview: JSON.stringify(parsed, null, 2).slice(0, PREVIEW_CHARS),
      };
    } catch {
      // fall through to text/html handling
    }
  }

  if ((contentType ?? "").includes("html") || /^<!doctype html|^<html/i.test(trimmed)) {
    const title = trimmed.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.replace(/\s+/g, " ").trim();
    const text = trimmed
      .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return { format: "html", title, preview: text.slice(0, 600) };
  }

  return { format: "text", preview: trimmed.slice(0, PREVIEW_CHARS) };
}

function basePacket(entityId: string, binding: TelemetryBinding | null): TelemetryPacket {
  return {
    entityId,
    sourceEndpoint: binding?.endpoint ?? "",
    authMethod: binding?.authMethod ?? "n/a",
    status: "live",
    fetchedAt: new Date().toISOString(),
    latencyMs: 0,
    httpStatus: 0,
    contentType: null,
    bytes: 0,
    cached: false,
    data: null,
    schemaVersion: SCHEMA_VERSION,
  };
}

// ─── Probe ──────────────────────────────────────────────────────

export interface ProbeOptions {
  fresh?: boolean;
}

export async function probeBinding(
  entity: GovEntity,
  binding: TelemetryBinding,
  opts: ProbeOptions = {}
): Promise<TelemetryPacket> {
  const cacheKey = `${entity.id}::${binding.endpoint}`;
  const hit = cache.get(cacheKey);
  if (!opts.fresh && hit && hit.expiresAt > Date.now()) {
    return { ...hit.packet, cached: true };
  }

  const packet = basePacket(entity.id, binding);

  if (binding.authMethod === "oauth") {
    packet.status = "oauth_pending";
    packet.error = `OAuthPendingError: ${entity.id} requires an OAuth2 authorization flow with registered client credentials before telemetry can be retrieved.`;
    return packet;
  }

  const url = new URL(binding.endpoint);
  const headers: Record<string, string> = {
    Accept: "application/json, text/html;q=0.8, */*;q=0.5",
    "User-Agent": "LUCID-1-GovTelemetry/1.0 (+https://brain-lab-six.vercel.app)",
  };

  if (binding.authMethod === "api_key") {
    const spec = apiKeySpecFor(binding.endpoint);
    const key = process.env[spec.env];
    if (!key) {
      packet.status = "api_key_pending";
      packet.error = `MissingApiKeyError: set ${spec.env} to enable this binding.`;
      return packet;
    }
    if (spec.queryParam) url.searchParams.set(spec.queryParam, key);
    if (spec.header) headers[spec.header] = key;
    if (spec.bearer) headers.Authorization = `Bearer ${key}`;
  }

  const started = Date.now();
  try {
    const res = await fetch(url, {
      headers,
      redirect: "follow",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    const body = (await res.text()).slice(0, MAX_BODY_CHARS);
    packet.latencyMs = Date.now() - started;
    packet.httpStatus = res.status;
    packet.contentType = res.headers.get("content-type");
    packet.bytes = Number(res.headers.get("content-length")) || body.length;
    packet.data = summarize(body, packet.contentType);
    if (!res.ok) {
      packet.status = "http_error";
      packet.error = `HttpError: ${res.status} ${res.statusText}`.trim();
    }
  } catch (err) {
    packet.latencyMs = Date.now() - started;
    packet.status = "network_error";
    packet.error = `NetworkError: ${err instanceof Error ? err.message : String(err)}`;
  }

  const ttl = packet.status === "live"
    ? Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, binding.pollingIntervalSec * 1000))
    : ERROR_TTL_MS;
  cache.set(cacheKey, { packet, expiresAt: Date.now() + ttl });
  return packet;
}

export async function fetchEntityTelemetry(id: string, opts: ProbeOptions = {}): Promise<TelemetryPacket[]> {
  const entity = getEntity(id);
  if (!entity) {
    return [{ ...basePacket(id, null), status: "unknown_entity", error: `Unknown entity: ${id}` }];
  }
  return Promise.all(activeBindings(entity).map((b) => probeBinding(entity, b, opts)));
}

export async function fetchAllTelemetry(
  concurrency = 8,
  onPacket?: (packet: TelemetryPacket) => void,
  signal?: AbortSignal,
  entityFilter?: string[] | null
): Promise<Record<string, TelemetryPacket[]>> {
  const jobs: Array<[GovEntity, TelemetryBinding]> = [];
  for (const entity of GOV_ENTITIES) {
    if (entityFilter && !entityFilter.includes(entity.id)) continue;
    for (const b of activeBindings(entity)) jobs.push([entity, b]);
  }

  const out: Record<string, TelemetryPacket[]> = {};
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length && !signal?.aborted) {
      const [entity, binding] = jobs[cursor++];
      const packet = await probeBinding(entity, binding);
      (out[entity.id] ??= []).push(packet);
      onPacket?.(packet);
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, worker));
  return out;
}

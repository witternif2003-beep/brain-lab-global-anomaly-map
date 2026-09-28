/**
 * Federal telemetry fetcher — parallel live polling with per-source truth.
 * Every binding resolves to a snapshot: ok + data, or ok:false + the real
 * error (http code, timeout, parse failure). Nothing is ever synthesized.
 */

import type { EntitySnapshot, TelemetryBinding } from "./types";
import { GOV_BINDINGS } from "./registry";

const PER_SOURCE_TIMEOUT_MS = 12000;

async function fetchBinding(b: TelemetryBinding): Promise<EntitySnapshot> {
  const base = {
    id: b.id,
    entity: b.entity,
    label: b.label,
    sourceUrl: b.sourceUrl,
    sandboxBlocked: b.sandboxBlocked ?? false
  };
  const t0 = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), PER_SOURCE_TIMEOUT_MS);
  try {
    const res = await fetch(b.url, {
      signal: ctrl.signal,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "User-Agent": "brain-lab-gov-telemetry/1.0"
      }
    });
    const latencyMs = Date.now() - t0;
    if (!res.ok) {
      return { ...base, ok: false, http: res.status, latencyMs, count: null, fields: [], error: `HTTP ${res.status}` };
    }
    let json: unknown;
    try {
      json = (await res.json()) as unknown;
    } catch {
      return { ...base, ok: false, http: res.status, latencyMs, count: null, fields: [], error: "unparseable body (not JSON)" };
    }
    let count: number | null = null;
    let fields: EntitySnapshot["fields"] = [];
    try {
      const ex = b.extract(json);
      count = ex.count;
      fields = ex.fields;
    } catch (e) {
      return {
        ...base,
        ok: false,
        http: res.status,
        latencyMs,
        count: null,
        fields: [],
        error: `extractor failed: ${e instanceof Error ? e.message : "unknown"}`
      };
    }
    return { ...base, ok: true, http: res.status, latencyMs, count, fields, error: null };
  } catch (e) {
    return {
      ...base,
      ok: false,
      http: 0,
      latencyMs: Date.now() - t0,
      count: null,
      fields: [],
      error: e instanceof Error ? (e.name === "AbortError" ? "timeout 12s" : e.message) : "fetch failed"
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchAllTelemetry(): Promise<EntitySnapshot[]> {
  return Promise.all(GOV_BINDINGS.map(fetchBinding));
}

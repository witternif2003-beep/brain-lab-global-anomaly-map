import { NextResponse } from "next/server";
import { FEDERAL_SOURCES, type FederalProbe, type FederalSource } from "../../../../lib/gov/federal-sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UA = "brain-lab-global-anomaly-map (public-source telemetry probe; witternif2003@gmail.com)";
const TIMEOUT_MS = 8000;

async function probe(src: FederalSource): Promise<FederalProbe> {
  const started = performance.now();
  const probedAt = new Date().toISOString();
  const base = {
    id: src.id,
    entity: src.entity,
    parent: src.parent,
    branch: src.branch,
    domain: src.domain,
    endpoint: src.endpoint,
    docsUrl: src.docsUrl,
    probedAt,
  };
  try {
    const res = await fetch(src.endpoint, {
      headers: { "User-Agent": UA, Accept: "application/json, application/geo+json, */*" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
    const buf = await res.arrayBuffer();
    return {
      ...base,
      ok: res.ok,
      httpStatus: res.status,
      latencyMs: Math.round(performance.now() - started),
      contentType: res.headers.get("content-type"),
      bytes: buf.byteLength,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      ...base,
      ok: false,
      httpStatus: null,
      latencyMs: Math.round(performance.now() - started),
      contentType: null,
      bytes: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function GET() {
  const probes = await Promise.all(FEDERAL_SOURCES.map(probe));
  const reachable = probes.filter((p) => p.ok);
  const latencies = reachable.map((p) => p.latencyMs).sort((a, b) => a - b);
  const pct = (q: number) => (latencies.length ? latencies[Math.min(latencies.length - 1, Math.floor(q * latencies.length))] : null);

  const byDomain: Record<string, { total: number; reachable: number }> = {};
  for (const p of probes) {
    byDomain[p.domain] ??= { total: 0, reachable: 0 };
    byDomain[p.domain].total += 1;
    if (p.ok) byDomain[p.domain].reachable += 1;
  }

  return NextResponse.json(
    {
      probedAt: new Date().toISOString(),
      total: probes.length,
      reachable: reachable.length,
      availabilityPct: +((reachable.length / probes.length) * 100).toFixed(1),
      latency: { p50: pct(0.5), p90: pct(0.9), max: latencies.at(-1) ?? null },
      byDomain,
      probes,
      policy:
        "Each probe is a live HTTP request to a documented federal public endpoint; only status, latency, content-type and byte count are recorded. Unreachable or rate-limited endpoints are reported as such, never substituted.",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

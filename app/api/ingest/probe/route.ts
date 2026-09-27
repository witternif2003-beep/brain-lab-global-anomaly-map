import { NextResponse } from "next/server";
import { JURISDICTION_ADAPTERS } from "../../../../lib/adapters/jurisdictions";

export const dynamic = "force-dynamic";

/**
 * Phase-2 ingest probe — runtime portal-liveness check per jurisdiction.
 *
 * HONESTY PROTOCOL: this endpoint is the ONLY thing allowed to claim a portal
 * is reachable, and only on a live HTTP 200 with a parseable Socrata payload.
 * Reachable portals still serve 0 records until a dataset mapping exists.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").toUpperCase();
  const cfg = JURISDICTION_ADAPTERS[code];
  const checkedAt = new Date().toISOString();

  if (!cfg) {
    return NextResponse.json(
      { code, status: "UNKNOWN-JURISDICTION", reachable: false, records: 0, checkedAt },
      { status: 404 }
    );
  }
  if (cfg.corpus === "curated-local") {
    return NextResponse.json({
      code,
      status: "CURATED-CORPUS",
      reachable: true,
      records: 1000,
      checkedAt,
      note: "Local curated corpus. No portal probe needed."
    });
  }

  const base = cfg.openDataPortal.replace(/\/$/, "");
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    let res: Response;
    try {
      res = await fetch(`${base}/api/search/views.json?search=anomaly&limit=3`, {
        signal: ctrl.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "brain-lab-ingest-probe/1.0"
        },
        cache: "no-store"
      });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) {
      return NextResponse.json({
        code,
        portal: base,
        status: "PORTAL-ERROR",
        reachable: false,
        http: res.status,
        records: 0,
        checkedAt
      });
    }
    const data: unknown = await res.json().catch(() => null);
    const rec = (data ?? {}) as { count?: unknown; resultSetSize?: unknown; results?: unknown };
    const datasetsIndexed =
      typeof rec.count === "number"
        ? rec.count
        : typeof rec.resultSetSize === "number"
          ? rec.resultSetSize
          : Array.isArray(rec.results)
            ? rec.results.length
            : null;
    return NextResponse.json({
      code,
      portal: base,
      status: "PORTAL-REACHABLE-FEED-UNMAPPED",
      reachable: true,
      datasetsIndexed,
      records: 0,
      checkedAt,
      note: "Portal responds; no anomaly dataset mapped. 0 records served."
    });
  } catch (e) {
    return NextResponse.json({
      code,
      portal: base,
      status: "PORTAL-UNREACHABLE",
      reachable: false,
      reason: e instanceof Error ? e.message : "fetch failed",
      records: 0,
      checkedAt
    });
  }
}

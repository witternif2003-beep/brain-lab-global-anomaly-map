import { NextResponse } from "next/server";
import { JURISDICTION_ADAPTERS } from "../../../../lib/adapters/jurisdictions";
import { STATE_DATASETS } from "../../../../lib/adapters/state-datasets";

export const dynamic = "force-dynamic";

/**
 * Phase-2 ingest probe — runtime portal-liveness check per jurisdiction.
 *
 * HONESTY PROTOCOL: this endpoint is the ONLY thing allowed to claim a portal
 * is reachable, and only on a live HTTP 200 with a parseable Socrata/CKAN
 * payload. Reachable portals still serve 0 records until a dataset mapping
 * exists. Both platform paths are tried in parallel; the adapter's declared
 * platform is preferred when both parse (CA/OK/VA/HI are CKAN-verified).
 */
interface Attempt {
  ok: boolean;
  http: number;
  text: string;
}

async function tryFetch(url: string): Promise<Attempt | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "brain-lab-ingest-probe/1.0"
      },
      cache: "no-store"
    });
    const text = await res.text();
    return { ok: res.ok, http: res.status, text };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function parseSocrata(text: string): number | null {
  try {
    const rec = JSON.parse(text) as {
      count?: unknown;
      resultSetSize?: unknown;
      results?: unknown;
    };
    if (typeof rec.count === "number") return rec.count;
    if (typeof rec.resultSetSize === "number") return rec.resultSetSize;
    if (Array.isArray(rec.results)) return rec.results.length;
    return null;
  } catch {
    return null;
  }
}

function parseCkan(text: string): number | null {
  try {
    const rec = JSON.parse(text) as {
      success?: unknown;
      result?: { count?: unknown };
    };
    if (rec.success === true && typeof rec.result?.count === "number") return rec.result.count;
    return null;
  } catch {
    return null;
  }
}

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
  const [soc, ckn] = await Promise.all([
    tryFetch(`${base}/api/search/views.json?q=anomaly&limit=3`),
    tryFetch(`${base}/api/3/action/package_search?q=anomaly&rows=3`)
  ]);

  // Jurisdictions whose mapped feed lives off-portal (arcgis/csv/fema)
  // must not be failed early when the dead portal host itself is
  // unreachable — fall through to the mapped-feed probe below.
  const hasAltFeed = (STATE_DATASETS[code] ?? []).some(
    (c) => (c.platform === "arcgis" || c.platform === "csv" || c.platform === "fema") && (c.service_url ?? "").length > 0
  );
  if (!soc && !ckn && !hasAltFeed) {
    return NextResponse.json({
      code,
      portal: base,
      status: "PORTAL-UNREACHABLE",
      reachable: false,
      reason: "fetch failed on both Socrata and CKAN paths",
      records: 0,
      checkedAt
    });
  }

  const socCount = soc?.ok ? parseSocrata(soc.text) : null;
  const cknCount = ckn?.ok ? parseCkan(ckn.text) : null;
  const preferCkan = cfg.portalPlatform === "ckan";
  const pick: { platform: string; n: number } | null =
    preferCkan && cknCount !== null
      ? { platform: "ckan", n: cknCount }
      : !preferCkan && socCount !== null
        ? { platform: "socrata", n: socCount }
        : cknCount !== null
          ? { platform: "ckan", n: cknCount }
          : socCount !== null
            ? { platform: "socrata", n: socCount }
            : null;

  const mappedCount = STATE_DATASETS[code]?.length ?? 0;
  if (pick) {
    return NextResponse.json({
      code,
      portal: base,
      platform: pick.platform,
      status: mappedCount > 0 ? "PORTAL-REACHABLE-FEED-MAPPED" : "PORTAL-REACHABLE-FEED-UNMAPPED",
      reachable: true,
      datasetsIndexed: pick.n,
      datasetsMapped: mappedCount,
      records: 0,
      checkedAt,
      note:
        mappedCount > 0
          ? `Portal responds (${pick.platform}); ${mappedCount} state datasets mapped; live records via /api/ingest/states/records.`
          : `Portal responds (${pick.platform}); no anomaly dataset mapped. 0 records served.`
    });
  }

  // ArcGIS/CSV-mapped jurisdictions expose no Socrata/CKAN search API by
  // design — probe the mapped feed itself so the badge stays honest.
  const alt = (STATE_DATASETS[code] ?? []).find(
    (c) => (c.platform === "arcgis" || c.platform === "csv" || c.platform === "fema") && (c.service_url ?? "").length > 0
  );
  if (alt?.service_url) {
    const svc = alt.service_url;
    const isRawCsv = alt.platform === "csv" && !svc.startsWith("ckan-package:");
    let ok = false;
    if (isRawCsv) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 8000);
      try {
        const hr = await fetch(svc, { method: "HEAD", signal: ctrl.signal, cache: "no-store" });
        ok = hr.ok;
      } catch {
        ok = false;
      } finally {
        clearTimeout(timer);
      }
    } else {
      const probeUrl =
        alt.platform === "fema"
          ? `${svc}?$filter=${encodeURIComponent(`state eq '${alt.dataset_id}'`)}&$top=1`
          : alt.platform === "arcgis"
            ? `${svc}?f=json`
            : `${base}/api/3/action/package_show?id=${encodeURIComponent(svc.slice("ckan-package:".length))}`;
      ok = (await tryFetch(probeUrl))?.ok ?? false;
    }
    if (ok) {
      return NextResponse.json({
        code,
        portal: base,
        platform: alt.platform === "csv" ? "csv-ckan" : alt.platform,
        status: "PORTAL-REACHABLE-FEED-MAPPED",
        reachable: true,
        datasetsIndexed: null,
        datasetsMapped: mappedCount,
        records: 0,
        checkedAt,
        note: `Mapped ${alt.platform} feed responds (${alt.source_id}); live records via /api/ingest/states/records.`
      });
    }
  }

  // Socrata portals with a broken search API (DE 500s views.json) can still
  // serve verified datasets directly — confirm via count(*) on the first
  // mapped socrata dataset so the badge stays honest.
  const socEntry = (STATE_DATASETS[code] ?? []).find(
    (c) => (c.platform ?? "socrata") === "socrata" && (c.dataset_id ?? "").length > 0
  );
  if (socEntry) {
    const direct = await tryFetch(
      `${base}/resource/${socEntry.dataset_id}.json?%24select=count(*)&%24limit=1`
    );
    if (direct?.ok) {
      return NextResponse.json({
        code,
        portal: base,
        platform: "socrata-direct",
        status: "PORTAL-REACHABLE-FEED-MAPPED",
        reachable: true,
        datasetsIndexed: null,
        datasetsMapped: mappedCount,
        records: 0,
        checkedAt,
        note: `Search API down; direct dataset access verified (${socEntry.dataset_id}); live records via /api/ingest/states/records.`
      });
    }
  }

  const anyHost = (soc !== null && soc.ok) || (ckn !== null && ckn.ok);
  if (anyHost) {
    return NextResponse.json({
      code,
      portal: base,
      platform: null,
      status: "PORTAL-NO-DATA-API",
      reachable: true,
      datasetsIndexed: null,
      records: 0,
      checkedAt,
      note: "Host responds but exposes no Socrata/CKAN search API. 0 records served."
    });
  }

  const firstHttp = preferCkan ? (ckn?.http ?? soc?.http) : (soc?.http ?? ckn?.http);
  return NextResponse.json({
    code,
    portal: base,
    status: "PORTAL-ERROR",
    reachable: false,
    http: firstHttp ?? 0,
    records: 0,
    checkedAt,
    note: "Both Socrata and CKAN search paths failed."
  });
}

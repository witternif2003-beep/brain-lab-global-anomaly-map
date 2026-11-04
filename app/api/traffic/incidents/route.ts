import { NextResponse } from "next/server";
import {
  GA_INCIDENT_BBOX, INCIDENT_CACHE_S, TOMTOM_INCIDENT_DETAILS_DOCS_URL, bboxAreaKm2, clampBbox, incidentDetailsUrl, mergeIncidents, parseBbox, subdivideBbox,
} from "@/lib/ga-traffic-incidents/incidents";

export const dynamic = "force-dynamic";

/**
 * Georgia traffic incidents (TomTom Incident Details v5) as one GeoJSON FeatureCollection. The bbox (default: all of
 * Georgia, clamped to it) is split into cells under TomTom's 10,000 km² limit and fetched in parallel. The key stays server-side.
 */
export async function GET(req: Request) {
  const key = process.env.TOMTOM_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "traffic incidents not configured (TOMTOM_API_KEY unset)" }, { status: 503 });
  const q = new URL(req.url).searchParams.get("bbox");
  const asked = q ? parseBbox(q) : GA_INCIDENT_BBOX;
  if (!asked) return NextResponse.json({ error: "bbox must be minLon,minLat,maxLon,maxLat" }, { status: 400 });
  const bbox = clampBbox(asked);
  if (!bbox) return NextResponse.json({ error: "bbox does not overlap Georgia" }, { status: 400 });
  const cells = subdivideBbox(bbox);
  const settled = await Promise.allSettled(
    cells.map(async (c) => {
      const r = await fetch(incidentDetailsUrl(c, key), { signal: AbortSignal.timeout(10_000), cache: "no-store" });
      if (!r.ok) throw new Error(`TomTom HTTP ${r.status}`);
      return r.json();
    }),
  );
  const ok = settled.flatMap((s) => (s.status === "fulfilled" ? [s.value] : []));
  const failedCells = settled.flatMap((s, i) => (s.status === "rejected" ? [{ bbox: cells[i], error: s.reason instanceof Error && s.reason.message.startsWith("TomTom HTTP") ? s.reason.message : "upstream unreachable" }] : []));
  if (!ok.length) return NextResponse.json({ error: "all TomTom incident requests failed", failedCells }, { status: 502 });
  const fc = mergeIncidents(ok);
  return NextResponse.json(
    {
      ...fc,
      metadata: {
        provider: "TomTom Traffic Incident Details v5",
        sourceUrl: TOMTOM_INCIDENT_DETAILS_DOCS_URL,
        attribution: "Traffic incidents © TomTom",
        bbox,
        cells: cells.length,
        maxCellKm2: Math.round(Math.max(...cells.map(bboxAreaKm2))),
        failedCells,
        count: fc.features.length,
        generatedAt: new Date().toISOString(),
      },
    },
    { headers: { "Cache-Control": `public, max-age=60, s-maxage=${INCIDENT_CACHE_S}, stale-while-revalidate=${INCIDENT_CACHE_S}` } },
  );
}

import { SEGMENT_CACHE_S, TOMTOM_SEGMENT_DOCS_URL, parsePoint, summarizeSegment, tomtomSegmentUrl } from "@/lib/ga-traffic-flow/segment";

export const dynamic = "force-dynamic";

/** Measured current vs free-flow speed for the TomTom road segment nearest ?point=lat,lon; the key stays server-side and is never echoed. */
export async function GET(req: Request) {
  const pt = parsePoint(new URL(req.url).searchParams.get("point"));
  if (!pt) return Response.json({ error: "point must be lat,lon inside Georgia" }, { status: 400 });
  const key = process.env.TOMTOM_API_KEY?.trim();
  if (!key) return Response.json({ error: "TomTom not configured (set TOMTOM_API_KEY)" }, { status: 404 });
  let r: Response;
  try {
    r = await fetch(tomtomSegmentUrl(pt.lat, pt.lon, key), { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  } catch {
    return Response.json({ error: "TomTom unreachable" }, { status: 502 });
  }
  if (!r.ok) return Response.json({ error: `TomTom HTTP ${r.status}` }, { status: 502 });
  const s = summarizeSegment(await r.json().catch(() => null));
  if (!s) return Response.json({ error: "TomTom returned no flow segment for this point" }, { status: 502 });
  return Response.json(
    { ...s, point: pt, unit: "mph", source: "TomTom Traffic Flow Segment Data", sourceUrl: TOMTOM_SEGMENT_DOCS_URL, retrievedAt: new Date().toISOString() },
    { headers: { "Cache-Control": `public, max-age=${SEGMENT_CACHE_S}, s-maxage=${SEGMENT_CACHE_S}` } },
  );
}

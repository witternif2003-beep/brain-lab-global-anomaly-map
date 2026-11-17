import { NextResponse } from "next/server";
import { TOMTOM_ROUTING_DOCS_URL, calculateRouteUrl, parseLngLat, routeToFeature } from "@/lib/ga-traffic-route/route";

export const dynamic = "force-dynamic";

/** Fastest car route between `from` and `to` (lon,lat, Georgia ±1°) using TomTom Calculate Route with live traffic. Key stays server-side. */
export async function GET(req: Request) {
  const key = process.env.TOMTOM_API_KEY?.trim();
  if (!key) return NextResponse.json({ error: "routing not configured (TOMTOM_API_KEY unset)" }, { status: 503 });
  const sp = new URL(req.url).searchParams;
  const from = parseLngLat(sp.get("from"));
  const to = parseLngLat(sp.get("to"));
  if (!from || !to) return NextResponse.json({ error: "from and to must be lon,lat inside Georgia (±1°)" }, { status: 400 });
  let upstream: Response;
  try {
    upstream = await fetch(calculateRouteUrl(from, to, key), { signal: AbortSignal.timeout(15_000), cache: "no-store" });
  } catch {
    return NextResponse.json({ error: "TomTom routing unreachable" }, { status: 502 });
  }
  if (!upstream.ok) return NextResponse.json({ error: `TomTom HTTP ${upstream.status}${upstream.status === 400 ? " (no route between these points)" : ""}` }, { status: upstream.status === 400 ? 422 : 502 });
  const feature = routeToFeature(await upstream.json());
  if (!feature) return NextResponse.json({ error: "TomTom returned no route" }, { status: 422 });
  return NextResponse.json(
    { ...feature, metadata: { provider: "TomTom Calculate Route (traffic=true, fastest, car)", sourceUrl: TOMTOM_ROUTING_DOCS_URL, attribution: "Routing © TomTom", generatedAt: new Date().toISOString() } },
    { headers: { "Cache-Control": "no-store" } },
  );
}

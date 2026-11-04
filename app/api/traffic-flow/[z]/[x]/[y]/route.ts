import { FLOW_TILE_CACHE_S, tomtomFlowTileUrl, validTile } from "@/lib/ga-traffic-flow/flow";

export const dynamic = "force-dynamic";

/** Proxies one TomTom vector flow tile so the API key stays server-side. */
export async function GET(_req: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const key = process.env.TOMTOM_API_KEY?.trim();
  if (!key) return new Response("traffic flow not configured", { status: 404 });
  const { z, x, y } = await params;
  const [zi, xi, yi] = [z, x, y.replace(/\.pbf$/, "")].map(Number);
  if (!validTile(zi, xi, yi)) return new Response("bad tile", { status: 400 });
  let upstream: Response;
  try {
    upstream = await fetch(tomtomFlowTileUrl(zi, xi, yi, key), { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  } catch {
    return new Response("upstream unreachable", { status: 502 });
  }
  if (!upstream.ok) return new Response(null, { status: upstream.status === 404 ? 204 : upstream.status });
  return new Response(await upstream.arrayBuffer(), {
    headers: {
      "Content-Type": "application/vnd.mapbox-vector-tile",
      "Cache-Control": `public, max-age=${FLOW_TILE_CACHE_S}, s-maxage=${FLOW_TILE_CACHE_S}, stale-while-revalidate=${FLOW_TILE_CACHE_S}`,
    },
  });
}

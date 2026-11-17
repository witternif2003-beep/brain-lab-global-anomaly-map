import { validTile } from './ga-traffic-flow/flow';

type TileParams = Promise<{ z: string; x: string; y: string }>;

/** Proxies one TomTom vector tile so the API key stays server-side; errors never echo the upstream URL. */
export async function proxyTomTomTile(params: TileParams, url: (z: number, x: number, y: number, key: string) => string, cacheS: number): Promise<Response> {
  const key = process.env.TOMTOM_API_KEY?.trim();
  if (!key) return new Response("TomTom not configured", { status: 404 });
  const { z, x, y } = await params;
  const [zi, xi, yi] = [z, x, y.replace(/\.pbf$/, "")].map(Number);
  if (!validTile(zi, xi, yi)) return new Response("bad tile", { status: 400 });
  let upstream: Response;
  try {
    upstream = await fetch(url(zi, xi, yi, key), { signal: AbortSignal.timeout(10_000), cache: "no-store" });
  } catch {
    return new Response("upstream unreachable", { status: 502 });
  }
  if (!upstream.ok) return new Response(null, { status: upstream.status === 404 ? 204 : upstream.status });
  return new Response(await upstream.arrayBuffer(), {
    headers: {
      "Content-Type": "application/vnd.mapbox-vector-tile",
      "Cache-Control": `public, max-age=${cacheS}, s-maxage=${cacheS}, stale-while-revalidate=${cacheS}`,
    },
  });
}

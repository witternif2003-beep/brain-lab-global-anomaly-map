import { FLOW_TILE_CACHE_S, tomtomFlowTileUrl } from "@/lib/ga-traffic-flow/flow";
import { proxyTomTomTile } from "@/lib/ga-tomtom-tile-proxy";

export const dynamic = "force-dynamic";

/** Proxies one TomTom vector flow tile so the API key stays server-side. */
export function GET(_req: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  return proxyTomTomTile(params, tomtomFlowTileUrl, FLOW_TILE_CACHE_S);
}

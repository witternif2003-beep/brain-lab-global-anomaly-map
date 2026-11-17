import { INCIDENT_CACHE_S, tomtomIncidentTileUrl } from "@/lib/ga-traffic-incidents/incidents";
import { proxyTomTomTile } from "@/lib/ga-tomtom-tile-proxy";

export const dynamic = "force-dynamic";

/** Proxies one TomTom vector incident tile (statewide at any zoom, no bbox limit) so the API key stays server-side. */
export function GET(_req: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  return proxyTomTomTile(params, tomtomIncidentTileUrl, INCIDENT_CACHE_S);
}

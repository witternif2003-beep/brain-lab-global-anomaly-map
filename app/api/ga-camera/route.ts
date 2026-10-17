import { createHash } from "node:crypto";
import type { NextRequest } from "next/server";
import { classifySnapshot } from "../../../lib/ga-live-markers/snapshot";

export const dynamic = "force-dynamic";

/**
 * Fetches one 511GA camera picture and returns it only if it is a real frame.
 * 511ga.org sends two Access-Control-Allow-Origin headers, so browsers cannot read the bytes directly to check them.
 */
export async function GET(req: NextRequest) {
  const view = req.nextUrl.searchParams.get("view") ?? "";
  if (!/^\d{1,9}$/.test(view)) return Response.json({ error: "view must be a 511GA camera view id" }, { status: 400 });
  const checkedAt = new Date().toISOString();
  const headers = { "cache-control": "no-store", "x-camera-checked-at": checkedAt };
  try {
    const r = await fetch(`https://511ga.org/map/Cctv/${view}`, {
      cache: "no-store",
      headers: { "user-agent": "brain-lab-global-anomaly-map (public GDOT camera check)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!r.ok) return Response.json({ state: "offline", reason: `511GA HTTP ${r.status}`, checkedAt }, { headers: { ...headers, "x-camera-state": "offline" } });
    const buf = Buffer.from(await r.arrayBuffer());
    const type = r.headers.get("content-type");
    const state = classifySnapshot(type, buf.length, createHash("sha256").update(buf).digest("hex"));
    if (state !== "live") return Response.json({ state, reason: "511GA is serving its no-live-feed placeholder", checkedAt }, { headers: { ...headers, "x-camera-state": state } });
    return new Response(buf, { headers: { ...headers, "content-type": type ?? "image/png", "x-camera-state": "live" } });
  } catch (err) {
    return Response.json({ state: "offline", reason: String(err), checkedAt }, { headers: { ...headers, "x-camera-state": "offline" } });
  }
}

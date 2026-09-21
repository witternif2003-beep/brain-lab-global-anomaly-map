import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  if (!path || path.length < 3) {
    return new NextResponse("Invalid tile path", { status: 400 });
  }

  // Format: /api/tiles/{z}/{x}/{y} (or /api/tiles/{z}/{x}/{y}.png)
  const z = path[0];
  const x = path[1];
  let y = path[2];
  if (y.endsWith(".png")) {
    y = y.replace(".png", "");
  }

  // Use reliable OpenStreetMap Carto / OSM keyless tiles via same-origin edge proxy
  // Servers handle upstream fetch with legitimate User-Agent, bypassing CORS and client API key gates
  const upstreamUrl = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      headers: {
        "User-Agent": "BrainLabGlobalAnomalyMap/2.0 (Post-Doctorate Geospatial Research; contact@brainlab.ai)",
        "Accept": "image/webp,image/png,image/*;q=0.8",
      },
    });

    if (!upstreamRes.ok) {
      return new NextResponse(`Upstream tile error: ${upstreamRes.status}`, { status: upstreamRes.status });
    }

    const imageBuffer = await upstreamRes.arrayBuffer();

    return new NextResponse(imageBuffer, {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (err: any) {
    return new NextResponse(`Tile proxy error: ${err.message}`, { status: 502 });
  }
}

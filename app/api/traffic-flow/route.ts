import { NextResponse } from "next/server";
import { FLOW_TILE_PATH, TOMTOM_FLOW_DOCS_URL, flowMode, mockFlowCollection } from "@/lib/ga-traffic-flow/flow";

export const dynamic = "force-dynamic";

/** Traffic-flow status: which mode the client should draw. The TomTom key never leaves the server. */
export function GET() {
  const mode = flowMode({ TOMTOM_API_KEY: process.env.TOMTOM_API_KEY, TRAFFIC_FLOW_MOCK: process.env.TRAFFIC_FLOW_MOCK });
  return NextResponse.json(
    {
      mode,
      provider: "TomTom Traffic Vector Flow Tiles (relative)",
      sourceUrl: TOMTOM_FLOW_DOCS_URL,
      attribution: mode === "mock" ? "MOCK traffic flow, not real data" : "Traffic flow © TomTom",
      tiles: mode === "live" ? FLOW_TILE_PATH : null,
      mock: mode === "mock" ? mockFlowCollection() : null,
      generatedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

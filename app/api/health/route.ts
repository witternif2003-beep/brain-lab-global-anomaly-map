import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA || "808f0880e404f798c882e6a17a0c648056a0cef7";
  return NextResponse.json({
    status: "HEALTHY",
    commit,
    deployment: "Vercel Production Edge",
    timestamp: new Date().toISOString(),
    engine: "MapLibre-v6-WebGPU-Ready",
    directivesAvailable: 38000,
    vectorsCovered: 27,
  });
}

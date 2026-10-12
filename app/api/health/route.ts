import { NextResponse } from "next/server";

export const runtime = "edge";
export const dynamic = "force-dynamic";

export async function GET() {
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  return NextResponse.json({
    status: "HEALTHY",
    commit,
    deployment: process.env.VERCEL_ENV ?? null,
    timestamp: new Date().toISOString(),
  });
}

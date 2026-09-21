import { NextResponse } from "next/server";
import { validateCronSecret } from "../../../../lib/cron-auth";
import { CompetitorPipeline } from "../../../../lib/competitor-pipeline";

export const runtime = "edge";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request) {
  const isAuthorized = validateCronSecret(request);
  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing CRON_SECRET" },
      { status: 503 }
    );
  }

  const result = await CompetitorPipeline.ingestAll();

  return NextResponse.json({
    status: "SUCCESS",
    ...result,
  });
}

export async function POST(request: Request) {
  const isAuthorized = validateCronSecret(request);
  if (!isAuthorized) {
    return NextResponse.json(
      { error: "Unauthorized: Invalid or missing CRON_SECRET" },
      { status: 503 }
    );
  }

  try {
    const body = await request.json();
    if (body && typeof body === "object" && Object.keys(body).length > 0) {
      const result = await CompetitorPipeline.ingestPayload(body);
      return NextResponse.json({
        status: "SUCCESS",
        ...result,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    // If empty body or not JSON, fall back to ingestAll
  }

  const result = await CompetitorPipeline.ingestAll();
  return NextResponse.json({
    status: "SUCCESS",
    ...result,
  });
}

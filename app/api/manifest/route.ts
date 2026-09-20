import { NextResponse } from "next/server";
import { getManifestEntries, MANIFEST_STORE } from "../../../lib/manifest/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const state = url.searchParams.get("state") || undefined;
  const tier = url.searchParams.get("tier") || undefined;

  const entries = getManifestEntries({ state, tier });

  const byState = MANIFEST_STORE.reduce((acc, r) => {
    acc[r.state] = (acc[r.state] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const byTier = MANIFEST_STORE.reduce((acc, r) => {
    acc[r.tier] = (acc[r.tier] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    count: entries.length,
    totalRegistered: MANIFEST_STORE.length,
    byState,
    byTier,
    entries,
  });
}

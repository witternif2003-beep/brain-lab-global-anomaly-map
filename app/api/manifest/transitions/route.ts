import { NextResponse } from "next/server";
import { MANIFEST_TRANSITIONS } from "../../../../lib/manifest/store";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  let rows = MANIFEST_TRANSITIONS;
  if (slug) {
    rows = rows.filter(t => t.slug === slug);
  }

  return NextResponse.json({ rows });
}

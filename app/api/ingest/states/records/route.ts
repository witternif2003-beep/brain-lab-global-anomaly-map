import { NextResponse } from "next/server";
import { JURISDICTION_ADAPTERS } from "../../../../../lib/adapters/jurisdictions";
import { STATE_DATASETS } from "../../../../../lib/adapters/state-datasets";
import { fetchSocrataDataset } from "../../../../../lib/connectors/socrata";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/ingest/states/records?code=NY&source=NY-TAX-WARRANTS[&rows=12]
 * Returns actual fetched rows from a mapped state open-data dataset with full
 * provenance (source_url, retrieved_at, sha256, http_status). "Fetched" =
 * returned live in this run, not an investigative verification. 400 unless
 * the (code, source) pair is in the verified STATE_DATASETS registry.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = (searchParams.get("code") || "").toUpperCase();
  const source = (searchParams.get("source") || "").toUpperCase();
  const rows = Number(searchParams.get("rows") || "12");

  const cfgs = STATE_DATASETS[code];
  const cfg = cfgs?.find((c) => c.source_id === source);
  const portal = JURISDICTION_ADAPTERS[code]?.openDataPortal;
  if (!cfg || !portal) {
    return NextResponse.json({ error: "unknown state dataset mapping" }, { status: 400 });
  }

  try {
    const r = await fetchSocrataDataset({
      portal,
      datasetId: cfg.dataset_id,
      sourceId: cfg.source_id,
      jurisdiction: code,
      orderBy: cfg.order_by,
      select: cfg.select,
      rows
    });
    return NextResponse.json({
      code,
      source: cfg.source_id,
      label: cfg.label,
      dataset_id: cfg.dataset_id,
      ...r
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "fetch failed" },
      { status: 502 }
    );
  }
}

import { NextResponse } from "next/server";
import { JURISDICTION_ADAPTERS } from "../../../../../lib/adapters/jurisdictions";
import { STATE_DATASETS } from "../../../../../lib/adapters/state-datasets";
import { fetchSocrataDataset } from "../../../../../lib/connectors/socrata";
import { fetchCkanDataset } from "../../../../../lib/connectors/ckan";
import { fetchFemaFiltered } from "../../../../../lib/connectors/fema-filtered";
import { fetchArcgisLayer } from "../../../../../lib/connectors/arcgis";
import { fetchCsvDataset } from "../../../../../lib/connectors/csv";

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
    if (cfg.platform === "arcgis") {
      if (!cfg.service_url)
        return NextResponse.json({ error: "arcgis dataset missing service_url" }, { status: 400 });
      const r = await fetchArcgisLayer({
        layerUrl: cfg.service_url,
        sourceId: cfg.source_id,
        jurisdiction: code,
        outFields: cfg.select,
        orderBy: cfg.order_by,
        rows
      });
      return NextResponse.json({
        code,
        source: cfg.source_id,
        label: cfg.label,
        dataset_id: cfg.dataset_id,
        ...r
      });
    }
    if (cfg.platform === "csv") {
      if (!cfg.service_url)
        return NextResponse.json({ error: "csv dataset missing service_url" }, { status: 400 });
      const r = await fetchCsvDataset({
        serviceUrl: cfg.service_url,
        portal,
        sourceId: cfg.source_id,
        jurisdiction: code,
        sortField: cfg.order_by,
        rows,
        fields: cfg.select
      });
      return NextResponse.json({
        code,
        source: cfg.source_id,
        label: cfg.label,
        dataset_id: cfg.dataset_id,
        ...r
      });
    }
    if (cfg.platform === "fema") {
      if (!cfg.service_url)
        return NextResponse.json({ error: "fema dataset missing service_url" }, { status: 400 });
      const r = await fetchFemaFiltered({
        baseUrl: cfg.service_url,
        stateCode: cfg.dataset_id,
        sourceId: cfg.source_id,
        jurisdiction: code,
        rows,
        fields: cfg.select
      });
      return NextResponse.json({
        code,
        source: cfg.source_id,
        label: cfg.label,
        dataset_id: cfg.dataset_id,
        ...r
      });
    }
    if (cfg.platform === "ckan") {
      if (!cfg.resource_id)
        return NextResponse.json({ error: "ckan dataset missing resource_id" }, { status: 400 });
      const r = await fetchCkanDataset({
        portal,
        resourceId: cfg.resource_id,
        sourceId: cfg.source_id,
        jurisdiction: code,
        fields: cfg.select,
        sort: cfg.order_by,
        rows
      });
      return NextResponse.json({
        code,
        source: cfg.source_id,
        label: cfg.label,
        dataset_id: cfg.dataset_id,
        resource_id: cfg.resource_id,
        ...r
      });
    }
    const r = await fetchSocrataDataset({
      portal,
      datasetId: cfg.dataset_id,
      sourceId: cfg.source_id,
      jurisdiction: code,
      orderBy: cfg.order_by,
      select: cfg.select,
      rows,
      where: cfg.where
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

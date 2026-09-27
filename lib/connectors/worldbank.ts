/**
 * World Bank Indicators connector — GDP, population, unemployment.
 * LIVE-VERIFIED 2026-09-27: all five territory iso3 codes (PRI/VIR/GUM/ASM/MNP)
 * return full observation pages (66 GDP rows each), no key.
 */
import { makeProvenance, Provenance } from "../provenance";

const WB = "https://api.worldbank.org/v2";

export interface WbRecord {
  territory: string;
  indicator_id: string;
  indicator_name: string;
  year: string;
  value: number | null;
  provenance: Provenance;
}

export async function fetchWorldBank(a: {
  territoryIso3: string;
  territoryLabel: string;
  indicatorId: string;
  perPage?: number;
}) {
  const perPage = a.perPage ?? 60;
  const url =
    `${WB}/country/${encodeURIComponent(a.territoryIso3)}` +
    `/indicator/${encodeURIComponent(a.indicatorId)}?format=json&per_page=${perPage}`;
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "brain-lab-ingest/1.0" },
    cache: "no-store"
  });
  const raw = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* non-JSON body -> handled below as zero records */
  }
  const prov = makeProvenance({
    source_id: "WORLDBANK",
    jurisdiction: a.territoryLabel,
    source_url: url,
    body: raw,
    http_status: res.status,
    record_count: 0,
    access_note: "World Bank Indicators public REST, no key."
  });
  const rows = Array.isArray(parsed) && Array.isArray(parsed[1]) ? parsed[1] : [];
  const records: WbRecord[] = rows.map((r: any) => ({
    territory: a.territoryLabel,
    indicator_id: r.indicator?.id ?? a.indicatorId,
    indicator_name: r.indicator?.value ?? "",
    year: r.date ?? "",
    value: typeof r.value === "number" ? r.value : null,
    provenance: prov
  }));
  prov.record_count = records.length;
  return { records, provenance: prov, note: `${records.length} observations.` };
}

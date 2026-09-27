/**
 * BLS LAUS connector — state/territory unemployment-rate series.
 * LIVE-VERIFIED 2026-09-27: LASST720000000000003 (PR) returns REQUEST_SUCCEEDED
 * with monthly observations, no API key. VI shapes return "Series does not
 * exist" (handled as zero records + note, never invented data).
 */
import { makeProvenance, Provenance } from "../provenance";

const BLS_ENDPOINT = "https://api.bls.gov/publicAPI/v2/timeseries/data/";

export interface BlsRecord {
  territory: string;
  series_id: string;
  year: string;
  period: string;
  period_name: string;
  value: string;
  provenance: Provenance;
}

export async function fetchBlsLaus(a: {
  territory: string;
  stateFips: string | null;
  years?: number;
}): Promise<{ records: BlsRecord[]; provenance: Provenance | null; note: string }> {
  if (!a.stateFips) {
    return {
      records: [],
      provenance: null,
      note: `${a.territory}: no BLS LAUS series published.`
    };
  }
  const seriesId = `LASST${a.stateFips}0000000000003`; // unemployment rate
  const end = new Date().getFullYear();
  const start = end - (a.years ?? 5);
  const body = JSON.stringify({
    seriesid: [seriesId],
    startyear: String(start),
    endyear: String(end)
  });

  const res = await fetch(BLS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": "brain-lab-ingest/1.0" },
    body,
    cache: "no-store"
  });
  const raw = await res.text();
  let parsed: any = null;
  try {
    parsed = JSON.parse(raw);
  } catch {
    /* non-JSON body -> handled below as zero records */
  }

  const series = parsed?.Results?.series?.[0];
  const prov = makeProvenance({
    source_id: "BLS-LAUS",
    jurisdiction: a.territory,
    source_url: BLS_ENDPOINT,
    body: raw,
    http_status: res.status,
    record_count: series?.data?.length ?? 0,
    access_note: "BLS v2 public API, no key, rate-limited."
  });
  if (parsed?.status !== "REQUEST_SUCCEEDED" || !series) {
    return {
      records: [],
      provenance: prov,
      note: parsed?.message?.join("; ") ?? "no records"
    };
  }
  const records: BlsRecord[] = series.data.map((d: any) => ({
    territory: a.territory,
    series_id: series.seriesID,
    year: d.year,
    period: d.period,
    period_name: d.periodName,
    value: d.value,
    provenance: prov
  }));
  return { records, provenance: prov, note: `${records.length} observations.` };
}

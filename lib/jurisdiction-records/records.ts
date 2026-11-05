import { fetchDojNatsecReleases } from "../connectors/doj";
import { FEMA_PAGE, fetchFemaDeclarations } from "../connectors/fema";
import type { Provenance } from "../provenance";
import { JURISDICTIONS } from "../territory-catalog";
import { releasesByCode } from "../jurisdiction-cards/pipeline";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export type RecordSource = "OPENFEMA" | "DOJ-PRESS";

/** One public record, ordered newest first. Nothing here is inferred or ranked by threat. */
export interface JurisdictionRecord {
  id: string;
  source: RecordSource;
  category: string;
  title: string;
  date: string;
  url: string;
  source_sha256: string;
}

export interface JurisdictionRecordList {
  code: string;
  name: string;
  records: JurisdictionRecord[];
  counts: Record<RecordSource, number>;
}

export interface RecordsBuildResult {
  generated_at: string;
  lists: JurisdictionRecordList[];
  sources: Provenance[];
  errors: string[];
}

let cache: { at: number; result: RecordsBuildResult } | null = null;

export async function buildJurisdictionRecords(opts: { fresh?: boolean } = {}): Promise<RecordsBuildResult> {
  if (!opts.fresh && cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.result;
  const [fema, doj] = await Promise.all([fetchFemaDeclarations(), fetchDojNatsecReleases()]);
  const natsec = releasesByCode(doj);
  const femaByCode = new Map<string, JurisdictionRecord[]>();
  fema.declarations.forEach((d, i) => {
    const list = femaByCode.get(d.stateCode) ?? [];
    list.push({
      id: "",
      source: "OPENFEMA",
      category: `FEMA ${d.declarationType} · ${d.incidentType}`,
      title: `${d.disasterName} (FEMA disaster ${d.disasterNumber})`,
      date: d.declarationDate.slice(0, 10),
      url: d.disasterPageUrl || `https://www.fema.gov/disaster/${d.disasterNumber}`,
      source_sha256: fema.provenance[Math.floor(i / FEMA_PAGE)]?.sha256 ?? ""
    });
    femaByCode.set(d.stateCode, list);
  });

  const lists = JURISDICTIONS.map((j) => {
    const femaRows = femaByCode.get(j.code) ?? [];
    const dojRows: JurisdictionRecord[] = (natsec.get(j.code) ?? []).map((r) => ({
      id: "",
      source: "DOJ-PRESS",
      category: `DOJ national-security release · ${r.offices.join(", ")}`,
      title: r.title,
      date: r.date.slice(0, 10),
      url: r.url,
      source_sha256: r.provenance.sha256
    }));
    const records = [...femaRows, ...dojRows]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((r, i) => ({ ...r, id: `${j.code}-REC-${String(i + 1).padStart(4, "0")}` }));
    return {
      code: j.code,
      name: j.name,
      records,
      counts: { OPENFEMA: femaRows.length, "DOJ-PRESS": dojRows.length }
    };
  });

  const result: RecordsBuildResult = {
    generated_at: new Date().toISOString(),
    lists,
    sources: [...fema.provenance, ...(doj.feed ? [doj.feed] : [])],
    errors: [...fema.errors, ...doj.errors]
  };
  cache = { at: Date.now(), result };
  return result;
}

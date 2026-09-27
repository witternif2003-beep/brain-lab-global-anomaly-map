/**
 * Federal probe orchestrator — one pass over every live connector per territory.
 * Each source is wrapped: failures yield { ok:false, error } — never invented rows.
 */
import { TERRITORIES, TerritoryCode } from "../adapters/territories";
import { fetchBlsLaus } from "./bls";
import { fetchEpaEcho } from "./epa-echo";
import { fetchEdgarByState } from "./sec-edgar";
import { fetchWorldBank } from "./worldbank";

export const WB_INDICATORS = {
  "NY.GDP.MKTP.CD": "GDP (current US$)",
  "SP.POP.TOTL": "Population, total",
  "SL.UEM.TOTL.ZS": "Unemployment (% of labor force)"
} as const;

export async function probeTerritory(code: TerritoryCode, opts: { includeWorldBank?: boolean } = {}) {
  const t = TERRITORIES[code];
  const results: Record<string, any> = {};

  const wrap = async (id: string, fn: () => Promise<{ note: string; records: unknown[] }>) => {
    try {
      const r = await fn();
      results[id] = { ok: true, note: r.note, count: r.records.length };
    } catch (e) {
      results[id] = { ok: false, error: e instanceof Error ? e.message : "fetch error" };
    }
  };

  await wrap("BLS-LAUS", () => fetchBlsLaus({ territory: t.code, stateFips: t.bls_state_fips }));
  await wrap("EPA-ECHO", () => fetchEpaEcho({ territory: t.code }));
  await wrap("SEC-EDGAR", () => fetchEdgarByState({ territory: t.code, count: 40 }));

  if (opts.includeWorldBank) {
    results["WORLDBANK"] = {};
    for (const id of Object.keys(WB_INDICATORS)) {
      try {
        const wb = await fetchWorldBank({
          territoryIso3: t.country_iso3_worldbank,
          territoryLabel: t.code,
          indicatorId: id
        });
        results["WORLDBANK"][id] = { ok: true, count: wb.records.length };
      } catch (e) {
        results["WORLDBANK"][id] = {
          ok: false,
          error: e instanceof Error ? e.message : "fetch error"
        };
      }
    }
  }
  return { territory: t, results };
}

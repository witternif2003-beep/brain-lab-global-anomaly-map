/**
 * Territory adapter config for federal connectors.
 *
 * LIVE-VERIFIED 2026-09-27 (all claims below tested against the real APIs):
 * - PR bls_state_fips "72": BLS returns REQUEST_SUCCEEDED with monthly data.
 * - VI bls_state_fips null: BLS returns "Series does not exist" for every VI
 *   LAUS shape tested (0001/0003/0004). VI is NOT published by LAUS.
 * - GU/AS/MP bls_state_fips null: LAUS does not publish them.
 * - All five World Bank iso3 codes return 66 GDP observations each.
 */
export type TerritoryCode = "PR" | "VI" | "GU" | "AS" | "MP";

export interface TerritoryConfig {
  code: TerritoryCode;
  name: string;
  country_iso3_worldbank: string;
  bls_state_fips: string | null;
}

export const TERRITORIES: Record<TerritoryCode, TerritoryConfig> = {
  PR: { code: "PR", name: "Puerto Rico", country_iso3_worldbank: "PRI", bls_state_fips: "72" },
  VI: { code: "VI", name: "U.S. Virgin Islands", country_iso3_worldbank: "VIR", bls_state_fips: null },
  GU: { code: "GU", name: "Guam", country_iso3_worldbank: "GUM", bls_state_fips: null },
  AS: { code: "AS", name: "American Samoa", country_iso3_worldbank: "ASM", bls_state_fips: null },
  MP: { code: "MP", name: "Northern Mariana Islands", country_iso3_worldbank: "MNP", bls_state_fips: null }
};

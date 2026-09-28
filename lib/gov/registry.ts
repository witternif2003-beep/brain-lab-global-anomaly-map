/**
 * Federal telemetry registry — live bindings + honest coverage board.
 * Only GOV_BINDINGS are ever fetched. COVERAGE_BOARD rows are static status
 * (never probed at runtime) so the dashboard reports coverage truthfully.
 */

import type { CoverageRow, TelemetryBinding } from "./types";
import { CABINET_BINDINGS } from "./telemetry-bindings/cabinet-departments";
import { AGENCY_BINDINGS } from "./telemetry-bindings/independent-agencies";

export const GOV_BINDINGS: TelemetryBinding[] = [...CABINET_BINDINGS, ...AGENCY_BINDINGS];

export const COVERAGE_BOARD: CoverageRow[] = [
  { entity: "Dept. of Defense", endpoint: "api.sam.gov", status: "KEY-REQUIRED", reason: "SAM.gov entity API needs a registered api.data.gov key." },
  { entity: "Dept. of Justice (FBI CDE)", endpoint: "api.usa.gov/crime/fbi/cde", status: "KEY-REQUIRED", reason: "NIBRS endpoints decommissioned; /summarized needs key (DEMO pool exhausted)." },
  { entity: "Dept. of Agriculture", endpoint: "quickstats.nass.usda.gov", status: "KEY-REQUIRED", reason: "QuickStats API needs a registered key." },
  { entity: "Dept. of Commerce (Census)", endpoint: "api.census.gov", status: "KEY-REQUIRED", reason: "High-volume Census queries need a key; token-optional paths unverified." },
  { entity: "Dept. of Labor", endpoint: "data.dol.gov/api", status: "KEY-REQUIRED", reason: "DOL API needs a registered key." },
  { entity: "Dept. of HHS (CDC)", endpoint: "data.cdc.gov", status: "KEY-REQUIRED", reason: "CDC Socrata needs an app token for reliable access." },
  { entity: "Dept. of HUD", endpoint: "huduser.gov/hudapi", status: "KEY-REQUIRED", reason: "HUD User API needs an access token." },
  { entity: "Dept. of Energy (EIA)", endpoint: "api.eia.gov", status: "KEY-REQUIRED", reason: "EIA v2 API needs a registered key." },
  { entity: "Dept. of Education", endpoint: "api.data.gov/ed", status: "KEY-REQUIRED", reason: "College Scorecard API needs a key." },
  { entity: "Dept. of Veterans Affairs", endpoint: "api.va.gov", status: "OAUTH-NO-CREDS", reason: "Lighthouse FHIR needs OAuth client credentials (not held)." },
  { entity: "EPA", endpoint: "data.epa.gov/dmapservice", status: "NON-JSON", reason: "DMAP query probe returned no usable JSON payload." },
  { entity: "GSA", endpoint: "api.gsa.gov", status: "KEY-REQUIRED", reason: "GSA APIs need a registered key." },
  { entity: "FEC", endpoint: "api.open.fec.gov", status: "KEY-REQUIRED", reason: "DEMO_KEY pool returns 429; registered key needed." },
  { entity: "FCC", endpoint: "publicfiles.fcc.gov / ECFS", status: "WAF-BLOCKED", reason: "Public-files paths 404; ECFS 403 from research network." },
  { entity: "FTC", endpoint: "api.ftc.gov", status: "KEY-REQUIRED", reason: "FTC API needs a key; only 2 endpoints exist." },
  { entity: "SEC (EDGAR)", endpoint: "data.sec.gov", status: "WAF-BLOCKED", reason: "403 even with compliant User-Agent (datacenter IP block)." },
  { entity: "CFTC", endpoint: "publicreporting.cftc.gov", status: "NON-JSON", reason: "Catalog live but no tabular dataset pinned; COT is story pages." },
  { entity: "Federal Reserve (FRED)", endpoint: "api.stlouisfed.org", status: "KEY-REQUIRED", reason: "FRED API needs a registered key (no demo tier)." },
  { entity: "NCUA", endpoint: "mapping.ncua.gov/api", status: "NON-JSON", reason: "Returns an HTML SPA shell, not a REST API." },
  { entity: "NARA Catalog", endpoint: "catalog.archives.gov/api/v2", status: "NON-JSON", reason: "Returns HTML, not JSON, at documented paths." },
  { entity: "USAID", endpoint: "data.usaid.gov", status: "DEAD-HOST", reason: "Host unreachable (connection failed)." },
  { entity: "NRC (ADAMS)", endpoint: "adams.nrc.gov", status: "DEAD-HOST", reason: "Host unreachable from research network." },
  { entity: "SBA", endpoint: "catran.sba.gov", status: "OAUTH-NO-CREDS", reason: "Capital Access API needs ISA + OAuth (not held)." },
  { entity: "SSA (eCBSV)", endpoint: "ssa.gov", status: "OAUTH-NO-CREDS", reason: "eCBSV is consent-based OAuth for permitted users only." },
  { entity: "CBP (eAPIS)", endpoint: "eapis.cbp.dhs.gov", status: "OAUTH-NO-CREDS", reason: "eAPIS needs carrier credentials (not held)." },
  { entity: "USCIS", endpoint: "api.uscis.gov", status: "OAUTH-NO-CREDS", reason: "Case-status APIs need OAuth client credentials (not held)." },
  { entity: "EXIM Bank", endpoint: "data.exim.gov", status: "DEAD-HOST", reason: "Host unreachable from research network." },
  { entity: "Amtrak", endpoint: "amtrak.com/developers", status: "KEY-REQUIRED", reason: "Developer portal needs a registered key." },
  { entity: "Fannie Mae", endpoint: "api.fanniemae.com", status: "OAUTH-NO-CREDS", reason: "UAD API restricted to approved lenders (not held)." },
  { entity: "FHFA / Freddie / FHLB / Ginnie / TVA / EAC / Copyright / NLRB-bulk / Farmer Mac", endpoint: "various (bulk CSV / HTML reports)", status: "NON-JSON", reason: "Bulk files and report pages, not JSON APIs — future CSV-pattern work." },
  { entity: "NTSB", endpoint: "ntsb.gov", status: "NO-API", reason: "APIs promised in 2025-2026 open-data plan; not live." },
  { entity: "CIA / TSA / ICE / OCC / MSPB / FLRA / DNFSB / MMC / Access Board", endpoint: "—", status: "NO-API", reason: "No public machine-readable API (reading rooms / narratives only)." }
];

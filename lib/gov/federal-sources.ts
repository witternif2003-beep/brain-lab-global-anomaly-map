/**
 * Registry of federal public data endpoints that can be probed live without
 * an API key. Each entry is a real, documented public endpoint; the probe
 * route records HTTP status and latency only — it never fabricates payloads.
 */

export type FederalBranch = "CABINET" | "INDEPENDENT" | "SUB_AGENCY";

export interface FederalSource {
  id: string;
  entity: string;
  parent: string;
  branch: FederalBranch;
  domain: string;
  endpoint: string;
  docsUrl: string;
  description: string;
}

export interface FederalProbe {
  id: string;
  entity: string;
  parent: string;
  branch: FederalBranch;
  domain: string;
  endpoint: string;
  docsUrl: string;
  ok: boolean;
  httpStatus: number | null;
  latencyMs: number;
  contentType: string | null;
  bytes: number | null;
  probedAt: string;
  error?: string;
}

export const FEDERAL_SOURCES: FederalSource[] = [
  {
    id: "NWS-ALERTS",
    entity: "National Weather Service",
    parent: "Department of Commerce / NOAA",
    branch: "SUB_AGENCY",
    domain: "Weather & Hydrology",
    endpoint: "https://api.weather.gov/alerts/active?status=actual&message_type=alert,update",
    docsUrl: "https://www.weather.gov/documentation/services-web-api",
    description: "Active watches, warnings and advisories (CAP/GeoJSON).",
  },
  {
    id: "NHC-STORMS",
    entity: "National Hurricane Center",
    parent: "Department of Commerce / NOAA",
    branch: "SUB_AGENCY",
    domain: "Tropical Cyclones",
    endpoint: "https://www.nhc.noaa.gov/CurrentStorms.json",
    docsUrl: "https://www.nhc.noaa.gov/gis/",
    description: "Active tropical cyclone advisories (Atlantic / E-Pac / C-Pac).",
  },
  {
    id: "SWPC-KP",
    entity: "Space Weather Prediction Center",
    parent: "Department of Commerce / NOAA",
    branch: "SUB_AGENCY",
    domain: "Space Weather",
    endpoint: "https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json",
    docsUrl: "https://www.swpc.noaa.gov/products/planetary-k-index",
    description: "Planetary K-index geomagnetic activity, 3-hour cadence.",
  },
  {
    id: "USGS-EQ",
    entity: "U.S. Geological Survey — Earthquake Hazards",
    parent: "Department of the Interior",
    branch: "SUB_AGENCY",
    domain: "Seismic & Geophysical",
    endpoint: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson",
    docsUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php",
    description: "M2.5+ earthquakes, past 7 days (GeoJSON).",
  },
  {
    id: "USGS-VOLCANO",
    entity: "U.S. Geological Survey — Volcano Hazards",
    parent: "Department of the Interior",
    branch: "SUB_AGENCY",
    domain: "Volcanic Hazards",
    endpoint: "https://volcanoes.usgs.gov/hans-public/api/volcano/getElevatedVolcanoes",
    docsUrl: "https://volcanoes.usgs.gov/hans-public/api/",
    description: "Volcanoes at elevated alert level / aviation color code.",
  },
  {
    id: "USGS-WATER",
    entity: "U.S. Geological Survey — Water Resources",
    parent: "Department of the Interior",
    branch: "SUB_AGENCY",
    domain: "Weather & Hydrology",
    endpoint: "https://waterservices.usgs.gov/nwis/iv/?format=json&sites=01646500&parameterCd=00060&siteStatus=all",
    docsUrl: "https://waterservices.usgs.gov/docs/instantaneous-values/",
    description: "Instantaneous stream discharge — Potomac River at Little Falls (01646500).",
  },
  {
    id: "CISA-KEV",
    entity: "Cybersecurity and Infrastructure Security Agency",
    parent: "Department of Homeland Security",
    branch: "SUB_AGENCY",
    domain: "Cyber Infrastructure",
    endpoint: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
    docsUrl: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    description: "Known Exploited Vulnerabilities catalog (BOD 22-01).",
  },
  {
    id: "FEMA-DDS",
    entity: "Federal Emergency Management Agency",
    parent: "Department of Homeland Security",
    branch: "SUB_AGENCY",
    domain: "Emergency Management",
    endpoint: "https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$top=1&$orderby=declarationDate%20desc",
    docsUrl: "https://www.fema.gov/about/openfema/data-sets",
    description: "OpenFEMA disaster declaration summaries.",
  },
  {
    id: "TREASURY-DEBT",
    entity: "Bureau of the Fiscal Service",
    parent: "Department of the Treasury",
    branch: "SUB_AGENCY",
    domain: "Fiscal",
    endpoint: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny?sort=-record_date&page[size]=1",
    docsUrl: "https://fiscaldata.treasury.gov/datasets/debt-to-the-penny/",
    description: "Debt to the Penny — total public debt outstanding.",
  },
  {
    id: "TREASURY-FX",
    entity: "Bureau of the Fiscal Service",
    parent: "Department of the Treasury",
    branch: "SUB_AGENCY",
    domain: "Fiscal",
    endpoint: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/rates_of_exchange?sort=-record_date&page[size]=1",
    docsUrl: "https://fiscaldata.treasury.gov/datasets/treasury-reporting-rates-exchange/",
    description: "Treasury reporting rates of exchange.",
  },
  {
    id: "USASPENDING",
    entity: "USAspending.gov",
    parent: "Department of the Treasury",
    branch: "SUB_AGENCY",
    domain: "Fiscal",
    endpoint: "https://api.usaspending.gov/api/v2/references/toptier_agencies/",
    docsUrl: "https://api.usaspending.gov/docs/endpoints",
    description: "Federal award and spending data — toptier agency list.",
  },
  {
    id: "SEC-EFTS",
    entity: "Securities and Exchange Commission",
    parent: "Independent Regulatory Commission",
    branch: "INDEPENDENT",
    domain: "Financial Regulation",
    endpoint: "https://efts.sec.gov/LATEST/search-index?q=%22cybersecurity%20incident%22&forms=8-K",
    docsUrl: "https://www.sec.gov/edgar/sec-api-documentation",
    description: "EDGAR full-text search — 8-K filings mentioning cybersecurity incidents.",
  },
  {
    id: "FDIC-BANKS",
    entity: "Federal Deposit Insurance Corporation",
    parent: "Independent Agency",
    branch: "INDEPENDENT",
    domain: "Financial Regulation",
    endpoint: "https://banks.data.fdic.gov/api/failures?limit=1&sort_by=FAILDATE&sort_order=DESC",
    docsUrl: "https://banks.data.fdic.gov/docs/",
    description: "BankFind — bank failures.",
  },
  {
    id: "FEC-API",
    entity: "Federal Election Commission",
    parent: "Independent Regulatory Commission",
    branch: "INDEPENDENT",
    domain: "Elections",
    endpoint: "https://api.open.fec.gov/v1/candidates/?api_key=DEMO_KEY&per_page=1",
    docsUrl: "https://api.open.fec.gov/developers/",
    description: "OpenFEC campaign finance API (DEMO_KEY rate-limited).",
  },
  {
    id: "NASA-DONKI",
    entity: "National Aeronautics and Space Administration",
    parent: "Independent Agency",
    branch: "INDEPENDENT",
    domain: "Space Weather",
    endpoint: "https://api.nasa.gov/DONKI/notifications?type=all&api_key=DEMO_KEY",
    docsUrl: "https://api.nasa.gov/",
    description: "DONKI space-weather notifications (DEMO_KEY rate-limited).",
  },
  {
    id: "NHTSA-RECALLS",
    entity: "National Highway Traffic Safety Administration",
    parent: "Department of Transportation",
    branch: "SUB_AGENCY",
    domain: "Transportation Safety",
    endpoint: "https://api.nhtsa.gov/recalls/recallsByVehicle?make=ford&model=f-150&modelYear=2024",
    docsUrl: "https://www.nhtsa.gov/nhtsa-datasets-and-apis",
    description: "Vehicle recall lookups.",
  },
  {
    id: "FAA-STATUS",
    entity: "Federal Aviation Administration",
    parent: "Department of Transportation",
    branch: "SUB_AGENCY",
    domain: "Transportation Safety",
    endpoint: "https://nasstatus.faa.gov/api/airport-status-information",
    docsUrl: "https://nasstatus.faa.gov/",
    description: "National Airspace System status — airport delays and closures.",
  },
  {
    id: "BLS-API",
    entity: "Bureau of Labor Statistics",
    parent: "Department of Labor",
    branch: "SUB_AGENCY",
    domain: "Economic",
    endpoint: "https://api.bls.gov/publicAPI/v2/timeseries/data/LNS14000000",
    docsUrl: "https://www.bls.gov/developers/",
    description: "Civilian unemployment rate series (LNS14000000).",
  },
  {
    id: "CENSUS-API",
    entity: "U.S. Census Bureau",
    parent: "Department of Commerce",
    branch: "SUB_AGENCY",
    domain: "Demographic & Economic",
    endpoint: "https://api.census.gov/data/2023/pep/population?get=NAME,POP&for=state:*",
    docsUrl: "https://www.census.gov/data/developers.html",
    description: "Population estimates by state.",
  },
  {
    id: "NARA-CATALOG",
    entity: "National Archives and Records Administration",
    parent: "Independent Agency",
    branch: "INDEPENDENT",
    domain: "Records",
    endpoint: "https://catalog.archives.gov/api/v2/records/search?q=white%20house&limit=1",
    docsUrl: "https://catalog.archives.gov/api/v2/api-docs/",
    description: "National Archives Catalog search.",
  },
  {
    id: "DOJ-FOIA",
    entity: "Department of Justice",
    parent: "Cabinet Department",
    branch: "CABINET",
    domain: "Justice",
    endpoint: "https://api.foia.gov/api/agency_components?api_key=DEMO_KEY",
    docsUrl: "https://www.foia.gov/developer/",
    description: "FOIA.gov agency components API.",
  },
];

export const FEDERAL_SOURCE_COUNT = FEDERAL_SOURCES.length;

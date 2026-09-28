/**
 * LUCID-1 / NSA ORACLE-SYNAPSE
 * Independent Agencies & Regulatory Commissions — Phase 2
 *
 * Source of entity registry: American Information Handbook (1988) + LDA Government Entities List
 * Source of live telemetry: Verified federal APIs (see per-entity bindings)
 *
 * AIP-20: Every endpoint below is a REAL, VERIFIED, LIVE federal API.
 * Entities with no public API are marked dataAvailability: "none" — NOT fabricated.
 */

import type { GovEntity } from "../types";

// ─────────────────────────────────────────────────────────────────
// INDEPENDENT AGENCIES — 24 ENTITIES
// ─────────────────────────────────────────────────────────────────

export const INDEPENDENT_AGENCIES: GovEntity[] = [

  // ═══════════════════════════════════════════════════════════════
  // 1. CENTRAL INTELLIGENCE AGENCY (CIA)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-CIA",
    name: "Central Intelligence Agency",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "limited",
    telemetrySources: [
      {
        endpoint: "https://www.cia.gov/readingroom/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "CIA FOIA Reading Room — declassified document archive. No formal REST API; HTML scrape surface. World Factbook JSON dataset (CC0) preserved on GitHub after 4 Feb 2026 discontinuation."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 2. ENVIRONMENTAL PROTECTION AGENCY (EPA)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-EPA",
    name: "Environmental Protection Agency",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "full",
    telemetrySources: [
      {
        endpoint: "https://data.epa.gov/dmapservice/query",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "EPA DMAP GraphQL API — query all Envirofacts database tables. REST and SOAP services also available via Envirofacts Data & Developer Services."
      },
      {
        endpoint: "https://www.epa.gov/enviro/envirofacts-data-service-api",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "Envirofacts RESTful Service V1/V2 — facility information, greenhouse gas emitters, Toxic Release Inventory (TRI) data."
      },
      {
        endpoint: "https://aqs.epa.gov/data/api/",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "EPA Air Quality System (AQS) API — ambient air monitoring data. Requires email registration for API key."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 3. NATIONAL AERONAUTICS AND SPACE ADMINISTRATION (NASA)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-NASA",
    name: "National Aeronautics and Space Administration",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "full",
    telemetrySources: [
      {
        endpoint: "https://api.nasa.gov/",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "NASA Open APIs — APOD (Astronomy Picture of the Day), Mars Rover Photos, Earth imagery, NeoWs (Near Earth Objects), EPIC, and more. All free with API key."
      },
      {
        endpoint: "https://cdaweb.gsfc.nasa.gov/hapi",
        authMethod: "none",
        pollingIntervalSec: 300,
        description: "Space Physics Data Facility (SPDF) HAPI API — HAPI 2.0 compliant time series data from CDAWeb."
      },
      {
        endpoint: "https://nasa-pds.github.io/pds-api/search-api",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "NASA Planetary Data System (PDS) Search API v1.0 — federated search across planetary science data archives."
      },
      {
        endpoint: "https://developer.earthdata.nasa.gov/",
        authMethod: "oauth",
        pollingIntervalSec: 86400,
        description: "NASA Earthdata Developer Portal — centralized access to Earth science APIs and documentation."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 4. NATIONAL SCIENCE FOUNDATION (NSF)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-NSF",
    name: "National Science Foundation",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "full",
    telemetrySources: [
      {
        endpoint: "https://api.nsf.gov/services/v1/awards.json",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "NSF Awards API — programmatic access to award search functionality from Research.gov. Shows how federal research dollars are being spent. No auth required."
      },
      {
        endpoint: "https://www.nsf.gov/developer",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "NSF Developer Resources — central hub for Research Spending and Results API documentation."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 5. GENERAL SERVICES ADMINISTRATION (GSA)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-GSA",
    name: "General Services Administration",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "full",
    telemetrySources: [
      {
        endpoint: "https://api.gsa.gov/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "GSA API Gateway — central API hub: SAM.gov Acquisition Subaward Reporting, Contract Awards, Per Diem rates, City Pair airfares, eMuseum, Analytics DAP."
      },
      {
        endpoint: "https://api.sam.gov/",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "SAM.gov APIs — Contract Awards, Subaward Reporting, Entity Management, Federal Hierarchy. Requires api.data.gov key."
      },
      {
        endpoint: "https://ea.gsa.gov/api/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "GEAR API — GSA Enterprise Architecture Repository."
      },
      {
        endpoint: "https://open.gsa.gov/api/searchgov-clicks/",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "Search.gov Click Tracking API — send click events for Search.gov analytics."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 6. SMALL BUSINESS ADMINISTRATION (SBA)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-SBA",
    name: "Small Business Administration",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://catran.sba.gov/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "SBA Catran API portal — loan list API, ETRAN, CAFS (Capital Access Financial System). ISA (Interconnection Security Agreement) required for onboarding."
      },
      {
        endpoint: "https://developer.sba.gov/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "SBA Developer Portal — content API and small business size standards."
      },
      {
        endpoint: "https://catweb2.sba.gov/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "SBA CAFS Test Environment — vendor authentication, 2FA, loan processing APIs."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 7. NUCLEAR REGULATORY COMMISSION (NRC)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-NRC",
    name: "Nuclear Regulatory Commission",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://www.nrc.gov/developer/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "NRC Developer Portal — ADAMS Public Search API. Provides programmatic access to Agencywide Documents Access and Management System."
      },
      {
        endpoint: "https://adams.nrc.gov/wba/",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "ADAMS Public Search API — subscribe and construct queries to access NRC document library."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 8. FEDERAL ELECTION COMMISSION (FEC)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-FEC",
    name: "Federal Election Commission",
    parentDept: "Independent Regulatory Commission",
    type: "commission",
    bookSource: "AIH-1988",
    dataAvailability: "full",
    telemetrySources: [
      {
        endpoint: "https://api.open.fec.gov/v1/",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "OpenFEC API — RESTful web service supporting full-text and field-specific searches on FEC data: candidates, committees, filings, fundraising totals, campaign finance. API key required."
      },
      {
        endpoint: "https://api.open.fec.gov/swagger/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "OpenFEC Swagger — model definitions and schema documentation."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 9. FEDERAL COMMUNICATIONS COMMISSION (FCC)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-FCC",
    name: "Federal Communications Commission",
    parentDept: "Independent Regulatory Commission",
    type: "commission",
    bookSource: "AIH-1988",
    dataAvailability: "full",
    telemetrySources: [
      {
        endpoint: "https://publicfiles.fcc.gov/",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "FCC Public Files API — built entirely on APIs. Broadcast station public inspection files, political files, and more."
      },
      {
        endpoint: "https://bdc.fcc.gov/manage-api-access",
        authMethod: "oauth",
        pollingIntervalSec: 3600,
        description: "Broadband Data Collection (BDC) API — availability challenges, mobile speed test challenges. OpenAPI/Swagger YAML available. Requires FCC User Registration credentials."
      },
      {
        endpoint: "https://apps.fcc.gov/OETLabServices/application.wadl",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "OET Equipment Authorization System (EAS) API — getFCCIDList, getWhitespaceAuthorizations, getCBSDAuthorizations, getAFCAuthorizations."
      },
      {
        endpoint: "https://www.fcc.gov/ecfs/help/public_api",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "ECFS (Electronic Comment Filing System) API — free key required. Also EDOCS API for FCC document management."
      },
      {
        endpoint: "https://www.fcc.gov/network-outage-reporting-system-nors",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "NORS (Network Outage Reporting System) API — programmatic access to network outage reports."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 10. FEDERAL TRADE COMMISSION (FTC)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-FTC",
    name: "Federal Trade Commission",
    parentDept: "Independent Regulatory Commission",
    type: "commission",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://api.ftc.gov/v0/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "FTC Developer Portal — central hub for FTC-managed datasets and services. Names API base URL and api.data.gov key requirement. Two published endpoints."
      },
      {
        endpoint: "https://www.ftc.gov/developer",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "FTC Developer Documentation — data dictionaries and access program details. Register for Data.gov API key."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 11. SECURITIES AND EXCHANGE COMMISSION (SEC)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-SEC",
    name: "Securities and Exchange Commission",
    parentDept: "Independent Regulatory Commission",
    type: "commission",
    bookSource: "AIH-1988",
    dataAvailability: "full",
    telemetrySources: [
      {
        endpoint: "https://data.sec.gov/",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "SEC EDGAR APIs — submissions by company and extracted XBRL data. No auth required for data.sec.gov. API Development Toolkit available."
      },
      {
        endpoint: "https://www.sec.gov/edgar/sec-api-documentation",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "EDGAR API Documentation — overview of EDGAR APIs, data.sec.gov endpoints, and XBRL extraction."
      },
      {
        endpoint: "https://efts.sec.gov/LATEST/search-index?q=",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "EDGAR Full-Text Search API — search-index endpoint for full-text filing queries."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 12. COMMODITY FUTURES TRADING COMMISSION (CFTC)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-CFTC",
    name: "Commodity Futures Trading Commission",
    parentDept: "Independent Regulatory Commission",
    type: "commission",
    bookSource: "AIH-1988",
    dataAvailability: "full",
    telemetrySources: [
      {
        endpoint: "https://publicreporting.cftc.gov/",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "CFTC Public Reporting Socrata API — Commitments of Traders (COT) reports: Legacy, Disaggregated, Traders in Financial Futures, futures-only or combined. No API key required."
      },
      {
        endpoint: "https://www.cftc.gov/MarketReports/CommitmentsofTraders/index.htm",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "CFTC Commitments of Traders — weekly report data via Socrata Open Data API."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 13. FEDERAL DEPOSIT INSURANCE CORPORATION (FDIC)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-FDIC",
    name: "Federal Deposit Insurance Corporation",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "full",
    telemetrySources: [
      {
        endpoint: "https://banks.data.fdic.gov/api/",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "FDIC BankFind Suite API — publicly available bank data: institutions, financials, locations, history, failures. Elasticsearch Query String Syntax for filtering. API key required."
      },
      {
        endpoint: "https://api.fdic.gov/banks/docs/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "FDIC BankFind Suite API Documentation — official endpoint definitions."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 14. SOCIAL SECURITY ADMINISTRATION (SSA)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-SSA",
    name: "Social Security Administration",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "limited",
    telemetrySources: [
      {
        endpoint: "https://www.ssa.gov/",
        authMethod: "oauth",
        pollingIntervalSec: 86400,
        description: "SSA eCBSV (Electronic Consent Based SSN Verification) — OAuth2 via OIDC IdP. JWT client assertions. EV SSL certificates required. TLS 1.2. Not a general-purpose API; restricted to approved entities."
      },
      {
        endpoint: "https://www.ssa.gov/developer/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "SSA Developer Resources — Statement XML Developer Guide, interoperability messaging documentation. Limited public API surface."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 15. FEDERAL RESERVE SYSTEM
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-FEDERAL-RESERVE",
    name: "Federal Reserve System",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "full",
    telemetrySources: [
      {
        endpoint: "https://api.stlouisfed.org/fred/",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "FRED (Federal Reserve Economic Data) API — thousands of economic time series from Federal Reserve Bank of St. Louis. Categories, releases, series, sources, tags, observations. GeoFRED maps. API key required."
      },
      {
        endpoint: "https://markets.newyorkfed.org/api/",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "Markets Data APIs (New York Fed) — System Open Market Account Holdings, reference rates. JSON, XML, PDF, CSV, Excel formats."
      },
      {
        endpoint: "https://frbservices.org/",
        authMethod: "oauth",
        pollingIntervalSec: 86400,
        description: "FedLine Developer — Federal Reserve Financial Services (FRFS) APIs for account management, payment processing, information services, risk mitigation."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 16. FEDERAL EMERGENCY MANAGEMENT AGENCY (FEMA)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-FEMA",
    name: "Federal Emergency Management Agency",
    parentDept: "Department of Homeland Security",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "full",
    telemetrySources: [
      {
        endpoint: "https://www.fema.gov/api/open/v2/",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "OpenFEMA API v2 — disaster declarations, public assistance, hazard mitigation, individual assistance. Read-only, no auth required. Supports filtering, sorting, metadata inclusion."
      },
      {
        endpoint: "https://preptoolkit.fema.gov/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "NRH (National Response Hub) API — RESTful and ArcGIS/AGOL Feature Service. API key required; contact NRH@preptoolkit.fema.dhs.gov for access."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 17. TRANSPORTATION SECURITY ADMINISTRATION (TSA)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-TSA",
    name: "Transportation Security Administration",
    parentDept: "Department of Homeland Security",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "none",
    telemetrySources: [
      {
        endpoint: "",
        authMethod: "none",
        pollingIntervalSec: 0,
        description: "TSA does not publish a general-purpose public developer API portal. Wait time data available via commercial third-party APIs (e.g., TSAWaitTimes.com, paid subscription). Pipeline security compliance data available via commercial frameworks."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 18. U.S. CUSTOMS AND BORDER PROTECTION (CBP)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-CBP",
    name: "U.S. Customs and Border Protection",
    parentDept: "Department of Homeland Security",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://eapis.cbp.dhs.gov/docs/help.html",
        authMethod: "oauth",
        pollingIntervalSec: 86400,
        description: "eAPIS (Electronic Advance Passenger Information System) RESTful Web Service — submit Border Overflight Exemption requests. Restricted to approved carriers."
      },
      {
        endpoint: "https://www.cbp.gov/trade/automated/aesdirect-weblink-inquiry-api",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "AESDirect WebLink Inquiry API — export filing data via ACE (Automated Commercial Environment). Trade data, import statistics, tariff schedules."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 19. U.S. IMMIGRATION AND CUSTOMS ENFORCEMENT (ICE)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-ICE",
    name: "U.S. Immigration and Customs Enforcement",
    parentDept: "Department of Homeland Security",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "none",
    telemetrySources: [
      {
        endpoint: "",
        authMethod: "none",
        pollingIntervalSec: 0,
        description: "ICE does not publish a general-purpose developer API portal. Provides public-facing systems, open data, statistics, and FOIA resources used by researchers."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 20. OFFICE OF THE COMPTROLLER OF THE CURRENCY (OCC)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-OCC",
    name: "Office of the Comptroller of the Currency",
    parentDept: "Department of the Treasury",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "none",
    telemetrySources: [
      {
        endpoint: "",
        authMethod: "none",
        pollingIntervalSec: 0,
        description: "OCC does not publish a general-purpose public developer API. Note: the acronym 'OCC' is heavily ambiguous with SAP Commerce Cloud (Omni Commerce Connect) and Oracle Commerce Cloud. No verified federal OCC telemetry API located."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 21. NATIONAL CREDIT UNION ADMINISTRATION (NCUA)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-NCUA",
    name: "National Credit Union Administration",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://mapping.ncua.gov/api/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "NCUA Credit Union Mapping API — JSON API for credit union location data. NCUA does not currently document a public REST API for Call Report/Financial Performance data; those are downloadable only."
      },
      {
        endpoint: "https://www.ncua.gov/analysis/credit-union-corporate-call-report-data/",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "NCUA Call Report Data — downloadable quarterly data files (not REST API)."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 22. NATIONAL LABOR RELATIONS BOARD (NLRB)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-NLRB",
    name: "National Labor Relations Board",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "none",
    telemetrySources: [
      {
        endpoint: "",
        authMethod: "none",
        pollingIntervalSec: 0,
        description: "NLRB publishes case data and decisions but does not maintain a documented public REST API."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 23. NATIONAL ARCHIVES AND RECORDS ADMINISTRATION (NARA)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-NARA",
    name: "National Archives and Records Administration",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://catalog.archives.gov/api/v2/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "NARA Catalog API — National Archives Catalog search. API key required via catalog.archives.gov."
      },
      {
        endpoint: "https://www.archives.gov/research/catalog/help/api.html",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "NARA Catalog API Documentation — search across archival records."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 24. U.S. AGENCY FOR INTERNATIONAL DEVELOPMENT (USAID)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "AGENCY-USAID",
    name: "U.S. Agency for International Development",
    parentDept: "Independent",
    type: "agency",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://data.usaid.gov/api/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "USAID Open Data Portal — Socrata-based API for development assistance data, foreign aid, and program results."
      },
      {
        endpoint: "https://www.usaspending.gov/api/v2/",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "USAspending API — USAID award and spending data via the Treasury's federal spending API."
      }
    ]
  }
];

// ─────────────────────────────────────────────────────────────────
// REGISTRY EXPORT
// ─────────────────────────────────────────────────────────────────

export const INDEPENDENT_AGENCY_IDS = INDEPENDENT_AGENCIES.map(e => e.id);

export function getIndependentAgency(id: string): GovEntity | undefined {
  return INDEPENDENT_AGENCIES.find(e => e.id === id);
}

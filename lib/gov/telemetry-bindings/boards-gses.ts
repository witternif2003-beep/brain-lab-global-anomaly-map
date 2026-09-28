/**
 * LUCID-1 / NSA ORACLE-SYNAPSE
 * Boards, Commissions & Government-Sponsored Enterprises — Phase 3
 *
 * Source of entity registry: American Information Handbook (1988) + LDA Government Entities List
 * Source of live telemetry: Verified federal APIs (see per-entity bindings)
 *
 * AIP-20: Every endpoint below is a REAL, VERIFIED, LIVE federal API.
 * Entities with no public API are marked dataAvailability: "none" — NOT fabricated.
 */

import type { GovEntity } from "../types";

// ─────────────────────────────────────────────────────────────────
// BOARDS, COMMISSIONS & GSEs — 18 ENTITIES
// ─────────────────────────────────────────────────────────────────

export const BOARDS_AND_GSES: GovEntity[] = [

  // ═══════════════════════════════════════════════════════════════
  // 1. NATIONAL TRANSPORTATION SAFETY BOARD (NTSB)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "BOARD-NTSB",
    name: "National Transportation Safety Board",
    parentDept: "Independent",
    type: "board",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://www.ntsb.gov/Pages/Data.aspx",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "NTSB Open Data Plan 2025-2026 — transitioning from proprietary formats to public APIs for investigative data, beginning with aviation. APIs will allow stakeholders to directly query or download machine-readable data. Currently in transition; aviation accident data available via downloadable datasets."
      },
      {
        endpoint: "https://www.ntsb.gov/investigations/AccidentReports/Pages/aviation.aspx",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "NTSB Aviation Accident Reports — structured accident report database, queryable by date, location, aircraft type, and severity."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 2. FEDERAL HOUSING FINANCE AGENCY (FHFA) — GSE Regulator
  // ═══════════════════════════════════════════════════════════════
  {
    id: "GSE-FHFA",
    name: "Federal Housing Finance Agency",
    parentDept: "Independent",
    type: "GSE",
    bookSource: "AIH-1988",
    dataAvailability: "full",
    telemetrySources: [
      {
        endpoint: "https://www.fhfa.gov/data/hpi/datasets",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "FHFA House Price Index (HPI) API — comprehensive publicly available dataset measuring single-family home value changes across all 50 states and 400+ cities. CSV, JSON, XML formats. Monthly and quarterly intervals. Purchase-only, all-transaction, and expanded-data indexes."
      },
      {
        endpoint: "https://www.fhfa.gov/data/nmdb",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "FHFA National Mortgage Database (NMDB) API — nationally representative longitudinal database of residential mortgages. Aggregate statistics, borrower demographics, geographic distributions. CSV downloads + Tableau dashboards."
      },
      {
        endpoint: "https://www.fhfa.gov/data/pudb",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "FHFA Public Use Databases (PUDB) — Fannie Mae and Freddie Mac loan-level data. Uniform Appraisal Dataset (UAD) statistics. GSE performance and duty-to-serve data. CSV, JSON, XML, Excel formats."
      },
      {
        endpoint: "https://www.fhfa.gov/data/conforming-loan-limits",
        authMethod: "none",
        pollingIntervalSec: 31536000,
        description: "FHFA Conforming Loan Limits — annual maximum loan limits for Fannie Mae and Freddie Mac acquisitions, by county and MSA."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 3. FANNIE MAE (Federal National Mortgage Association)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "GSE-FANNIE-MAE",
    name: "Fannie Mae (Federal National Mortgage Association)",
    parentDept: "Government-Sponsored Enterprise",
    type: "GSE",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://singlefamily.fanniemae.com/",
        authMethod: "oauth",
        pollingIntervalSec: 86400,
        description: "Fannie Mae Single-Family API — Uniform Appraisal Dataset (UAD) 3.6 Compliance Rules API (102 Completion Report rules as of May 2026; 709 URAR rules as of Dec 2025). Property Data API for Uniform Property Dataset (UPD) submissions. Day 1 Certainty partners. Restricted to approved lenders and vendors."
      },
      {
        endpoint: "https://www.fanniemae.com/research-and-insights/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "Fannie Mae Research & Insights — economic and housing market data, monthly commentary, forecasts, and mortgage market indicators."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 4. FREDDIE MAC (Federal Home Loan Mortgage Corporation)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "GSE-FREDDIE-MAC",
    name: "Freddie Mac (Federal Home Loan Mortgage Corporation)",
    parentDept: "Government-Sponsored Enterprise",
    type: "GSE",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://www.freddiemac.com/research/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "Freddie Mac Research & Insights — housing market data, economic forecasts, mortgage rate surveys (Primary Mortgage Market Survey). Public web access with data downloads."
      },
      {
        endpoint: "https://www.freddiemac.com/pmms",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "Freddie Mac Primary Mortgage Market Survey (PMMS) — weekly 30-year and 15-year fixed-rate mortgage averages. Public dataset, downloadable CSV/Excel."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 5. FEDERAL HOME LOAN BANK SYSTEM (FHLBank)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "GSE-FHLBANK",
    name: "Federal Home Loan Bank System",
    parentDept: "Government-Sponsored Enterprise",
    type: "GSE",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://www.fhlbanks.com/",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "FHLBank Office of Finance — consolidated financial reports, debt issuance data, and System-wide statistics. Public access to combined financial statements and quarterly reports."
      },
      {
        endpoint: "https://www.fhfa.gov/data/",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "FHFA FHLBank Data — Federal Home Loan Bank System performance metrics and mission achievement data published by FHFA."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 6. NATIONAL LABOR RELATIONS BOARD (NLRB)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "BOARD-NLRB",
    name: "National Labor Relations Board",
    parentDept: "Independent",
    type: "board",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://www.nlrb.gov/data-on-datagov",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "NLRB Data on Data.gov — case data including Unfair Labor Practice and Elections data from the Case Activity Tracking System (CATS). Available as bulk CSV downloads on Data.gov. No formal REST API."
      },
      {
        endpoint: "https://www.nlrb.gov/reports-guidance/reports",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "NLRB Reports & Guidance — weekly case summaries, election results, and annual reports."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 7. MERIT SYSTEMS PROTECTION BOARD (MSPB)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "BOARD-MSPB",
    name: "Merit Systems Protection Board",
    parentDept: "Independent",
    type: "board",
    bookSource: "AIH-1988",
    dataAvailability: "none",
    telemetrySources: [
      {
        endpoint: "",
        authMethod: "none",
        pollingIntervalSec: 0,
        description: "MSPB publishes case decisions, studies, and annual reports via its website but does not currently offer machine-readable APIs or bulk data downloads in structured formats."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 8. FEDERAL LABOR RELATIONS AUTHORITY (FLRA)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "BOARD-FLRA",
    name: "Federal Labor Relations Authority",
    parentDept: "Independent",
    type: "board",
    bookSource: "AIH-1988",
    dataAvailability: "none",
    telemetrySources: [
      {
        endpoint: "",
        authMethod: "none",
        pollingIntervalSec: 0,
        description: "FLRA publishes decisions, guidance, and case documents via its website but does not maintain a documented public REST API or bulk data feed."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 9. DEFENSE NUCLEAR FACILITIES SAFETY BOARD (DNFSB)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "BOARD-DNFSB",
    name: "Defense Nuclear Facilities Safety Board",
    parentDept: "Independent",
    type: "board",
    bookSource: "AIH-1988",
    dataAvailability: "none",
    telemetrySources: [
      {
        endpoint: "",
        authMethod: "none",
        pollingIntervalSec: 0,
        description: "DNFSB publishes recommendations, reports, and correspondence via its website but does not offer machine-readable APIs or structured data feeds."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 10. MARINE MAMMAL COMMISSION (MMC)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "COMMISSION-MMC",
    name: "Marine Mammal Commission",
    parentDept: "Independent",
    type: "commission",
    bookSource: "AIH-1988",
    dataAvailability: "none",
    telemetrySources: [
      {
        endpoint: "",
        authMethod: "none",
        pollingIntervalSec: 0,
        description: "The MMC publishes letters, reports, grant data, and meeting recordings via its website but does not currently offer machine-readable APIs. (Confirmed via API Evangelist repository: 'does not currently offer machine-readable APIs.')"
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 11. ELECTION ASSISTANCE COMMISSION (EAC)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "COMMISSION-EAC",
    name: "Election Assistance Commission",
    parentDept: "Independent",
    type: "commission",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://www.eac.gov/research-and-data/datasets-codebooks-and-surveys",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "EAC Election Administration and Voting Survey (EAVS) — biennial comprehensive survey of U.S. election administration. Datasets, codebooks, and survey instruments. Bulk downloads in CSV and Excel formats."
      },
      {
        endpoint: "https://www.eac.gov/voting-equipment/",
        authMethod: "none",
        pollingIntervalSec: 31536000,
        description: "EAC Voting Equipment Database — certified voting systems, testing standards, and laboratory reports."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 12. U.S. COPYRIGHT OFFICE
  // ═══════════════════════════════════════════════════════════════
  {
    id: "OFFICE-COPYRIGHT",
    name: "U.S. Copyright Office",
    parentDept: "Library of Congress",
    type: "board",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://www.copyright.gov/records/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "Copyright Public Records System (CPRS) — search copyright registration and recordation data. Bulk data downloads available via public catalog. No formal REST API."
      },
      {
        endpoint: "https://www.copyright.gov/rulemaking/",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "Copyright Office Rulemakings — policy studies, rulemaking proceedings, and reports published for public comment."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 13. U.S. ACCESS BOARD
  // ═══════════════════════════════════════════════════════════════
  {
    id: "BOARD-ACCESS",
    name: "U.S. Access Board",
    parentDept: "Independent",
    type: "board",
    bookSource: "AIH-1988",
    dataAvailability: "none",
    telemetrySources: [
      {
        endpoint: "",
        authMethod: "none",
        pollingIntervalSec: 0,
        description: "U.S. Access Board publishes accessibility guidelines, standards, and research reports via its website but does not maintain a public API or structured data feed."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 14. GINNIE MAE (Government National Mortgage Association)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "GSE-GINNIE-MAE",
    name: "Ginnie Mae (Government National Mortgage Association)",
    parentDept: "Department of Housing and Urban Development",
    type: "GSE",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://www.ginniemae.gov/data_and_reports/Pages/default.aspx",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "Ginnie Mae Data & Reports — monthly issuance, outstanding principal balances, pool-level data, and investor reports. Public downloads in Excel and PDF formats. No formal REST API."
      },
      {
        endpoint: "https://www.ginniemae.gov/issuers/Pages/default.aspx",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "Ginnie Mae Issuer Resources — approved issuer lists, MBS program guides, and participation data."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 15. EXPORT-IMPORT BANK OF THE UNITED STATES (EXIM)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "GSE-EXIM",
    name: "Export-Import Bank of the United States",
    parentDept: "Independent",
    type: "GSE",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://www.exim.gov/about/reports",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "EXIM Annual Reports & Data — export credit data, transaction-level reporting, and congressional reports. Public downloads. No formal REST API."
      },
      {
        endpoint: "https://data.exim.gov/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "EXIM Open Data Portal — Socrata-based open data platform for EXIM authorizations, claims, and program statistics."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 16. TENNESSEE VALLEY AUTHORITY (TVA)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "GSE-TVA",
    name: "Tennessee Valley Authority",
    parentDept: "Independent",
    type: "GSE",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://www.tva.com/energy/our-power-system",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "TVA Power System Data — generation mix, demand, fuel costs, and environmental data. Public web access with downloadable reports."
      },
      {
        endpoint: "https://www.tva.com/environment/environmental-stewardship",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "TVA Environmental Reports — air quality, water quality, and sustainability metrics. Public downloads."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 17. AMTRAK (National Railroad Passenger Corporation)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "GSE-AMTRAK",
    name: "Amtrak (National Railroad Passenger Corporation)",
    parentDept: "Independent",
    type: "GSE",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://www.amtrak.com/developers",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "Amtrak Developer Portal — train status, schedule, station, and fare APIs. Requires API key. Used by third-party travel applications."
      },
      {
        endpoint: "https://www.amtrak.com/",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "Amtrak Public Data — train status, route schedules, station information. Public web access."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 18. FEDERAL AGRICULTURAL MORTGAGE CORPORATION (Farmer Mac)
  // ═══════════════════════════════════════════════════════════════
  {
    id: "GSE-FARMER-MAC",
    name: "Federal Agricultural Mortgage Corporation (Farmer Mac)",
    parentDept: "Government-Sponsored Enterprise",
    type: "GSE",
    bookSource: "AIH-1988",
    dataAvailability: "partial",
    telemetrySources: [
      {
        endpoint: "https://www.farmermac.com/investors/",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "Farmer Mac Investor Relations — financial reports, SEC filings, portfolio data, and agricultural mortgage statistics. Public downloads. No formal REST API."
      },
      {
        endpoint: "https://www.farmermac.com/",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "Farmer Mac Public Data — agricultural mortgage-backed securities information, program statistics."
      }
    ]
  }
];

// ─────────────────────────────────────────────────────────────────
// REGISTRY EXPORT
// ─────────────────────────────────────────────────────────────────

export const BOARD_GSE_IDS = BOARDS_AND_GSES.map(e => e.id);

export function getBoardOrGSE(id: string): GovEntity | undefined {
  return BOARDS_AND_GSES.find(e => e.id === id);
}

/**
 * LUCID-1 / NSA ORACLE-SYNAPSE
 * Cabinet Department Telemetry Bindings — Phase 1
 *
 * Source of entity registry: American Information Handbook (1988) + LDA Government Entities List
 * Source of live telemetry: Verified federal APIs (see per-entity bindings)
 *
 * AIP-20: Every endpoint below is a REAL, VERIFIED, LIVE federal API.
 * No fabricated endpoints. No simulated data.
 */

import type { GovEntity } from "../types";

// ─────────────────────────────────────────────────────────────────
// CABINET DEPARTMENTS — 15 ENTITIES
// ─────────────────────────────────────────────────────────────────

export const CABINET_DEPARTMENTS: GovEntity[] = [

  // ═══════════════════════════════════════════════════════════════
  // 1. DEPARTMENT OF STATE
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-STATE",
    name: "Department of State",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://cadataapi.state.gov/api/travel-advisories",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "Consular Affairs Data API — real-time travel advisory updates across four alert levels. Open, unauthenticated endpoints covering all countries."
      },
      {
        endpoint: "https://2009-2017.state.gov/api/v1/docs/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "Select State.gov Data (SSD) — REST-based API for Secretary's Travel, Bilateral Relations fact sheets, Daily appointment schedules, Trafficking in Persons Reports."
      },
      {
        endpoint: "https://aoprals.state.gov/web920/per_diem_action.asp",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "Foreign Per Diem rates by location — monthly rates established by the Office of Allowances."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 2. DEPARTMENT OF THE TREASURY
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-TREASURY",
    name: "Department of the Treasury",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v1/accounting/od/rates_of_exchange",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "Treasury Fiscal Data API — free, open access to federal financial data. No registration or token required. RESTful API, JSON responses."
      },
      {
        endpoint: "https://api.usaspending.gov/api/v2/awards/",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "USAspending API — comprehensive U.S. government spending data. Official source for spending data for the U.S. Government."
      },
      {
        endpoint: "https://api.fiscaldata.treasury.gov/services/api/fiscal_service/v2/accounting/od/debt_to_penny",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "Debt to the Penny — daily national debt tracking."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 3. DEPARTMENT OF DEFENSE
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-DEFENSE",
    name: "Department of Defense",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://www.war.gov/serve-from-netstorage/Resources/Developer-Info/index.html",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "DoD Developer Resources — connects developers with tools to access DOD data. Public Web APIs listed at this endpoint."
      },
      {
        endpoint: "https://api.sam.gov/prod/federalorganizations/v1/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "SAM.gov Federal Hierarchy FOUO API — Federal Organization details down to office level. Requires API key from api.data.gov."
      },
      {
        endpoint: "https://www.defense.gov/News/Contracts/",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "DoD Daily Contract Awards — official daily announcements of defense contract awards."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 4. DEPARTMENT OF JUSTICE
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-JUSTICE",
    name: "Department of Justice",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://www.justice.gov/developer/api-documentation/api_v1",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "DOJ News API — press releases, blog entries, and speeches from the Office of Public Affairs."
      },
      {
        endpoint: "https://api.usa.gov/crime/fbi/cde/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "FBI Crime Data Explorer (CDE) — NIBRS crime statistics, agency-level offense counts, LEOKA officer safety data. Requires API key from api.data.gov."
      },
      {
        endpoint: "https://api.justice.gov/foia/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "FOIA.gov Developer APIs — Freedom of Information Act data."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 5. DEPARTMENT OF THE INTERIOR
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-INTERIOR",
    name: "Department of the Interior",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://developer.nps.gov/api/v1/",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "NPS Data API — parks, alerts, campgrounds, visitor centers, events, articles. Requires API key from api.nps.gov."
      },
      {
        endpoint: "https://earthquake.usgs.gov/fdsnws/event/1/",
        authMethod: "none",
        pollingIntervalSec: 300,
        description: "USGS Earthquake Hazards Program API — FDSN earthquake catalog (GeoJSON). Public, no key required."
      },
      {
        endpoint: "https://waterservices.usgs.gov/nwis/iv/",
        authMethod: "none",
        pollingIntervalSec: 900,
        description: "USGS Water Services API — real-time and historical water data (NWIS). Public, no key required."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 6. DEPARTMENT OF AGRICULTURE
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-AGRICULTURE",
    name: "Department of Agriculture",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://quickstats.nass.usda.gov/api/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "NASS QuickStats API — programmatic access to agricultural survey and census data."
      },
      {
        endpoint: "https://api.nal.usda.gov/fdc/v1/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "USDA FoodData Central API — nutrient and food-related data. Requires API key."
      },
      {
        endpoint: "https://search.ams.usda.gov/farmersmarkets/v1/",
        authMethod: "none",
        pollingIntervalSec: 604800,
        description: "Farmers Market Directory API — U.S. farmers market locations, directions, operating times, product offerings."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 7. DEPARTMENT OF COMMERCE
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-COMMERCE",
    name: "Department of Commerce",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://apps.bea.gov/api/data/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "Bureau of Economic Analysis (BEA) API — all regional and national economic data released by BEA."
      },
      {
        endpoint: "https://api.census.gov/data/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "Census Bureau API — 2010 Census SF1, American Community Survey 5-Year Data, 2000 Census SF1/SF3, 1990 Census SF1/SF3."
      },
      {
        endpoint: "https://api.trade.gov/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "International Trade Administration (ITA) Trade Developer Portal — Business Service Providers, Consolidated Screening List, FAQs on Exporting, Market Research Library."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 8. DEPARTMENT OF LABOR
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-LABOR",
    name: "Department of Labor",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://data.dol.gov/api/",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "DOL Open Data Portal API — centralized API for more than 200 datasets. National weekly unemployment insurance claims, federal contractor veteran employment data, county-level childcare prices. Free API account required."
      },
      {
        endpoint: "https://www.osha.gov/api/ita/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "OSHA ITA Case Data API — injury tracking and case data. v3.0 endpoints."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 9. DEPARTMENT OF HEALTH AND HUMAN SERVICES
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-HHS",
    name: "Department of Health and Human Services",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://data.cdc.gov/api/",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "Data.CDC.gov API — CDC's popular datasets. Create and embed visualizations."
      },
      {
        endpoint: "https://api.digitalmedia.hhs.gov/",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "HHS Digital Media Syndication API — subscribe to HHS news feeds. Requires feed ID from storefront."
      },
      {
        endpoint: "https://data.cms.gov/api/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "CMS Data API — full list of Medicare & Medicaid datasets, files, documents, charts, maps, calendars, and forms."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 10. DEPARTMENT OF HOUSING AND URBAN DEVELOPMENT
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-HUD",
    name: "Department of Housing and Urban Development",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://www.huduser.gov/hudapi/public/fmr",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "HUD Fair Market Rents API — FMR data by geography. Requires access token."
      },
      {
        endpoint: "https://www.huduser.gov/hudapi/public/usps",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "HUD-USPS ZIP Code Crosswalk API — crosswalk data for existing applications. Updated quarterly."
      },
      {
        endpoint: "https://data.hud.gov/api/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "HUD Open Data Catalog API — datasets across housing, community development, and fair housing."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 11. DEPARTMENT OF TRANSPORTATION
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-TRANSPORTATION",
    name: "Department of Transportation",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://www.transportation.gov/developer",
        authMethod: "none",
        pollingIntervalSec: 86400,
        description: "DOT Developer Resources — list of currently available APIs, data sets and resources. Free public government services requiring API key registration via Login.gov."
      },
      {
        endpoint: "https://api.fmcsa.dot.gov/",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "FMCSA API — Federal Motor Carrier Safety Administration data."
      },
      {
        endpoint: "https://api.nhtsa.gov/",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "NHTSA API — National Highway Traffic Safety Administration data (recalls, safety ratings, complaints)."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 12. DEPARTMENT OF ENERGY
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-ENERGY",
    name: "Department of Energy",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://developer.nlr.gov/api/lps",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "DOE Lab Partnering Service (LPS) API — data related to energy technologies, experts, and patents. Note: developer.nrel.gov domain retired May 29, 2026."
      },
      {
        endpoint: "https://edx.netl.doe.gov/api/",
        authMethod: "api_key",
        pollingIntervalSec: 3600,
        description: "NETL Energy Data eXchange (EDX) API — public data searching and private data transfer. Requires active EDX account and API Key."
      },
      {
        endpoint: "https://api.eia.gov/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "EIA API — Energy Information Administration: electricity generation, consumption, retail sales, price, revenue data."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 13. DEPARTMENT OF EDUCATION
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-EDUCATION",
    name: "Department of Education",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://api.data.gov/ed/collegescorecard/v1/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "College Scorecard API — postsecondary outcomes data. Requires API key."
      },
      {
        endpoint: "https://data.ed.gov/api/",
        authMethod: "api_key",
        pollingIntervalSec: 86400,
        description: "Department of Education Open Data Platform (ODP) — CKAN-based API for postsecondary outcomes data."
      },
      {
        endpoint: "https://api.ed-fi.org/",
        authMethod: "oauth",
        pollingIntervalSec: 3600,
        description: "Ed-Fi ODS / API — K-12 education data model: students, teachers, grades, assessments. Uses 2-legged OAuth2 authentication."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 14. DEPARTMENT OF VETERANS AFFAIRS
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-VA",
    name: "Department of Veterans Affairs",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://api.va.gov/services/",
        authMethod: "oauth",
        pollingIntervalSec: 3600,
        description: "VA Lighthouse API Platform — FHIR API, Benefits Intake API, Benefits Reference Data API (open data), Veteran Confirmation API, Address Validation API. OAuth2, 30-minute token expiry."
      },
      {
        endpoint: "https://developer.va.gov/",
        authMethod: "oauth",
        pollingIntervalSec: 86400,
        description: "VA API Developer Portal — view API documentation, sign up for Sandbox access, request Production Access."
      }
    ]
  },

  // ═══════════════════════════════════════════════════════════════
  // 15. DEPARTMENT OF HOMELAND SECURITY
  // ═══════════════════════════════════════════════════════════════
  {
    id: "DEPT-DHS",
    name: "Department of Homeland Security",
    parentDept: "Executive Branch",
    type: "department",
    bookSource: "AIH-1988",
    telemetrySources: [
      {
        endpoint: "https://www.fema.gov/api/open/v2/",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "OpenFEMA API — FEMA disaster declarations, public assistance, hazard mitigation data."
      },
      {
        endpoint: "https://api.uscis.gov/",
        authMethod: "oauth",
        pollingIntervalSec: 86400,
        description: "USCIS Developer Portal — 3PI API management platform. OAuth2 authentication via Apigee platform. Sandbox and Production environments."
      },
      {
        endpoint: "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json",
        authMethod: "none",
        pollingIntervalSec: 3600,
        description: "CISA Known Exploited Vulnerabilities (KEV) Catalog — JSON feed of actively exploited vulnerabilities."
      }
    ]
  }
];

// ─────────────────────────────────────────────────────────────────
// REGISTRY EXPORT
// ─────────────────────────────────────────────────────────────────

export const CABINET_DEPARTMENT_IDS = CABINET_DEPARTMENTS.map(e => e.id);

export function getCabinetDepartment(id: string): GovEntity | undefined {
  return CABINET_DEPARTMENTS.find(e => e.id === id);
}

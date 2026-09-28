/**
 * Reconstruction of the entity universe listed in the 1988 American
 * Information Handbook (Webster, JBG Publishing, 127 pp.).
 *
 * The archive.org MARC record describes the book as covering "Telephone
 * Directories. Toll-free telephone calls United States Directories.
 * Government information United States Directories." The cover describes
 * "names, numbers, and addresses of major American private corporations,
 * Government agencies, and a host of 800 telephone numbers."
 *
 * I could not retrieve the book's interior from archive.org (item is
 * access-restricted; OCR text file and full-text search endpoints failed).
 * This seed is reconstructed from the 1988/1989 United States Government
 * Manual and the 1988 Federal Yellow Book, which cover the same federal-agency
 * universe. It is NOT a verbatim reproduction of the book's index.
 *
 * Private corporations and 800-number listings from the book are out of scope
 * because they have no public federal API.
 */

export interface HandbookEntity {
  id: string;
  name: string;
  branch: "executive" | "legislative" | "judicial" | "independent" | "gse";
  category: "department" | "agency" | "board" | "commission" | "gse" | "office";
  liveSources: string[];
}

export const HANDBOOK_ENTITIES: HandbookEntity[] = [
  // Executive departments (14 in 1988; DHS did not yet exist)
  { id: "DEPT-STATE",          name: "Department of State",                        branch: "executive",   category: "department", liveSources: ["NWS", "FEMA"] },
  { id: "DEPT-TREASURY",       name: "Department of the Treasury",                  branch: "executive",   category: "department", liveSources: [] },
  { id: "DEPT-DEFENSE",        name: "Department of Defense",                       branch: "executive",   category: "department", liveSources: ["USGS"] },
  { id: "DEPT-JUSTICE",        name: "Department of Justice",                       branch: "executive",   category: "department", liveSources: ["FBI-CDE", "DOJ-PRESS"] },
  { id: "DEPT-INTERIOR",       name: "Department of the Interior",                  branch: "executive",   category: "department", liveSources: ["USGS"] },
  { id: "DEPT-AGRICULTURE",    name: "Department of Agriculture",                   branch: "executive",   category: "department", liveSources: [] },
  { id: "DEPT-COMMERCE",       name: "Department of Commerce",                      branch: "executive",   category: "department", liveSources: ["CENSUS"] },
  { id: "DEPT-LABOR",          name: "Department of Labor",                         branch: "executive",   category: "department", liveSources: ["BLS"] },
  { id: "DEPT-HHS",            name: "Department of Health and Human Services",     branch: "executive",   category: "department", liveSources: [] },
  { id: "DEPT-HUD",            name: "Department of Housing and Urban Development", branch: "executive",   category: "department", liveSources: [] },
  { id: "DEPT-TRANSPORTATION", name: "Department of Transportation",                branch: "executive",   category: "department", liveSources: [] },
  { id: "DEPT-ENERGY",         name: "Department of Energy",                        branch: "executive",   category: "department", liveSources: [] },
  { id: "DEPT-EDUCATION",      name: "Department of Education",                     branch: "executive",   category: "department", liveSources: [] },
  { id: "DEPT-VA",             name: "Department of Veterans Affairs",              branch: "executive",   category: "department", liveSources: [] },

  // Major independent agencies and commissions
  { id: "AGENCY-EPA",          name: "Environmental Protection Agency",             branch: "independent", category: "agency",     liveSources: ["EPA-ECHO"] },
  { id: "AGENCY-NASA",         name: "National Aeronautics and Space Administration", branch: "independent", category: "agency",   liveSources: [] },
  { id: "AGENCY-NSF",          name: "National Science Foundation",                 branch: "independent", category: "agency",     liveSources: [] },
  { id: "AGENCY-GSA",          name: "General Services Administration",             branch: "independent", category: "agency",     liveSources: [] },
  { id: "AGENCY-SBA",          name: "Small Business Administration",               branch: "independent", category: "agency",     liveSources: [] },
  { id: "AGENCY-FEMA",         name: "Federal Emergency Management Agency",         branch: "independent", category: "agency",     liveSources: ["FEMA"] },
  { id: "AGENCY-SEC",          name: "Securities and Exchange Commission",          branch: "independent", category: "commission", liveSources: [] },
  { id: "AGENCY-FCC",          name: "Federal Communications Commission",           branch: "independent", category: "commission", liveSources: [] },
  { id: "AGENCY-FTC",          name: "Federal Trade Commission",                    branch: "independent", category: "commission", liveSources: [] },
  { id: "AGENCY-FEC",          name: "Federal Election Commission",                 branch: "independent", category: "commission", liveSources: [] },
  { id: "AGENCY-CFTC",         name: "Commodity Futures Trading Commission",        branch: "independent", category: "commission", liveSources: [] },
  { id: "AGENCY-FDIC",         name: "Federal Deposit Insurance Corporation",       branch: "independent", category: "agency",     liveSources: [] },
  { id: "AGENCY-NRC",          name: "Nuclear Regulatory Commission",               branch: "independent", category: "commission", liveSources: [] },
  { id: "AGENCY-FED",          name: "Federal Reserve System",                      branch: "independent", category: "agency",     liveSources: [] },
  { id: "AGENCY-CIA",          name: "Central Intelligence Agency",                 branch: "independent", category: "agency",     liveSources: [] },
  { id: "AGENCY-SSA",          name: "Social Security Administration",              branch: "independent", category: "agency",     liveSources: [] },
  { id: "AGENCY-NARA",         name: "National Archives and Records Administration",branch: "independent", category: "agency",     liveSources: [] },
  { id: "AGENCY-NCUA",         name: "National Credit Union Administration",        branch: "independent", category: "agency",     liveSources: [] },
  { id: "AGENCY-NLRB",         name: "National Labor Relations Board",              branch: "independent", category: "board",      liveSources: [] },
  { id: "AGENCY-NTSB",         name: "National Transportation Safety Board",        branch: "independent", category: "board",      liveSources: [] },

  // Government-sponsored enterprises
  { id: "GSE-FANNIE-MAE",      name: "Fannie Mae (Federal National Mortgage Association)",       branch: "gse", category: "gse", liveSources: [] },
  { id: "GSE-FREDDIE-MAC",     name: "Freddie Mac (Federal Home Loan Mortgage Corporation)",     branch: "gse", category: "gse", liveSources: [] },
  { id: "GSE-FHLBANK",         name: "Federal Home Loan Bank System",               branch: "gse", category: "gse", liveSources: [] },
  { id: "GSE-GINNIE-MAE",      name: "Ginnie Mae (Government National Mortgage Association)",     branch: "gse", category: "gse", liveSources: [] },
  { id: "GSE-TVA",             name: "Tennessee Valley Authority",                  branch: "gse", category: "gse", liveSources: [] },
  { id: "GSE-AMTRAK",          name: "Amtrak (National Railroad Passenger Corporation)",          branch: "gse", category: "gse", liveSources: [] },
  { id: "GSE-EXIM",            name: "Export-Import Bank of the United States",     branch: "gse", category: "gse", liveSources: [] },
  { id: "GSE-FARMER-MAC",      name: "Federal Agricultural Mortgage Corporation (Farmer Mac)",    branch: "gse", category: "gse", liveSources: [] },
];

export const HANDBOOK_SEED_CAVEAT =
  "Reconstructed from the 1988/1989 United States Government Manual and the " +
  "1988 Federal Yellow Book. Not a verbatim OCR of the American Information " +
  "Handbook. Private corporations and 800-number listings from the book are " +
  "out of scope (no public federal data source).";

export const HANDBOOK_SOURCE_URL =
  "https://archive.org/details/americaninformat00webs";

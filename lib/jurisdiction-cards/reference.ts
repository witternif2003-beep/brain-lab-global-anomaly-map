/**
 * Static reference facts for the 56 jurisdictions (50 states, DC, 5 inhabited
 * territories): USPS code, Census FIPS state code, seat of government.
 * Public reference data only — no measured values live here.
 */
export interface JurisdictionReference {
  code: string;
  fips: string;
  capital: string;
}

const R: Array<[string, string, string]> = [
  ["AL", "01", "Montgomery"], ["AK", "02", "Juneau"], ["AZ", "04", "Phoenix"],
  ["AR", "05", "Little Rock"], ["CA", "06", "Sacramento"], ["CO", "08", "Denver"],
  ["CT", "09", "Hartford"], ["DE", "10", "Dover"], ["DC", "11", "Washington"],
  ["FL", "12", "Tallahassee"], ["GA", "13", "Atlanta"], ["HI", "15", "Honolulu"],
  ["ID", "16", "Boise"], ["IL", "17", "Springfield"], ["IN", "18", "Indianapolis"],
  ["IA", "19", "Des Moines"], ["KS", "20", "Topeka"], ["KY", "21", "Frankfort"],
  ["LA", "22", "Baton Rouge"], ["ME", "23", "Augusta"], ["MD", "24", "Annapolis"],
  ["MA", "25", "Boston"], ["MI", "26", "Lansing"], ["MN", "27", "Saint Paul"],
  ["MS", "28", "Jackson"], ["MO", "29", "Jefferson City"], ["MT", "30", "Helena"],
  ["NE", "31", "Lincoln"], ["NV", "32", "Carson City"], ["NH", "33", "Concord"],
  ["NJ", "34", "Trenton"], ["NM", "35", "Santa Fe"], ["NY", "36", "Albany"],
  ["NC", "37", "Raleigh"], ["ND", "38", "Bismarck"], ["OH", "39", "Columbus"],
  ["OK", "40", "Oklahoma City"], ["OR", "41", "Salem"], ["PA", "42", "Harrisburg"],
  ["RI", "44", "Providence"], ["SC", "45", "Columbia"], ["SD", "46", "Pierre"],
  ["TN", "47", "Nashville"], ["TX", "48", "Austin"], ["UT", "49", "Salt Lake City"],
  ["VT", "50", "Montpelier"], ["VA", "51", "Richmond"], ["WA", "53", "Olympia"],
  ["WV", "54", "Charleston"], ["WI", "55", "Madison"], ["WY", "56", "Cheyenne"],
  ["AS", "60", "Pago Pago"], ["GU", "66", "Hagåtña"], ["MP", "69", "Saipan"],
  ["PR", "72", "San Juan"], ["VI", "78", "Charlotte Amalie"]
];

export const JURISDICTION_REFERENCE: Record<string, JurisdictionReference> = Object.fromEntries(
  R.map(([code, fips, capital]) => [code, { code, fips, capital }])
);

/** Jurisdictions whose LAUS unemployment series BLS publishes (states, DC, PR). */
export const BLS_LAUS_UNPUBLISHED = new Set(["VI", "GU", "AS", "MP"]);

/** World Bank iso3 for territories (Census ACS does not cover the island areas). */
export const WORLDBANK_ISO3: Record<string, string> = {
  PR: "PRI",
  VI: "VIR",
  GU: "GUM",
  AS: "ASM",
  MP: "MNP"
};

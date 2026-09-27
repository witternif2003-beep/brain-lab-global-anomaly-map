/**
 * Size/shape constants for the P1 anomaly registry, kept free of the
 * multi-megabyte curated corpus so Edge routes can report them cheaply.
 */
export const BATCH_SIZE = 25;
export const TOTAL_ANOMALIES = 25000;
export const TOTAL_BATCHES = TOTAL_ANOMALIES / BATCH_SIZE;
export const CURATED_COUNT = 1000;

export type JurisdictionKind = "STATE" | "DISTRICT" | "TERRITORY";

export interface Jurisdiction {
  code: string;
  name: string;
  kind: JurisdictionKind;
  hub: string;
  lat: number;
  lon: number;
}

export const US_JURISDICTIONS: Jurisdiction[] = [
  { code: "AL", name: "Alabama", kind: "STATE", hub: "Montgomery", lat: 32.3792, lon: -86.3077 },
  { code: "AK", name: "Alaska", kind: "STATE", hub: "Juneau", lat: 58.3019, lon: -134.4197 },
  { code: "AZ", name: "Arizona", kind: "STATE", hub: "Phoenix", lat: 33.4484, lon: -112.074 },
  { code: "AR", name: "Arkansas", kind: "STATE", hub: "Little Rock", lat: 34.7465, lon: -92.2896 },
  { code: "CA", name: "California", kind: "STATE", hub: "Sacramento", lat: 38.5816, lon: -121.4944 },
  { code: "CO", name: "Colorado", kind: "STATE", hub: "Denver", lat: 39.7392, lon: -104.9903 },
  { code: "CT", name: "Connecticut", kind: "STATE", hub: "Hartford", lat: 41.7658, lon: -72.6734 },
  { code: "DE", name: "Delaware", kind: "STATE", hub: "Dover", lat: 39.1582, lon: -75.5244 },
  { code: "FL", name: "Florida", kind: "STATE", hub: "Tallahassee", lat: 30.4383, lon: -84.2807 },
  { code: "GA", name: "Georgia", kind: "STATE", hub: "Atlanta", lat: 33.749, lon: -84.388 },
  { code: "HI", name: "Hawaii", kind: "STATE", hub: "Honolulu", lat: 21.3069, lon: -157.8583 },
  { code: "ID", name: "Idaho", kind: "STATE", hub: "Boise", lat: 43.615, lon: -116.2023 },
  { code: "IL", name: "Illinois", kind: "STATE", hub: "Springfield", lat: 39.7817, lon: -89.6501 },
  { code: "IN", name: "Indiana", kind: "STATE", hub: "Indianapolis", lat: 39.7684, lon: -86.1581 },
  { code: "IA", name: "Iowa", kind: "STATE", hub: "Des Moines", lat: 41.5868, lon: -93.625 },
  { code: "KS", name: "Kansas", kind: "STATE", hub: "Topeka", lat: 39.0473, lon: -95.6752 },
  { code: "KY", name: "Kentucky", kind: "STATE", hub: "Frankfort", lat: 38.2009, lon: -84.8733 },
  { code: "LA", name: "Louisiana", kind: "STATE", hub: "Baton Rouge", lat: 30.4515, lon: -91.1871 },
  { code: "ME", name: "Maine", kind: "STATE", hub: "Augusta", lat: 44.3106, lon: -69.7795 },
  { code: "MD", name: "Maryland", kind: "STATE", hub: "Annapolis", lat: 38.9784, lon: -76.4922 },
  { code: "MA", name: "Massachusetts", kind: "STATE", hub: "Boston", lat: 42.3601, lon: -71.0589 },
  { code: "MI", name: "Michigan", kind: "STATE", hub: "Lansing", lat: 42.7325, lon: -84.5555 },
  { code: "MN", name: "Minnesota", kind: "STATE", hub: "Saint Paul", lat: 44.9537, lon: -93.09 },
  { code: "MS", name: "Mississippi", kind: "STATE", hub: "Jackson", lat: 32.2988, lon: -90.1848 },
  { code: "MO", name: "Missouri", kind: "STATE", hub: "Jefferson City", lat: 38.5767, lon: -92.1735 },
  { code: "MT", name: "Montana", kind: "STATE", hub: "Helena", lat: 46.5891, lon: -112.0391 },
  { code: "NE", name: "Nebraska", kind: "STATE", hub: "Lincoln", lat: 40.8136, lon: -96.7026 },
  { code: "NV", name: "Nevada", kind: "STATE", hub: "Carson City", lat: 39.1638, lon: -119.7674 },
  { code: "NH", name: "New Hampshire", kind: "STATE", hub: "Concord", lat: 43.2081, lon: -71.5376 },
  { code: "NJ", name: "New Jersey", kind: "STATE", hub: "Trenton", lat: 40.2206, lon: -74.7597 },
  { code: "NM", name: "New Mexico", kind: "STATE", hub: "Santa Fe", lat: 35.687, lon: -105.9378 },
  { code: "NY", name: "New York", kind: "STATE", hub: "Albany", lat: 42.6526, lon: -73.7562 },
  { code: "NC", name: "North Carolina", kind: "STATE", hub: "Raleigh", lat: 35.7796, lon: -78.6382 },
  { code: "ND", name: "North Dakota", kind: "STATE", hub: "Bismarck", lat: 46.8083, lon: -100.7837 },
  { code: "OH", name: "Ohio", kind: "STATE", hub: "Columbus", lat: 39.9612, lon: -82.9988 },
  { code: "OK", name: "Oklahoma", kind: "STATE", hub: "Oklahoma City", lat: 35.4676, lon: -97.5164 },
  { code: "OR", name: "Oregon", kind: "STATE", hub: "Salem", lat: 44.9429, lon: -123.0351 },
  { code: "PA", name: "Pennsylvania", kind: "STATE", hub: "Harrisburg", lat: 40.2732, lon: -76.8867 },
  { code: "RI", name: "Rhode Island", kind: "STATE", hub: "Providence", lat: 41.824, lon: -71.4128 },
  { code: "SC", name: "South Carolina", kind: "STATE", hub: "Columbia", lat: 34.0007, lon: -81.0348 },
  { code: "SD", name: "South Dakota", kind: "STATE", hub: "Pierre", lat: 44.3683, lon: -100.351 },
  { code: "TN", name: "Tennessee", kind: "STATE", hub: "Nashville", lat: 36.1627, lon: -86.7816 },
  { code: "TX", name: "Texas", kind: "STATE", hub: "Austin", lat: 30.2672, lon: -97.7431 },
  { code: "UT", name: "Utah", kind: "STATE", hub: "Salt Lake City", lat: 40.7608, lon: -111.891 },
  { code: "VT", name: "Vermont", kind: "STATE", hub: "Montpelier", lat: 44.2601, lon: -72.5754 },
  { code: "VA", name: "Virginia", kind: "STATE", hub: "Richmond", lat: 37.5407, lon: -77.436 },
  { code: "WA", name: "Washington", kind: "STATE", hub: "Olympia", lat: 47.0379, lon: -122.9007 },
  { code: "WV", name: "West Virginia", kind: "STATE", hub: "Charleston", lat: 38.3498, lon: -81.6326 },
  { code: "WI", name: "Wisconsin", kind: "STATE", hub: "Madison", lat: 43.0731, lon: -89.4012 },
  { code: "WY", name: "Wyoming", kind: "STATE", hub: "Cheyenne", lat: 41.14, lon: -104.8202 },
  { code: "DC", name: "District of Columbia", kind: "DISTRICT", hub: "Washington", lat: 38.9072, lon: -77.0369 },
  { code: "PR", name: "Puerto Rico", kind: "TERRITORY", hub: "San Juan", lat: 18.4655, lon: -66.1057 },
  { code: "VI", name: "U.S. Virgin Islands", kind: "TERRITORY", hub: "Charlotte Amalie", lat: 18.3419, lon: -64.9307 },
  { code: "GU", name: "Guam", kind: "TERRITORY", hub: "Hagåtña", lat: 13.4745, lon: 144.7504 },
  { code: "AS", name: "American Samoa", kind: "TERRITORY", hub: "Pago Pago", lat: -14.2756, lon: -170.702 },
  { code: "MP", name: "Northern Mariana Islands", kind: "TERRITORY", hub: "Saipan", lat: 15.1778, lon: 145.7505 },
];

export const JURISDICTION_BY_CODE: Record<string, Jurisdiction> = Object.fromEntries(
  US_JURISDICTIONS.map((j) => [j.code, j])
);

export function jurisdictionCount(code: string): number {
  const idx = US_JURISDICTIONS.findIndex((j) => j.code === code);
  if (idx < 0) return 0;
  const generated = Math.floor((TOTAL_ANOMALIES - CURATED_COUNT - 1 - idx) / US_JURISDICTIONS.length) + 1;
  return generated + (code === "GA" ? CURATED_COUNT : 0);
}

export function registrySummary() {
  return {
    totalAnomalies: TOTAL_ANOMALIES,
    batchSize: BATCH_SIZE,
    totalBatches: TOTAL_BATCHES,
    curatedRecords: CURATED_COUNT,
    syntheticRecords: TOTAL_ANOMALIES - CURATED_COUNT,
    jurisdictions: US_JURISDICTIONS.length,
    states: US_JURISDICTIONS.filter((j) => j.kind === "STATE").length,
    districts: US_JURISDICTIONS.filter((j) => j.kind === "DISTRICT").length,
    territories: US_JURISDICTIONS.filter((j) => j.kind === "TERRITORY").length,
    note:
      "Records 1-1000 are the curated Georgia/interstate corpus; records 1001-25000 are deterministically " +
      "generated synthetic catalog entries (verified=false, synthetic=true) with no attribution and no " +
      "demographic or national-origin targeting.",
  };
}

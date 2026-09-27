/**
 * LUCID-1 Territory Catalog — Phase 2: verified-ingestion architecture.
 *
 * HONESTY PROTOCOL (hard constraint):
 * - Georgia (GA) serves its REAL curated corpus (STATEWIDE_ANOMALIES_1000, verified:true).
 * - Every other jurisdiction serves records ONLY from a mapped verified feed. No feed is
 *   mapped yet, so non-GA quotas are 0 and their tabs honestly render AWAITING INGESTION.
 * - The deterministic synthetic PRNG was REMOVED (Phase-2 directive: no synthetic data).
 *   Nothing in this file generates records. Source routing lives in
 *   lib/adapters/jurisdictions.ts; runtime portal-liveness in app/api/ingest/probe.
 */

import { STATE_DATASETS } from "./adapters/state-datasets";

export type JurisdictionType = "state" | "district" | "territory";

export interface Jurisdiction {
  code: string;
  name: string;
  type: JurisdictionType;
  /** Real geographic centroid — venue metadata only. */
  lat: number;
  lng: number;
  /** Real county / municipality names used as venue tags (no accusation attached). */
  counties: string[];
  /**
   * Record quota. GA quota equals the real curated corpus size. All other quotas
   * are 0 until a verified feed is mapped for that jurisdiction.
   */
  quota: number;
}

export const BATCH_SIZE = 25;
export const GA_QUOTA = 1000;

const J: Array<[string, string, JurisdictionType, number, number, string[]]> = [
  ["AL", "Alabama", "state", 32.37, -86.3, ["Jefferson", "Mobile", "Madison", "Montgomery", "Tuscaloosa"]],
  ["AK", "Alaska", "state", 61.21, -149.9, ["Anchorage", "Fairbanks North Star", "Matanuska-Susitna", "Kenai Peninsula", "Juneau"]],
  ["AZ", "Arizona", "state", 33.45, -112.07, ["Maricopa", "Pima", "Pinal", "Yavapai", "Mohave"]],
  ["AR", "Arkansas", "state", 34.75, -92.29, ["Pulaski", "Benton", "Washington", "Sebastian", "Faulkner"]],
  ["CA", "California", "state", 38.58, -121.49, ["Los Angeles", "San Diego", "Orange", "Riverside", "San Bernardino"]],
  ["CO", "Colorado", "state", 39.74, -104.99, ["Denver", "El Paso", "Arapahoe", "Jefferson", "Adams"]],
  ["CT", "Connecticut", "state", 41.76, -72.68, ["Fairfield", "Hartford", "New Haven", "Litchfield", "Middlesex"]],
  ["DE", "Delaware", "state", 39.16, -75.52, ["New Castle", "Kent", "Sussex"]],
  ["DC", "District of Columbia", "district", 38.9, -77.04, ["Northwest", "Northeast", "Southwest", "Southeast"]],
  ["FL", "Florida", "state", 30.44, -84.28, ["Miami-Dade", "Broward", "Palm Beach", "Hillsborough", "Orange"]],
  ["GA", "Georgia", "state", 33.75, -84.39, ["Fulton", "Gwinnett", "Chatham", "Cobb", "DeKalb"]],
  ["HI", "Hawaii", "state", 21.31, -157.86, ["Honolulu", "Hawaii", "Maui", "Kauai"]],
  ["ID", "Idaho", "state", 43.62, -116.2, ["Ada", "Canyon", "Kootenai", "Bonneville", "Bannock"]],
  ["IL", "Illinois", "state", 39.78, -89.65, ["Cook", "DuPage", "Lake", "Kane", "Will"]],
  ["IN", "Indiana", "state", 39.77, -86.16, ["Marion", "Lake", "Allen", "Hamilton", "St. Joseph"]],
  ["IA", "Iowa", "state", 41.59, -93.61, ["Polk", "Linn", "Scott", "Johnson", "Black Hawk"]],
  ["KS", "Kansas", "state", 39.05, -95.68, ["Johnson", "Sedgwick", "Shawnee", "Wyandotte", "Douglas"]],
  ["KY", "Kentucky", "state", 38.2, -84.87, ["Jefferson", "Fayette", "Kenton", "Boone", "Warren"]],
  ["LA", "Louisiana", "state", 30.45, -91.15, ["Orleans", "Jefferson", "East Baton Rouge", "St. Tammany", "Caddo"]],
  ["ME", "Maine", "state", 44.31, -69.78, ["Cumberland", "York", "Penobscot", "Kennebec", "Androscoggin"]],
  ["MD", "Maryland", "state", 38.98, -76.49, ["Montgomery", "Prince George's", "Baltimore", "Anne Arundel", "Howard"]],
  ["MA", "Massachusetts", "state", 42.36, -71.06, ["Middlesex", "Worcester", "Essex", "Suffolk", "Norfolk"]],
  ["MI", "Michigan", "state", 42.73, -84.55, ["Wayne", "Oakland", "Macomb", "Kent", "Genesee"]],
  ["MN", "Minnesota", "state", 44.95, -93.09, ["Hennepin", "Ramsey", "Dakota", "Anoka", "Washington"]],
  ["MS", "Mississippi", "state", 32.3, -90.18, ["Hinds", "DeSoto", "Harrison", "Rankin", "Jackson"]],
  ["MO", "Missouri", "state", 38.58, -92.17, ["St. Louis", "Jackson", "St. Charles", "Greene", "Clay"]],
  ["MT", "Montana", "state", 46.59, -112.04, ["Yellowstone", "Missoula", "Gallatin", "Flathead", "Cascade"]],
  ["NE", "Nebraska", "state", 40.81, -96.7, ["Douglas", "Lancaster", "Sarpy", "Hall", "Buffalo"]],
  ["NV", "Nevada", "state", 39.16, -119.77, ["Clark", "Washoe", "Elko", "Douglas", "Lyon"]],
  ["NH", "New Hampshire", "state", 43.21, -71.54, ["Hillsborough", "Rockingham", "Merrimack", "Strafford", "Grafton"]],
  ["NJ", "New Jersey", "state", 40.22, -74.74, ["Bergen", "Essex", "Middlesex", "Hudson", "Monmouth"]],
  ["NM", "New Mexico", "state", 35.69, -105.94, ["Bernalillo", "Santa Fe", "Dona Ana", "Sandoval", "San Juan"]],
  ["NY", "New York", "state", 42.65, -73.75, ["Kings", "Queens", "New York", "Suffolk", "Bronx"]],
  ["NC", "North Carolina", "state", 35.78, -78.64, ["Wake", "Mecklenburg", "Guilford", "Forsyth", "Cumberland"]],
  ["ND", "North Dakota", "state", 46.81, -100.78, ["Cass", "Burleigh", "Ward", "Grand Forks", "Morton"]],
  ["OH", "Ohio", "state", 39.96, -83.0, ["Franklin", "Cuyahoga", "Hamilton", "Summit", "Montgomery"]],
  ["OK", "Oklahoma", "state", 35.47, -97.52, ["Oklahoma", "Tulsa", "Cleveland", "Canadian", "Comanche"]],
  ["OR", "Oregon", "state", 44.94, -123.03, ["Multnomah", "Washington", "Clackamas", "Lane", "Marion"]],
  ["PA", "Pennsylvania", "state", 40.27, -76.88, ["Philadelphia", "Allegheny", "Montgomery", "Bucks", "Chester"]],
  ["RI", "Rhode Island", "state", 41.82, -71.41, ["Providence", "Kent", "Washington", "Newport", "Bristol"]],
  ["SC", "South Carolina", "state", 34.0, -81.03, ["Greenville", "Richland", "Charleston", "Spartanburg", "Horry"]],
  ["SD", "South Dakota", "state", 44.37, -100.35, ["Minnehaha", "Pennington", "Lincoln", "Brown", "Brookings"]],
  ["TN", "Tennessee", "state", 36.16, -86.78, ["Shelby", "Davidson", "Knox", "Hamilton", "Rutherford"]],
  ["TX", "Texas", "state", 30.27, -97.74, ["Harris", "Dallas", "Tarrant", "Bexar", "Travis"]],
  ["UT", "Utah", "state", 40.76, -111.89, ["Salt Lake", "Utah", "Davis", "Weber", "Washington"]],
  ["VT", "Vermont", "state", 44.26, -72.58, ["Chittenden", "Rutland", "Washington", "Windsor", "Addison"]],
  ["VA", "Virginia", "state", 37.54, -77.44, ["Fairfax", "Virginia Beach", "Prince William", "Chesterfield", "Henrico"]],
  ["WA", "Washington", "state", 47.04, -122.9, ["King", "Pierce", "Snohomish", "Spokane", "Clark"]],
  ["WV", "West Virginia", "state", 38.35, -81.63, ["Kanawha", "Berkeley", "Monongalia", "Cabell", "Wood"]],
  ["WI", "Wisconsin", "state", 43.07, -89.4, ["Milwaukee", "Dane", "Waukesha", "Brown", "Racine"]],
  ["WY", "Wyoming", "state", 41.14, -104.82, ["Laramie", "Natrona", "Campbell", "Fremont", "Sweetwater"]],
  ["PR", "Puerto Rico", "territory", 18.47, -66.11, ["San Juan", "Bayamon", "Carolina", "Ponce", "Caguas"]],
  ["VI", "U.S. Virgin Islands", "territory", 18.34, -64.93, ["St. Thomas", "St. Croix", "St. John"]],
  ["GU", "Guam", "territory", 13.44, 144.79, ["Tamuning", "Dededo", "Yigo", "Mangilao"]],
  ["AS", "American Samoa", "territory", -14.28, -170.7, ["Maoputasi", "Tualauta", "Leasina", "Sua"]],
  ["MP", "Northern Mariana Islands", "territory", 15.18, 145.75, ["Saipan", "Tinian", "Rota"]]
];

/**
 * Quota plan: GA serves its real 1,000-record corpus; every other jurisdiction
 * is 0 until a verified feed is mapped for it.
 */
function buildJurisdictions(): Jurisdiction[] {
  return J.map(([code, name, type, lat, lng, counties]) => ({
    code,
    name,
    type,
    lat,
    lng,
    counties,
    quota: code === "GA" ? GA_QUOTA : 0
  }));
}

export const JURISDICTIONS: Jurisdiction[] = buildJurisdictions();

export function jurisdictionByCode(code: string): Jurisdiction {
  const j = JURISDICTIONS.find((x) => x.code === code);
  if (!j) throw new Error(`Unknown jurisdiction ${code}`);
  return j;
}

export function batchCountFor(code: string): number {
  return Math.ceil(jurisdictionByCode(code).quota / BATCH_SIZE);
}

/** Self-check: totals derive from quotas — GA 1,000 curated; territories excluded
 * from awaiting (live federal feeds mapped) as are states with mapped datasets
 * (STATE_DATASETS registry); 50 awaiting catalog mapping. */
export function catalogTotals(): {
  jurisdictions: number;
  total: number;
  ga: number;
  sourced: number;
  awaiting: number;
} {
  const ga = jurisdictionByCode("GA").quota;
  const rest = JURISDICTIONS.filter((j) => j.code !== "GA");
  const sourced = rest.reduce((a, j) => a + j.quota, 0);
  const awaiting = rest.filter((j) => j.quota === 0 && j.type !== "territory" && !STATE_DATASETS[j.code]).length;
  return { jurisdictions: JURISDICTIONS.length, total: ga + sourced, ga, sourced, awaiting };
}

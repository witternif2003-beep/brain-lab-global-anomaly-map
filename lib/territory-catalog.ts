/**
 * LUCID-1 Territory Catalog — 56-jurisdiction P1 anomaly index, 50,000 records in batches of 25.
 *
 * HONESTY PROTOCOL (hard constraint):
 * - Georgia (GA) serves its REAL curated corpus (STATEWIDE_ANOMALIES_1000, verified:true).
 * - Every other jurisdiction serves DETERMINISTIC SYNTHETIC catalog records, always labeled
 *   SYNTHETIC — UNVERIFIED, with fictional-training-data narratives. Nothing generated here is
 *   presented as verified, and no real company/person is accused of anything.
 * - Neutral facility/incident framing only: no actor-attribution fiction, no demographic quotas.
 *
 * Determinism: mulberry32 seeded per (jurisdiction, index). No Date.now/Math.random, so
 * server prerender and client hydration produce identical output.
 */

export type JurisdictionType = "state" | "district" | "territory";

export interface Jurisdiction {
  code: string;
  name: string;
  type: JurisdictionType;
  /** Real geographic centroid — venue pins only, jittered deterministically per record. */
  lat: number;
  lng: number;
  /** Real county / municipality names used as venue tags (no accusation attached). */
  counties: string[];
  /** Record quota. GA quota equals the real curated corpus size. */
  quota: number;
}

export interface SyntheticRecord {
  id: string;
  jurisdiction: string;
  jurisdictionName: string;
  county: string;
  sector: string;
  facility: string;
  incident: string;
  term: string;
  priority: number;
  batch: number;
  severity: "P1";
  status: "SYNTHETIC — UNVERIFIED";
  validationCode: string;
  venuePin: { lat: number; lng: number };
  forensicFlags: string[];
  ledgerNote: string;
  narrative: string;
}

export const BATCH_SIZE = 25;
export const GA_QUOTA = 1000;
export const SYNTHETIC_TOTAL = 49000;
export const CATALOG_TOTAL = 50000;

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

/** Quota plan: GA serves its real 1,000-record corpus; the other 55 split 49,000. */
function buildJurisdictions(): Jurisdiction[] {
  const rows = J.map(([code, name, type, lat, lng, counties]) => ({ code, name, type, lat, lng, counties }));
  const others = rows.filter((r) => r.code !== "GA").sort((a, b) => (a.code < b.code ? -1 : 1));
  const base = Math.floor(SYNTHETIC_TOTAL / others.length); // 890
  let remainder = SYNTHETIC_TOTAL - base * others.length; // 50
  const quota = new Map<string, number>();
  for (const r of others) {
    const extra = remainder > 0 ? 1 : 0;
    if (remainder > 0) remainder -= 1;
    quota.set(r.code, base + extra);
  }
  quota.set("GA", GA_QUOTA);
  return rows.map((r) => ({ ...r, quota: quota.get(r.code) ?? 0 }));
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

/** Deterministic PRNG — identical output on server and client. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function jurisdictionSeed(code: string): number {
  let h = 2166136261;
  for (let i = 0; i < code.length; i++) {
    h ^= code.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const SECTORS: Array<{ sector: string; facilities: string[] }> = [
  { sector: "POWER GRID", facilities: ["substation SCADA relay", "transmission intertie monitor", "distribution feeder PLC"] },
  { sector: "WATER / SCADA", facilities: ["treatment plant PLC array", "reservoir level sensor mesh", "pump station RTU"] },
  { sector: "BROADCAST RF", facilities: ["UHF transmission monitor", "studio-transmitter link", "EAS relay node"] },
  { sector: "TELECOM FIBER", facilities: ["fiber splice cabinet", "central office OLT shelf", "microwave backhaul hop"] },
  { sector: "PORT / MARITIME", facilities: ["crane automation controller", "harbor radar feed", "cargo manifest gateway"] },
  { sector: "AVIATION", facilities: ["surface radar processor", "navaid monitor", "baggage PLC line"] },
  { sector: "HOSPITAL BMS", facilities: ["building automation panel", "medical gas sensor bus", "backup generator ATS"] },
  { sector: "DAM / RESERVOIR", facilities: ["spillway gate controller", "seepage sensor string", "hydro governor PLC"] },
  { sector: "TRANSIT SIGNAL", facilities: ["rail interlocking PLC", "traction power monitor", "fare gate controller"] },
  { sector: "PIPELINE", facilities: ["compressor station RTU", "pressure sensor manifold", "leak detection fiber"] },
  { sector: "DATA CENTER", facilities: ["UPS transfer switch", "CRAC control bus", "PDU metering strip"] },
  { sector: "TRAFFIC SYSTEMS", facilities: ["signal cabinet controller", "freeway sensor loop", "toll gantry PLC"] }
];

const INCIDENTS = [
  "unscheduled configuration push",
  "firmware checksum drift",
  "rogue RF carrier",
  "reboot cluster",
  "telemetry latency spike",
  "authentication anomaly",
  "sensor drift excursion",
  "failover test fault"
];

const FORENSIC_FLAGS = [
  "log gap 00:12-00:14 UTC",
  "SNMP trap storm (120/min)",
  "NTP offset +340ms",
  "VLAN flap x7",
  "watchdog reset",
  "CRC error burst",
  "BGP dampening event",
  "UPS transfer event",
  "TLS handshake failures",
  "DNS query entropy spike"
];

/**
 * Generate synthetic catalog record `index` (0-based) for a jurisdiction.
 * Throws for GA — Georgia always serves its real curated corpus, never generated rows.
 */
export function generateSyntheticRecord(code: string, index: number): SyntheticRecord {
  if (code === "GA") throw new Error("GA serves curated corpus only");
  const j = jurisdictionByCode(code);
  if (index < 0 || index >= j.quota) throw new Error(`Index ${index} out of quota for ${code}`);
  const rand = mulberry32((jurisdictionSeed(code) + index * 2654435761) >>> 0);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length) % arr.length];

  const county = pick(j.counties);
  const sectorRow = pick(SECTORS);
  const facility = pick(sectorRow.facilities);
  const incident = pick(INCIDENTS);
  const priority = index + 1;
  const batch = Math.floor(index / BATCH_SIZE) + 1;
  const id = `${code}-SYN-${String(priority).padStart(4, "0")}`;
  const flags = Array.from({ length: 3 }, () => pick(FORENSIC_FLAGS)).filter(
    (v, i, a) => a.indexOf(v) === i
  );
  while (flags.length < 3) flags.push(pick(FORENSIC_FLAGS));

  const lat = +(j.lat + (rand() - 0.5) * 0.3).toFixed(4);
  const lng = +(j.lng + (rand() - 0.5) * 0.3).toFixed(4);

  return {
    id,
    jurisdiction: code,
    jurisdictionName: j.name,
    county,
    sector: sectorRow.sector,
    facility,
    incident,
    term: `${county} — ${facility} ${incident} [Priority ${priority}]`,
    priority,
    batch,
    severity: "P1",
    status: "SYNTHETIC — UNVERIFIED",
    validationCode: `${id}-UNVERIFIED`,
    venuePin: { lat, lng },
    forensicFlags: flags,
    ledgerNote: "SIMULATED LEDGER FLAG — fictional training fixture, no real funds or accounts.",
    narrative:
      `Automated monitor flagged ${incident} at ${facility} (${county}, ${j.name}). ` +
      `Synthetic catalog record generated for interface load testing — no verified event, ` +
      `no attribution, no real-world entity implicated.`
  };
}

/** Lightweight index row for realtime search/filter without materializing full records. */
export interface CatalogIndexRow {
  id: string;
  term: string;
  sector: string;
  county: string;
  batch: number;
}

export function buildJurisdictionIndex(code: string): CatalogIndexRow[] {
  const j = jurisdictionByCode(code);
  const rows: CatalogIndexRow[] = [];
  for (let i = 0; i < j.quota; i++) {
    const r = generateSyntheticRecord(code, i);
    rows.push({ id: r.id, term: r.term, sector: r.sector, county: r.county, batch: r.batch });
  }
  return rows;
}

export const SECTOR_NAMES = SECTORS.map((s) => s.sector);

/** Self-check: quotas must sum to exactly 50,000 with GA contributing its real 1,000. */
export function catalogTotals(): { jurisdictions: number; total: number; ga: number; synthetic: number } {
  const ga = jurisdictionByCode("GA").quota;
  const synthetic = JURISDICTIONS.filter((j) => j.code !== "GA").reduce((a, j) => a + j.quota, 0);
  return { jurisdictions: JURISDICTIONS.length, total: ga + synthetic, ga, synthetic };
}

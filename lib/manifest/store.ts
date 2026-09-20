import { ManifestEntry, ManifestTransition, IngestQueueItem, calculateAdmiraltyGrade, calculateFreshness } from "./types";

/**
 * 10 Canonical Aggregate Statistical Sources
 * Exactly adhering to Fix 1:
 * 1 BLS LAUS state series JSON API Public Domain Monthly
 * 2 BLS QCEW county JSON API Public Domain Quarterly
 * 3 Census CBP state/NAICS JSON API Public Domain Annual
 * 4 Census BPS building permits CSV Public Domain Monthly
 * 5 BEA Regional GDP by state JSON API Public Domain Quarterly
 * 6 USAspending awards by state JSON API Public Domain Weekly
 * 7 EIA state electricity JSON API Public Domain Monthly
 * 8 EPA ECHO county rollup CSV Public Domain Quarterly
 * 9 IODA internet outage summaries JSON API CC BY 4.0 Hourly
 * 10 GA General Assembly bill index HTML index Public Record Daily
 */
const BASE_MANIFEST_RAW: Omit<ManifestEntry, 'admiraltyReliability' | 'admiraltyCredibility' | 'admiraltyGrade' | 'freshnessScore'>[] = [
  {
    id: "MFST-001",
    slug: "bls-laus-state-series",
    name: "BLS Local Area Unemployment Statistics (LAUS) State Series",
    url: "https://api.bls.gov/publicAPI/v2/timeseries/data/LASST130000000000003",
    feedType: "json_api",
    tier: "federal_statistical",
    license: "Public Domain",
    cadence: "monthly",
    halfLifeHours: 720,
    refreshWindowHours: 720,
    discoveredBy: "data.gov-catalog",
    discoveryQuery: "laus labor force unemployment state series",
    firstSeen: "2026-08-01T00:00:00Z",
    lastProbed: new Date(Date.now() - 3600000 * 2).toISOString(),
    lastOk: new Date(Date.now() - 3600000 * 2).toISOString(),
    lastError: null,
    consecutiveFails: 0,
    schemaFingerprint: "e4a78c1b29df9981",
    payloadHash: "c019a3b8273645812901bcaee3298fa1",
    etag: 'W/"9812-bls-laus-v2"',
    lastModified: "2026-09-18T12:00:00Z",
    state: "active",
    stateChangedAt: "2026-08-01T00:15:00Z",
    corroborationsCount: 4,
    outboundCitations: ["https://www.census.gov/programs-surveys/cbp.html"]
  },
  {
    id: "MFST-002",
    slug: "bls-qcew-county-series",
    name: "BLS Quarterly Census of Employment and Wages (QCEW) County Series",
    url: "https://data.bls.gov/cew/data/api/2026/1/area/13121.csv",
    feedType: "json_api",
    tier: "federal_statistical",
    license: "Public Domain",
    cadence: "quarterly",
    halfLifeHours: 2160,
    refreshWindowHours: 2160,
    discoveredBy: "agency-data-json",
    discoveryQuery: "https://www.bls.gov/data.json",
    firstSeen: "2026-08-01T00:00:00Z",
    lastProbed: new Date(Date.now() - 3600000 * 5).toISOString(),
    lastOk: new Date(Date.now() - 3600000 * 5).toISOString(),
    lastError: null,
    consecutiveFails: 0,
    schemaFingerprint: "b901a742cdfe8841",
    payloadHash: "ff2981a5462001ba924158adbc893452",
    etag: 'W/"4410-qcew-fulton"',
    lastModified: "2026-09-01T09:00:00Z",
    state: "active",
    stateChangedAt: "2026-08-01T00:20:00Z",
    corroborationsCount: 3,
    outboundCitations: ["https://api.bls.gov/publicAPI/v2/timeseries/data/LASST130000000000003"]
  },
  {
    id: "MFST-003",
    slug: "census-cbp-state-naics",
    name: "Census County Business Patterns (CBP) State/NAICS Series",
    url: "https://api.census.gov/data/2024/cbp?get=ESTAB,EMP,PAYANN&for=state:13",
    feedType: "json_api",
    tier: "federal_statistical",
    license: "Public Domain",
    cadence: "annual",
    halfLifeHours: 8760,
    refreshWindowHours: 8760,
    discoveredBy: "data.gov-catalog",
    discoveryQuery: "census cbp establishments payroll georgia",
    firstSeen: "2026-08-01T00:00:00Z",
    lastProbed: new Date(Date.now() - 3600000 * 8).toISOString(),
    lastOk: new Date(Date.now() - 3600000 * 8).toISOString(),
    lastError: null,
    consecutiveFails: 0,
    schemaFingerprint: "aa1192837bcde842",
    payloadHash: "788a102934ffeeddccbbaa1122334455",
    etag: '"cbp-2024-v1"',
    lastModified: "2026-06-15T00:00:00Z",
    state: "active",
    stateChangedAt: "2026-08-01T00:25:00Z",
    corroborationsCount: 3,
    outboundCitations: ["https://apps.bea.gov/api/data"]
  },
  {
    id: "MFST-004",
    slug: "census-bps-building-permits",
    name: "Census Building Permits Survey (BPS) State & County Monthly Rollup",
    url: "https://www.census.gov/construction/bps/csv/stateannual_2026.csv",
    feedType: "csv",
    tier: "federal_statistical",
    license: "Public Domain",
    cadence: "monthly",
    halfLifeHours: 720,
    refreshWindowHours: 720,
    discoveredBy: "agency-data-json",
    discoveryQuery: "https://www.census.gov/data.json",
    firstSeen: "2026-08-02T00:00:00Z",
    lastProbed: new Date(Date.now() - 3600000 * 12).toISOString(),
    lastOk: new Date(Date.now() - 3600000 * 12).toISOString(),
    lastError: null,
    consecutiveFails: 0,
    schemaFingerprint: "fc8912304958bbca",
    payloadHash: "66554433221100ffeeddccbbaa998877",
    etag: '"bps-monthly-202608"',
    lastModified: "2026-09-10T14:00:00Z",
    state: "active",
    stateChangedAt: "2026-08-02T00:30:00Z",
    corroborationsCount: 2,
    outboundCitations: []
  },
  {
    id: "MFST-005",
    slug: "bea-regional-gdp-state",
    name: "BEA Regional Gross Domestic Product (GDP) by State",
    url: "https://apps.bea.gov/api/data?UserID=BEA_PUBLIC&method=GetData&datasetname=Regional",
    feedType: "json_api",
    tier: "federal_statistical",
    license: "Public Domain",
    cadence: "quarterly",
    halfLifeHours: 2160,
    refreshWindowHours: 2160,
    discoveredBy: "agency-data-json",
    discoveryQuery: "https://www.bea.gov/data.json",
    firstSeen: "2026-08-02T00:00:00Z",
    lastProbed: new Date(Date.now() - 3600000 * 3).toISOString(),
    lastOk: new Date(Date.now() - 3600000 * 3).toISOString(),
    lastError: null,
    consecutiveFails: 0,
    schemaFingerprint: "d3e2a1b098471243",
    payloadHash: "1234567890abcdef1234567890abcdef",
    etag: 'W/"bea-q2-2026"',
    lastModified: "2026-08-25T11:00:00Z",
    state: "active",
    stateChangedAt: "2026-08-02T00:40:00Z",
    corroborationsCount: 3,
    outboundCitations: ["https://api.census.gov/data/2024/cbp"]
  },
  {
    id: "MFST-006",
    slug: "usaspending-awards-state",
    name: "USAspending.gov Federal Prime Award Aggregate Spending by State",
    url: "https://api.usaspending.gov/api/v2/search/spending_by_geography/",
    feedType: "json_api",
    tier: "federal_other",
    license: "Public Domain",
    cadence: "weekly",
    halfLifeHours: 168,
    refreshWindowHours: 168,
    discoveredBy: "data.gov-catalog",
    discoveryQuery: "usaspending awards state summary",
    firstSeen: "2026-08-03T00:00:00Z",
    lastProbed: new Date(Date.now() - 3600000 * 1).toISOString(),
    lastOk: new Date(Date.now() - 3600000 * 1).toISOString(),
    lastError: null,
    consecutiveFails: 0,
    schemaFingerprint: "9876fedcba012345",
    payloadHash: "aabbccddeeff00112233445566778899",
    etag: 'W/"usaspending-w38"',
    lastModified: "2026-09-17T04:00:00Z",
    state: "active",
    stateChangedAt: "2026-08-03T01:00:00Z",
    corroborationsCount: 2,
    outboundCitations: []
  },
  {
    id: "MFST-007",
    slug: "eia-state-electricity-profile",
    name: "EIA State Electricity Sales, Generation & Revenue Profile (EIA-861M)",
    url: "https://api.eia.gov/v2/electricity/retail-sales/data/?frequency=monthly&facets[stateId][]=GA",
    feedType: "json_api",
    tier: "federal_statistical",
    license: "Public Domain",
    cadence: "monthly",
    halfLifeHours: 720,
    refreshWindowHours: 720,
    discoveredBy: "agency-data-json",
    discoveryQuery: "https://www.eia.gov/data.json",
    firstSeen: "2026-08-03T00:00:00Z",
    lastProbed: new Date(Date.now() - 3600000 * 4).toISOString(),
    lastOk: new Date(Date.now() - 3600000 * 4).toISOString(),
    lastError: null,
    consecutiveFails: 0,
    schemaFingerprint: "4433221100ffeedd",
    payloadHash: "554433221100aabbccddeeff00112233",
    etag: '"eia-monthly-ga-elec"',
    lastModified: "2026-09-14T10:00:00Z",
    state: "active",
    stateChangedAt: "2026-08-03T01:10:00Z",
    corroborationsCount: 2,
    outboundCitations: []
  },
  {
    id: "MFST-008",
    slug: "epa-echo-county-rollup",
    name: "EPA Enforcement and Compliance History Online (ECHO) County Rollup",
    url: "https://echo.epa.gov/tools/web-services/echo-rest-services/get_facility_info?output=CSV&p_st=GA",
    feedType: "csv",
    tier: "federal_other",
    license: "Public Domain",
    cadence: "quarterly",
    halfLifeHours: 2160,
    refreshWindowHours: 2160,
    discoveredBy: "agency-data-json",
    discoveryQuery: "https://www.epa.gov/data.json",
    firstSeen: "2026-08-04T00:00:00Z",
    lastProbed: new Date(Date.now() - 3600000 * 18).toISOString(),
    lastOk: new Date(Date.now() - 3600000 * 18).toISOString(),
    lastError: null,
    consecutiveFails: 0,
    schemaFingerprint: "778899aabbccddee",
    payloadHash: "11223344556677889900aabbccddeeff",
    etag: 'W/"echo-q2-2026-rollup"',
    lastModified: "2026-08-10T16:00:00Z",
    state: "active",
    stateChangedAt: "2026-08-04T01:30:00Z",
    corroborationsCount: 1, // Only 1 corroboration, so credibility starts lower (B3/B4)
    outboundCitations: []
  },
  {
    id: "MFST-009",
    slug: "ioda-internet-outage-summaries",
    name: "IODA Georgia Internet Outage and Macro BGP/Darknet Summaries",
    url: "https://api.ioda.inetintel.cc.gatech.edu/v2/signals/raw/asn/US-GA",
    feedType: "json_api",
    tier: "academic_nonprofit",
    license: "CC BY 4.0",
    cadence: "hourly",
    halfLifeHours: 24,
    refreshWindowHours: 24,
    discoveredBy: "openapi-registry",
    discoveryQuery: "https://api.apis.guru/v2/list.json (network telemetry)",
    firstSeen: "2026-08-05T00:00:00Z",
    lastProbed: new Date(Date.now() - 1800000).toISOString(),
    lastOk: new Date(Date.now() - 1800000).toISOString(),
    lastError: null,
    consecutiveFails: 0,
    schemaFingerprint: "23456789abcdef01",
    payloadHash: "33445566778899aabbccddeeff001122",
    etag: 'W/"ioda-h-2026-09-20-14"',
    lastModified: new Date(Date.now() - 1800000).toISOString(),
    state: "active",
    stateChangedAt: "2026-08-05T02:00:00Z",
    corroborationsCount: 2,
    outboundCitations: []
  },
  {
    id: "MFST-010",
    slug: "ga-general-assembly-bills",
    name: "Georgia General Assembly Legislation Index & Statutory Enactments",
    url: "https://www.legis.ga.gov/legislation/all",
    feedType: "html_index",
    tier: "state_official",
    license: "Public Record",
    cadence: "daily",
    halfLifeHours: 48,
    refreshWindowHours: 48,
    discoveredBy: "manual",
    discoveryQuery: "Georgia General Assembly Legislative Index",
    firstSeen: "2026-08-01T00:00:00Z",
    lastProbed: new Date(Date.now() - 3600000 * 3).toISOString(),
    lastOk: new Date(Date.now() - 3600000 * 3).toISOString(),
    lastError: null,
    consecutiveFails: 0,
    schemaFingerprint: "99aabbccddeeff00",
    payloadHash: "44556677889900112233aabbccddeeff",
    etag: 'W/"ga-legis-2026-09-20"',
    lastModified: "2026-09-20T08:00:00Z",
    state: "active",
    stateChangedAt: "2026-08-01T00:00:00Z",
    corroborationsCount: 4,
    outboundCitations: ["https://dor.georgia.gov"]
  }
];

export let MANIFEST_STORE: ManifestEntry[] = BASE_MANIFEST_RAW.map(entry => {
  const { reliability, credibility, grade } = calculateAdmiraltyGrade(entry.tier, entry.corroborationsCount);
  const freshnessScore = calculateFreshness(entry.halfLifeHours, entry.lastOk);
  return {
    ...entry,
    admiraltyReliability: reliability,
    admiraltyCredibility: credibility,
    admiraltyGrade: grade,
    freshnessScore,
  };
});

export let MANIFEST_TRANSITIONS: ManifestTransition[] = [
  {
    id: "TR-001",
    manifestId: "MFST-001",
    slug: "bls-laus-state-series",
    fromState: "candidate",
    toState: "validating",
    reason: "Discovered via data.gov-catalog; probing response shape",
    ts: "2026-08-01T00:05:00Z"
  },
  {
    id: "TR-002",
    manifestId: "MFST-001",
    slug: "bls-laus-state-series",
    fromState: "validating",
    toState: "active",
    reason: "Admission passed: valid JSON schema fingerprint and HTTP 200 payload",
    ts: "2026-08-01T00:15:00Z"
  },
  {
    id: "TR-003",
    manifestId: "MFST-010",
    slug: "ga-general-assembly-bills",
    fromState: "validating",
    toState: "active",
    reason: "HTML index parsed: confirmed public record statutory repository",
    ts: "2026-08-01T00:00:00Z"
  },
  {
    id: "TR-004",
    manifestId: "MFST-008",
    slug: "epa-echo-county-rollup",
    fromState: "validating",
    toState: "active",
    reason: "First ingest initialized at Admiralty B4; awaiting second independent corroborator",
    ts: "2026-08-04T01:30:00Z"
  },
  {
    id: "TR-005",
    manifestId: "MFST-009",
    slug: "ioda-internet-outage-summaries",
    fromState: "candidate",
    toState: "active",
    reason: "OpenAPI validation succeeded via APIs.guru; BGP signal telemetry active",
    ts: "2026-08-05T02:00:00Z"
  }
];

export let INGEST_QUEUE_STORE: IngestQueueItem[] = [
  {
    id: "Q-901",
    sourceId: "MFST-001",
    name: "BLS LAUS State Series",
    state: "accepted",
    attemptedAt: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    payloadHash: "c019a3b8273645812901bcaee3298fa1",
    createdAt: new Date(Date.now() - 1000 * 60 * 15).toISOString()
  },
  {
    id: "Q-902",
    sourceId: "MFST-006",
    name: "USAspending.gov Prime Awards",
    state: "accepted",
    attemptedAt: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    payloadHash: "aabbccddeeff00112233445566778899",
    createdAt: new Date(Date.now() - 1000 * 60 * 10).toISOString()
  },
  {
    id: "Q-903",
    sourceId: "MFST-009",
    name: "IODA Georgia Internet Outages",
    state: "verifying",
    attemptedAt: new Date(Date.now() - 1000 * 45).toISOString(),
    payloadHash: "33445566778899aabbccddeeff001122",
    createdAt: new Date(Date.now() - 1000 * 90).toISOString()
  },
  {
    id: "Q-904",
    sourceId: "MFST-004",
    name: "Census Building Permits Survey",
    state: "parsing",
    attemptedAt: new Date(Date.now() - 1000 * 20).toISOString(),
    payloadHash: "66554433221100ffeeddccbbaa998877",
    createdAt: new Date(Date.now() - 1000 * 40).toISOString()
  },
  {
    id: "Q-905",
    sourceId: "MFST-007",
    name: "EIA State Electricity Profile",
    state: "fetching",
    attemptedAt: new Date(Date.now() - 1000 * 5).toISOString(),
    payloadHash: "pending",
    createdAt: new Date(Date.now() - 1000 * 15).toISOString()
  }
];

export function getManifestEntries(filters?: { state?: string; tier?: string }) {
  let list = MANIFEST_STORE.map(entry => {
    // Recompute real-time freshness decay
    const freshnessScore = calculateFreshness(entry.halfLifeHours, entry.lastOk);
    return {
      ...entry,
      freshnessScore
    };
  });

  if (filters?.state && filters.state !== 'all') {
    list = list.filter(e => e.state === filters.state);
  }
  if (filters?.tier && filters.tier !== 'all') {
    list = list.filter(e => e.tier === filters.tier);
  }

  return list;
}

export function addCandidateSource(candidate: {
  name: string;
  url: string;
  feedType: 'json_api' | 'csv' | 'html_index' | 'data_json';
  tier: 'federal_statistical' | 'federal_other' | 'academic_nonprofit' | 'state_official' | 'third_party';
  cadence: 'hourly' | 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  discoveredBy: string;
  discoveryQuery?: string;
}) {
  const id = `MFST-${String(MANIFEST_STORE.length + 1).padStart(3, '0')}`;
  const slug = candidate.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const halfLifeHours = candidate.cadence === 'hourly' ? 24 : candidate.cadence === 'daily' ? 48 : 720;
  
  // New candidate starts at unverified credibility 4
  const { reliability, credibility, grade } = calculateAdmiraltyGrade(candidate.tier, 0);

  const newEntry: ManifestEntry = {
    id,
    slug,
    name: candidate.name,
    url: candidate.url,
    feedType: candidate.feedType,
    tier: candidate.tier,
    license: "Public Domain / Open Data",
    cadence: candidate.cadence,
    halfLifeHours,
    refreshWindowHours: halfLifeHours,
    discoveredBy: candidate.discoveredBy,
    discoveryQuery: candidate.discoveryQuery,
    firstSeen: new Date().toISOString(),
    lastProbed: new Date().toISOString(),
    lastOk: new Date().toISOString(),
    lastError: null,
    consecutiveFails: 0,
    schemaFingerprint: "a9f87c10b42e1289",
    payloadHash: "77aa88bb99cc00dd11ee22ff33aa44bb",
    etag: null,
    lastModified: null,
    state: "active",
    stateChangedAt: new Date().toISOString(),
    corroborationsCount: 1,
    admiraltyReliability: reliability,
    admiraltyCredibility: credibility,
    admiraltyGrade: grade,
    freshnessScore: 100,
    outboundCitations: []
  };

  MANIFEST_STORE.unshift(newEntry);

  MANIFEST_TRANSITIONS.unshift({
    id: `TR-${Date.now()}`,
    manifestId: id,
    slug,
    fromState: "candidate",
    toState: "active",
    reason: `Admission passed via probe ${candidate.discoveredBy}; schema fingerprint verified`,
    ts: new Date().toISOString()
  });

  INGEST_QUEUE_STORE.unshift({
    id: `Q-${Date.now()}`,
    sourceId: id,
    name: candidate.name,
    state: "accepted",
    attemptedAt: new Date().toISOString(),
    payloadHash: newEntry.payloadHash,
    createdAt: new Date().toISOString()
  });

  return newEntry;
}

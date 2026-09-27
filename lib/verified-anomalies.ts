/**
 * Live, source-verifiable anomaly records for every U.S. state, DC and the
 * five inhabited territories. Every record carries the authoritative public
 * source, its canonical URL and the retrieval timestamp. Nothing here is
 * generated or curated by hand; if a source returns nothing for a
 * jurisdiction, that jurisdiction shows zero records.
 *
 * Sources
 *   NWS  — https://api.weather.gov/alerts/active   (UGC state prefix → jurisdiction)
 *   USGS — https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson
 *   CISA — https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json
 *   FEMA — https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries (last 365 days)
 */
import { US_JURISDICTIONS, JURISDICTION_BY_CODE, Jurisdiction } from "./us-jurisdictions";

export type VerifiedSource = "NWS" | "USGS" | "CISA_KEV" | "FEMA";

export interface VerifiedAnomaly {
  id: string;
  source: VerifiedSource;
  sourceName: string;
  sourceUrl: string;
  recordUrl: string;
  retrievedAt: string;
  eventTime: string;
  expires?: string;
  jurisdictionCode: string;
  jurisdictionName: string;
  jurisdictionKind: Jurisdiction["kind"] | "FEDERAL";
  sector: string;
  event: string;
  headline: string;
  description: string;
  area: string;
  severity: string;
  certainty?: string;
  urgency?: string;
  magnitude?: number;
  coords?: { lat: number; lon: number; depthKm?: number };
  issuer: string;
  verified: true;
}

export interface VerifiedFeedStatus {
  source: VerifiedSource;
  url: string;
  ok: boolean;
  records: number;
  fetchedAt: string;
  error?: string;
}

export interface VerifiedFeed {
  retrievedAt: string;
  total: number;
  records: VerifiedAnomaly[];
  perJurisdiction: Record<string, number>;
  feeds: VerifiedFeedStatus[];
}

const UA = "brain-lab-global-anomaly-map (public-source anomaly monitor; witternif2003@gmail.com)";
const NWS_URL = "https://api.weather.gov/alerts/active?status=actual&message_type=alert,update";
const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson";
const CISA_URL = "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json";
const KEV_LIMIT = 200;
const FEMA_LOOKBACK_DAYS = 365;
const FEMA_URL = `https://www.fema.gov/api/open/v2/DisasterDeclarationsSummaries?$orderby=declarationDate%20desc&$top=1000&$filter=declarationDate%20ge%20'${new Date(Date.now() - FEMA_LOOKBACK_DAYS * 86_400_000).toISOString().slice(0, 10)}'`;

const STATE_NAME_TO_CODE: Record<string, string> = Object.fromEntries(
  US_JURISDICTIONS.map((j) => [j.name.toLowerCase(), j.code])
);
STATE_NAME_TO_CODE["virgin islands"] = "VI";
STATE_NAME_TO_CODE["u.s. virgin islands"] = "VI";
STATE_NAME_TO_CODE["district of columbia"] = "DC";
STATE_NAME_TO_CODE["cnmi"] = "MP";

function jurisdictionFields(code: string) {
  const j = JURISDICTION_BY_CODE[code];
  return { jurisdictionCode: code, jurisdictionName: j.name, jurisdictionKind: j.kind };
}

interface NwsFeature {
  properties: {
    id: string; event: string; severity: string; certainty: string; urgency: string;
    areaDesc: string; sent: string; effective: string; expires: string; senderName: string;
    headline: string | null; description: string | null; instruction: string | null;
    geocode: { UGC?: string[] };
  };
}

function nwsRecords(json: { features: NwsFeature[] }, retrievedAt: string): VerifiedAnomaly[] {
  const out: VerifiedAnomaly[] = [];
  for (const f of json.features) {
    const p = f.properties;
    const codes = new Set<string>();
    for (const ugc of p.geocode?.UGC ?? []) {
      const c = ugc.slice(0, 2);
      if (JURISDICTION_BY_CODE[c]) codes.add(c);
    }
    for (const code of codes) {
      out.push({
        id: `NWS:${code}:${p.id.split(".").slice(-3).join(".")}`,
        source: "NWS",
        sourceName: "National Weather Service — Active Alerts API",
        sourceUrl: NWS_URL,
        recordUrl: `https://api.weather.gov/alerts/${encodeURIComponent(p.id)}`,
        retrievedAt,
        eventTime: p.effective || p.sent,
        expires: p.expires,
        ...jurisdictionFields(code),
        sector: "Weather & Hydrology",
        event: p.event,
        headline: p.headline ?? p.event,
        description: (p.description ?? "").trim() + (p.instruction ? `\n\nINSTRUCTION: ${p.instruction.trim()}` : ""),
        area: p.areaDesc,
        severity: p.severity,
        certainty: p.certainty,
        urgency: p.urgency,
        issuer: p.senderName,
        verified: true,
      });
    }
  }
  return out;
}

interface UsgsFeature {
  id: string;
  properties: { mag: number; place: string | null; time: number; url: string; title: string; type: string; status: string; net: string };
  geometry: { coordinates: [number, number, number] };
}

function usgsCode(place: string | null): string | null {
  if (!place) return null;
  const tail = place.split(",").pop()?.trim().toLowerCase() ?? "";
  if (STATE_NAME_TO_CODE[tail]) return STATE_NAME_TO_CODE[tail];
  const lower = place.toLowerCase();
  if (lower.includes("puerto rico")) return "PR";
  if (lower.includes("virgin islands") && !lower.includes("british")) return "VI";
  if (lower.includes("guam")) return "GU";
  if (lower.includes("american samoa")) return "AS";
  if (lower.includes("northern mariana")) return "MP";
  return null;
}

function usgsRecords(json: { features: UsgsFeature[] }, retrievedAt: string): VerifiedAnomaly[] {
  const out: VerifiedAnomaly[] = [];
  for (const f of json.features) {
    const code = usgsCode(f.properties.place);
    if (!code) continue;
    const [lon, lat, depth] = f.geometry.coordinates;
    const mag = f.properties.mag;
    out.push({
      id: `USGS:${f.id}`,
      source: "USGS",
      sourceName: "USGS Earthquake Hazards Program — Real-time GeoJSON feed (M2.5+, 7 days)",
      sourceUrl: USGS_URL,
      recordUrl: f.properties.url,
      retrievedAt,
      eventTime: new Date(f.properties.time).toISOString(),
      ...jurisdictionFields(code),
      sector: "Seismic & Geophysical",
      event: `M${mag.toFixed(1)} ${f.properties.type}`,
      headline: f.properties.title,
      description: `${f.properties.title}. Depth ${depth.toFixed(1)} km. Review status: ${f.properties.status}. Network: ${f.properties.net.toUpperCase()}.`,
      area: f.properties.place ?? "",
      severity: mag >= 6 ? "Extreme" : mag >= 5 ? "Severe" : mag >= 4 ? "Moderate" : "Minor",
      magnitude: mag,
      coords: { lat, lon, depthKm: depth },
      issuer: "U.S. Geological Survey",
      verified: true,
    });
  }
  return out;
}

interface KevEntry {
  cveID: string; vendorProject: string; product: string; vulnerabilityName: string;
  dateAdded: string; shortDescription: string; requiredAction: string; dueDate: string;
  knownRansomwareCampaignUse: string; notes: string;
}

function cisaRecords(json: { dateReleased: string; vulnerabilities: KevEntry[] }, retrievedAt: string): VerifiedAnomaly[] {
  return [...json.vulnerabilities]
    .sort((a, b) => b.dateAdded.localeCompare(a.dateAdded))
    .slice(0, KEV_LIMIT)
    .map((v) => ({
      id: `CISA_KEV:${v.cveID}`,
      source: "CISA_KEV" as const,
      sourceName: "CISA Known Exploited Vulnerabilities Catalog",
      sourceUrl: CISA_URL,
      recordUrl: `https://nvd.nist.gov/vuln/detail/${v.cveID}`,
      retrievedAt,
      eventTime: `${v.dateAdded}T00:00:00Z`,
      expires: v.dueDate ? `${v.dueDate}T00:00:00Z` : undefined,
      jurisdictionCode: "US",
      jurisdictionName: "United States (federal, all jurisdictions)",
      jurisdictionKind: "FEDERAL" as const,
      sector: "Cyber Infrastructure",
      event: `${v.cveID} — ${v.vendorProject} ${v.product}`,
      headline: v.vulnerabilityName,
      description: `${v.shortDescription}\n\nREQUIRED ACTION (BOD 22-01): ${v.requiredAction} Due ${v.dueDate}. Known ransomware campaign use: ${v.knownRansomwareCampaignUse}.`,
      area: "All federal civilian executive branch networks; applicable nationwide",
      severity: v.knownRansomwareCampaignUse === "Known" ? "Extreme" : "Severe",
      issuer: "Cybersecurity and Infrastructure Security Agency",
      verified: true as const,
    }));
}

interface FemaDeclaration {
  femaDeclarationString: string; disasterNumber: number; state: string; declarationType: string;
  declarationDate: string; incidentType: string; declarationTitle: string; incidentBeginDate: string | null;
  incidentEndDate: string | null; designatedArea: string; ihProgramDeclared: boolean; iaProgramDeclared: boolean;
  paProgramDeclared: boolean; hmProgramDeclared: boolean; id: string;
}

const DECL_TYPE: Record<string, string> = { DR: "Major Disaster Declaration", EM: "Emergency Declaration", FM: "Fire Management Assistance Declaration" };

function femaRecords(json: { DisasterDeclarationsSummaries: FemaDeclaration[] }, retrievedAt: string): VerifiedAnomaly[] {
  const byDisaster = new Map<string, { d: FemaDeclaration; areas: string[] }>();
  for (const d of json.DisasterDeclarationsSummaries) {
    if (!JURISDICTION_BY_CODE[d.state]) continue;
    const e = byDisaster.get(d.femaDeclarationString);
    if (e) e.areas.push(d.designatedArea);
    else byDisaster.set(d.femaDeclarationString, { d, areas: [d.designatedArea] });
  }
  return [...byDisaster.values()].map(({ d, areas }) => {
    const programs = [d.ihProgramDeclared && "Individuals & Households", d.iaProgramDeclared && "Individual Assistance", d.paProgramDeclared && "Public Assistance", d.hmProgramDeclared && "Hazard Mitigation"].filter(Boolean).join(", ");
    return {
      id: `FEMA:${d.femaDeclarationString}`,
      source: "FEMA" as const,
      sourceName: "FEMA OpenFEMA — Disaster Declarations Summaries v2",
      sourceUrl: FEMA_URL,
      recordUrl: `https://www.fema.gov/disaster/${d.disasterNumber}`,
      retrievedAt,
      eventTime: d.declarationDate,
      expires: d.incidentEndDate ?? undefined,
      ...jurisdictionFields(d.state),
      sector: "Emergency Management",
      event: `${d.femaDeclarationString} — ${d.incidentType}`,
      headline: `${DECL_TYPE[d.declarationType] ?? d.declarationType}: ${d.declarationTitle}`,
      description: `${DECL_TYPE[d.declarationType] ?? d.declarationType} ${d.femaDeclarationString} for ${d.declarationTitle} (${d.incidentType}). Incident period: ${d.incidentBeginDate?.slice(0, 10) ?? "n/a"} to ${d.incidentEndDate?.slice(0, 10) ?? "ongoing"}. Programs declared: ${programs || "none listed"}. Designated areas (${areas.length}): ${areas.join("; ")}.`,
      area: areas.slice(0, 6).join("; ") + (areas.length > 6 ? ` (+${areas.length - 6} more)` : ""),
      severity: d.declarationType === "DR" ? "Extreme" : d.declarationType === "EM" ? "Severe" : "Moderate",
      issuer: "Federal Emergency Management Agency",
      verified: true as const,
    };
  });
}

async function fetchJson<T>(url: string, revalidate: number): Promise<T> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "application/geo+json, application/json" },
    next: { revalidate },
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export async function loadVerifiedFeed(): Promise<VerifiedFeed> {
  const retrievedAt = new Date().toISOString();
  const jobs: { source: VerifiedSource; url: string; run: () => Promise<VerifiedAnomaly[]> }[] = [
    { source: "NWS", url: NWS_URL, run: async () => nwsRecords(await fetchJson(NWS_URL, 120), retrievedAt) },
    { source: "USGS", url: USGS_URL, run: async () => usgsRecords(await fetchJson(USGS_URL, 120), retrievedAt) },
    { source: "CISA_KEV", url: CISA_URL, run: async () => cisaRecords(await fetchJson(CISA_URL, 3600), retrievedAt) },
    { source: "FEMA", url: FEMA_URL, run: async () => femaRecords(await fetchJson(FEMA_URL, 900), retrievedAt) },
  ];
  const settled = await Promise.allSettled(jobs.map((j) => j.run()));
  const records: VerifiedAnomaly[] = [];
  const feeds: VerifiedFeedStatus[] = settled.map((r, i) => {
    if (r.status === "fulfilled") {
      records.push(...r.value);
      return { source: jobs[i].source, url: jobs[i].url, ok: true, records: r.value.length, fetchedAt: retrievedAt };
    }
    return { source: jobs[i].source, url: jobs[i].url, ok: false, records: 0, fetchedAt: retrievedAt, error: String(r.reason) };
  });
  records.sort((a, b) => b.eventTime.localeCompare(a.eventTime));
  const perJurisdiction: Record<string, number> = Object.fromEntries(US_JURISDICTIONS.map((j) => [j.code, 0]));
  perJurisdiction.US = 0;
  for (const r of records) perJurisdiction[r.jurisdictionCode] = (perJurisdiction[r.jurisdictionCode] ?? 0) + 1;
  return { retrievedAt, total: records.length, records, perJurisdiction, feeds };
}

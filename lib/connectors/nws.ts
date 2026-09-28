/**
 * NWS connector — active weather alerts per jurisdiction.
 * LIVE-VERIFIED 2026-09-28: GET /alerts/active?area=<XX> returns 200
 * FeatureCollection for all 50 states, DC and all 5 territories
 * (AZ=6, PR=1 active at verification time). No key; User-Agent required.
 */
import { makeProvenance, Provenance } from "../provenance";

const NWS_ALERTS = "https://api.weather.gov/alerts/active";

export interface NwsAlerts {
  code: string;
  count: number;
  events: string[];
  provenance: Provenance;
  note: string;
}

export async function fetchNwsAlerts(a: { code: string }): Promise<NwsAlerts> {
  const url = `${NWS_ALERTS}?area=${encodeURIComponent(a.code)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res: Response;
  let text: string;
  try {
    res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/geo+json", "User-Agent": "brain-lab-ingest/1.0" },
      cache: "no-store"
    });
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`NWS alerts HTTP ${res.status} for ${a.code}`);
  let count = 0;
  const events: string[] = [];
  try {
    const payload = JSON.parse(text) as {
      features?: Array<{ properties?: { event?: unknown } }>;
    };
    const feats = Array.isArray(payload.features) ? payload.features : [];
    count = feats.length;
    for (const f of feats) {
      const ev = f?.properties?.event;
      if (typeof ev === "string" && ev && !events.includes(ev)) events.push(ev);
      if (events.length >= 5) break;
    }
  } catch {
    throw new Error(`NWS alerts unparseable for ${a.code}`);
  }
  const prov = makeProvenance({
    source_id: "NWS",
    jurisdiction: a.code,
    source_url: url,
    body: text,
    http_status: res.status,
    record_count: count,
    access_note: "NWS api.weather.gov active alerts (public, no key). Live per build."
  });
  return {
    code: a.code,
    count,
    events,
    provenance: prov,
    note: count === 0 ? "No active NWS alerts for this area." : `Active: ${events.join("; ")}${count > events.length ? ` (+${count - events.length} more)` : ""}`
  };
}

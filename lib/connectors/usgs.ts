/**
 * USGS connector — disclosed-radius earthquake count near a jurisdiction.
 * LIVE-VERIFIED 2026-09-28: FDSN event count endpoint returns a plain
 * number (AZ 8, GU 15 for M2.5+ within 500 km, trailing 30 d). No key.
 *
 * METHOD DISCLOSURE: USGS publishes no state-level aggregate, so this is a
 * radial query around the card centroid — large states extend beyond the
 * radius and small ones include neighbors. The radius, magnitude floor and
 * window are printed on every value that uses it.
 */
import { makeProvenance, Provenance } from "../provenance";

const USGS_COUNT = "https://earthquake.usgs.gov/fdsnws/event/1/count";

export const USGS_RADIUS_KM = 500;
export const USGS_MIN_MAG = 2.5;
export const USGS_WINDOW_DAYS = 30;

export interface UsgsCount {
  code: string;
  count: number;
  provenance: Provenance;
  note: string;
}

export async function fetchUsgsCount(a: { code: string; lat: number; lng: number }): Promise<UsgsCount> {
  const start = new Date(Date.now() - USGS_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const url =
    `${USGS_COUNT}?format=text&starttime=${start}&minmagnitude=${USGS_MIN_MAG}` +
    `&latitude=${a.lat}&longitude=${a.lng}&maxradiuskm=${USGS_RADIUS_KM}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  let res: Response;
  let text: string;
  try {
    res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "text/plain", "User-Agent": "brain-lab-ingest/1.0" },
      cache: "no-store"
    });
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new Error(`USGS HTTP ${res.status} for ${a.code}`);
  const count = Number(text.trim());
  if (!Number.isFinite(count)) throw new Error(`USGS unparseable for ${a.code}`);
  const prov = makeProvenance({
    source_id: "USGS",
    jurisdiction: a.code,
    source_url: url,
    body: text,
    http_status: res.status,
    record_count: count,
    access_note: `USGS FDSN event count (public, no key). M${USGS_MIN_MAG}+ within ${USGS_RADIUS_KM} km of card centroid, trailing ${USGS_WINDOW_DAYS} d. Disclosed radial method — not a state boundary query.`
  });
  return {
    code: a.code,
    count,
    provenance: prov,
    note: `M${USGS_MIN_MAG}+ quakes within ${USGS_RADIUS_KM} km of ${a.code} centroid, trailing ${USGS_WINDOW_DAYS} days.`
  };
}

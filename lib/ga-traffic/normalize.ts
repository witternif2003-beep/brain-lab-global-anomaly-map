export type LngLat = [number, number];

export interface Ga511Attributes {
  ID: number;
  RoadwayName: string | null;
  DirectionOfTravel: string | null;
  Description: string | null;
  LastUpdated: number | null;
  StartDate: number | null;
  PlannedEndDate: number | null;
  LanesAffected: string | null;
  Latitude: number | null;
  Longitude: number | null;
  EventType: string | null;
  IsFullClosure: string | null;
  EncodedPolyline: string | null;
  Severity: string | null;
}

export const EVENT_LABELS: Record<string, string> = {
  accidentsAndIncidents: "Incident",
  closures: "Closure",
  roadwork: "Roadwork",
  specialEvents: "Special event",
  weatherEvents: "Weather",
};

const DIRECTIONS: Record<string, string> = { n: "Northbound", s: "Southbound", e: "Eastbound", w: "Westbound", ns: "Both directions", ew: "Both directions" };

/** Google encoded-polyline decoder; returns [lng, lat] pairs. */
export function decodePolyline(s: string, precision = 5): LngLat[] {
  const factor = 10 ** precision;
  const out: LngLat[] = [];
  let i = 0;
  let lat = 0;
  let lng = 0;
  while (i < s.length) {
    for (let k = 0; k < 2; k++) {
      let result = 0;
      let shift = 0;
      let b: number;
      do {
        if (i >= s.length) return out;
        b = s.charCodeAt(i++) - 63;
        result |= (b & 31) << shift;
        shift += 5;
      } while (b >= 32);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (k === 0) lat += d;
      else lng += d;
    }
    out.push([lng / factor, lat / factor]);
  }
  return out;
}

const iso = (ms: number | null) => (ms ? new Date(ms).toISOString() : null);

export function normalize(rows: Ga511Attributes[]) {
  const points: GeoJSON.Feature<GeoJSON.Point>[] = [];
  const lines: GeoJSON.Feature<GeoJSON.LineString>[] = [];
  const byType: Record<string, number> = {};
  const bySeverity: Record<string, number> = {};
  let fullClosures = 0;
  let latest = 0;
  for (const r of rows) {
    if (r.Latitude == null || r.Longitude == null || !Number.isFinite(r.Latitude) || !Number.isFinite(r.Longitude)) continue;
    const type = r.EventType ?? "other";
    const severity = (r.Severity ?? "unknown").toLowerCase();
    const fullClosure = String(r.IsFullClosure).toLowerCase() === "true";
    const properties = {
      id: r.ID,
      type,
      label: EVENT_LABELS[type] ?? type,
      severity,
      roadway: r.RoadwayName ?? "",
      direction: DIRECTIONS[(r.DirectionOfTravel ?? "").toLowerCase()] ?? "",
      description: (r.Description ?? "").replace(/\s+/g, " ").trim(),
      lanes: r.LanesAffected ?? "",
      fullClosure,
      lastUpdated: iso(r.LastUpdated),
      start: iso(r.StartDate),
      plannedEnd: iso(r.PlannedEndDate),
    };
    points.push({ type: "Feature", geometry: { type: "Point", coordinates: [r.Longitude, r.Latitude] }, properties });
    const path = r.EncodedPolyline ? decodePolyline(r.EncodedPolyline) : [];
    if (path.length >= 2) lines.push({ type: "Feature", geometry: { type: "LineString", coordinates: path }, properties });
    byType[properties.label] = (byType[properties.label] ?? 0) + 1;
    bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;
    if (fullClosure) fullClosures++;
    latest = Math.max(latest, r.LastUpdated ?? 0);
  }
  return {
    points: { type: "FeatureCollection" as const, features: points },
    lines: { type: "FeatureCollection" as const, features: lines },
    summary: { total: points.length, byType, bySeverity, fullClosures, latestUpdate: iso(latest || null) },
  };
}

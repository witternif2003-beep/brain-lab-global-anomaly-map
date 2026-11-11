export const GA_BBOX = { west: -85.7, south: 30.3, east: -80.8, north: 35.1 };

export type FireConfidence = "low" | "nominal" | "high";

export interface FireDetection {
  lat: number;
  lon: number;
  detectedAt: string;
  satellite: string;
  instrument: "VIIRS" | "MODIS";
  confidence: FireConfidence;
  frpMw: number | null;
  daynight: "D" | "N" | null;
}

const SATELLITES: Record<string, string> = { N: "Suomi NPP", N20: "NOAA-20", N21: "NOAA-21", T: "Terra", A: "Aqua", Terra: "Terra", Aqua: "Aqua" };

/** VIIRS publishes l/n/h (or the full word); MODIS publishes 0–100, bucketed with FIRMS' <30 / 30–79 / ≥80 convention. */
export function confidenceOf(raw: string, instrument: FireDetection["instrument"]): FireConfidence {
  const v = raw.trim().toLowerCase();
  if (instrument === "MODIS") {
    const n = Number(v);
    return n >= 80 ? "high" : n >= 30 ? "nominal" : "low";
  }
  return v.startsWith("h") ? "high" : v.startsWith("l") ? "low" : "nominal";
}

/** Parses a FIRMS active-fire CSV, keeping detections inside the Georgia bounding box. */
export function parseFirmsCsv(text: string, instrument: FireDetection["instrument"], bbox = GA_BBOX): FireDetection[] {
  const lines = text.trim().split(/\r?\n/);
  const header = (lines.shift() ?? "").split(",");
  const col = (name: string) => header.indexOf(name);
  const [lat, lon, date, time, sat, conf, frp, dn] = ["latitude", "longitude", "acq_date", "acq_time", "satellite", "confidence", "frp", "daynight"].map(col);
  if (lat < 0 || lon < 0 || date < 0 || time < 0) throw new Error(`unexpected FIRMS header: ${header.join(",")}`);
  const out: FireDetection[] = [];
  for (const line of lines) {
    const c = line.split(",");
    const y = Number(c[lat]);
    const x = Number(c[lon]);
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < bbox.west || x > bbox.east || y < bbox.south || y > bbox.north) continue;
    const hhmm = (c[time] ?? "").padStart(4, "0");
    const detectedAt = new Date(`${c[date]}T${hhmm.slice(0, 2)}:${hhmm.slice(2)}:00Z`);
    if (Number.isNaN(detectedAt.getTime())) continue;
    const power = frp >= 0 && c[frp]?.trim() ? Number(c[frp]) : NaN;
    const d = dn >= 0 ? c[dn]?.trim() : "";
    out.push({
      lat: y,
      lon: x,
      detectedAt: detectedAt.toISOString(),
      satellite: SATELLITES[c[sat]?.trim() ?? ""] ?? (c[sat]?.trim() || "unknown"),
      instrument,
      confidence: confidenceOf(conf >= 0 ? c[conf] ?? "" : "", instrument),
      frpMw: Number.isFinite(power) ? power : null,
      daynight: d === "D" || d === "N" ? d : null,
    });
  }
  return out;
}

export function summarizeFires(fires: FireDetection[]) {
  const byConfidence: Record<FireConfidence, number> = { low: 0, nominal: 0, high: 0 };
  const bySatellite: Record<string, number> = {};
  let latest: string | null = null;
  let maxFrpMw: number | null = null;
  for (const f of fires) {
    byConfidence[f.confidence]++;
    bySatellite[f.satellite] = (bySatellite[f.satellite] ?? 0) + 1;
    if (!latest || f.detectedAt > latest) latest = f.detectedAt;
    if (f.frpMw !== null && (maxFrpMw === null || f.frpMw > maxFrpMw)) maxFrpMw = f.frpMw;
  }
  return { total: fires.length, byConfidence, bySatellite, latestDetection: latest, maxFrpMw };
}

export function firesToGeoJSON(fires: FireDetection[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: fires.map((f) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: [f.lon, f.lat] },
      properties: { ...f, label: `${f.satellite} · ${f.detectedAt.slice(11, 16)}Z` },
    })),
  };
}

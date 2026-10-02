export interface NwpsGauge {
  lid: string;
  name: string;
  state?: { abbreviation?: string };
  latitude: number;
  longitude: number;
  status?: {
    observed?: { primary: number; primaryUnit: string; secondary: number; secondaryUnit: string; floodCategory: string; validTime: string };
    forecast?: { primary: number; primaryUnit: string; floodCategory: string; validTime: string };
  };
}

export interface NwsAlert {
  geometry: GeoJSON.Geometry | null;
  properties: {
    id: string;
    event: string;
    severity: string;
    urgency: string;
    certainty: string;
    headline: string | null;
    areaDesc: string;
    onset: string | null;
    ends: string | null;
    expires: string | null;
    senderName: string;
    affectedZones: string[];
  };
}

/** NWS flood categories, in rising order of impact. */
export const FLOOD_RANK: Record<string, number> = { no_flooding: 0, action: 1, minor: 2, moderate: 3, major: 4 };

const reading = (v: number | undefined) => (typeof v === "number" && v > -900 ? v : null);
const time = (t: string | undefined) => (t && !t.startsWith("0001") ? t : null);

export function normalizeGauges(gauges: NwpsGauge[], state = "GA") {
  const byCategory: Record<string, number> = {};
  let latest = "";
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];
  for (const g of gauges) {
    if (g.state?.abbreviation !== state || !Number.isFinite(g.latitude) || !Number.isFinite(g.longitude)) continue;
    const o = g.status?.observed;
    const f = g.status?.forecast;
    const category = o?.floodCategory ?? "unknown";
    const stage = reading(o?.primary);
    const observedAt = time(o?.validTime);
    byCategory[category] = (byCategory[category] ?? 0) + 1;
    if (observedAt && observedAt > latest) latest = observedAt;
    features.push({
      type: "Feature",
      geometry: { type: "Point", coordinates: [g.longitude, g.latitude] },
      properties: {
        lid: g.lid,
        name: g.name,
        category,
        rank: FLOOD_RANK[category] ?? -1,
        stage,
        stageUnit: o?.primaryUnit ?? "",
        flow: reading(o?.secondary),
        flowUnit: o?.secondaryUnit ?? "",
        observedAt,
        forecastCategory: f?.floodCategory ?? null,
        forecastStage: reading(f?.primary),
        forecastAt: time(f?.validTime),
        label: stage === null ? g.name : `${g.name}\n${stage.toFixed(2)} ${o?.primaryUnit ?? ""}`.trim(),
      },
    });
  }
  const flooding = features.filter((f) => (f.properties?.rank as number) >= 2).length;
  const action = features.filter((f) => f.properties?.rank === 1).length;
  return {
    geojson: { type: "FeatureCollection" as const, features },
    summary: { total: features.length, flooding, action, byCategory, latestObservation: latest || null },
  };
}

/** True for Georgia NWS forecast/county zone URLs (e.g. .../zones/county/GAC001). */
export const isGaZone = (url: string) => /\/GA[CZ]\d{3}$/.test(url);

/** Maps each alert inside Georgia; alerts that also cover other states are drawn with their Georgia zones only. */
export function normalizeAlerts(alerts: NwsAlert[], zoneGeometry: (url: string) => GeoJSON.Geometry | undefined) {
  const features: GeoJSON.Feature[] = [];
  const byEvent: Record<string, number> = {};
  for (const a of alerts) {
    const p = a.properties;
    byEvent[p.event] = (byEvent[p.event] ?? 0) + 1;
    const gaZones = p.affectedZones.filter(isGaZone);
    const useZones = !a.geometry || gaZones.length < p.affectedZones.length;
    const zoneShapes = gaZones.map(zoneGeometry).filter((g): g is GeoJSON.Geometry => !!g);
    const geometries = useZones && zoneShapes.length ? zoneShapes : a.geometry ? [a.geometry] : [];
    const properties = {
      id: p.id,
      event: p.event,
      severity: p.severity,
      urgency: p.urgency,
      certainty: p.certainty,
      headline: p.headline ?? p.event,
      areaDesc: p.areaDesc,
      onset: p.onset,
      ends: p.ends ?? p.expires,
      sender: p.senderName,
      geometrySource: useZones && zoneShapes.length ? "Georgia NWS zone outlines" : "alert polygon",
    };
    for (const geometry of geometries) features.push({ type: "Feature", geometry, properties });
  }
  return {
    geojson: { type: "FeatureCollection" as const, features },
    summary: { total: alerts.length, mapped: new Set(features.map((f) => f.properties?.id)).size, byEvent },
  };
}

import { cellArea, cellToBoundary, latLngToCell } from 'h3-js';
import type { GeoJSONFeatureDiff, GeoJSONFeatureId, GeoJSONSourceDiff } from 'maplibre-gl';
import type { Gauge } from '../metrics/prometheus';

/** Bins with fewer Bluetooth devices than this are withheld. */
export const BLE_K_MIN = 3;
/** H3 resolution 8: cells of about 0.74 km². */
export const BLE_H3_RES = 8;
export const ADDINSIGHT_BASE = 'https://data.addinsight.com/ACT';
export const ADDINSIGHT_CATALOG = 'https://www.data.act.gov.au/d/cjkg-rvmu';
export const ADDINSIGHT_ATTRIBUTION = 'Bluetooth travel data: Transport Canberra and City Services, ACT Government (Addinsight open data, CC BY 4.0)';

/** One Addinsight Bluetooth detector site with its latest 5-minute detection statistics (sites_prop_stats_geo.json). */
export interface AddinsightSiteProps {
  SiteId: number;
  Name: string;
  IntervalStart: string;
  ProbeCount: number;
}

/** One Addinsight road link between two detector sites with its latest travel-time statistics (links_prop_stats_geo.json). */
export interface AddinsightLinkProps {
  Id: number;
  Name: string;
  Direction: string;
  Length: number;
  MinTT: number;
  IntervalStart: string;
  TT: number;
  Delay: number;
  Speed: number;
  Congestion: number;
  Score: number;
  EnoughData: boolean;
  Closed: boolean;
}

export type SiteFeature = GeoJSON.Feature<GeoJSON.Point, AddinsightSiteProps>;
export type LinkFeature = GeoJSON.Feature<GeoJSON.LineString, AddinsightLinkProps>;

export interface AggregatedBleBin {
  /** H3 cell index. */
  bin_id: string;
  /** Bluetooth devices detected in the cell's latest 5-minute interval, summed over its detector sites. */
  count: number;
  /** count / cell area, per km². */
  density: number;
  sites: number;
  /** ISO 8601 start of the newest interval in the cell. */
  last_updated: string;
}

export interface BinResult {
  bins: AggregatedBleBin[];
  suppressedBins: number;
  suppressedDevices: number;
}

export interface BleLinkProps {
  name: string;
  direction: string;
  lengthM: number;
  /** null when Addinsight flags the interval as having too few matched devices. */
  speedKmh: number | null;
  travelTimeS: number | null;
  freeFlowS: number;
  delayS: number | null;
  score: number;
  closed: boolean;
  last_updated: string;
}

export interface BleTrafficPayload {
  source: string;
  sourceUrl: string;
  attribution: string;
  generatedAt: string;
  sourceUpdatedAt: string | null;
  sourceLagSeconds: number | null;
  k: number;
  h3Resolution: number;
  bins: AggregatedBleBin[];
  binFeatures: GeoJSON.FeatureCollection<GeoJSON.Polygon, AggregatedBleBin>;
  linkFeatures: GeoJSON.FeatureCollection<GeoJSON.LineString, BleLinkProps>;
  suppressed: { bins: number; devices: number };
  links: { total: number; reporting: number; insufficientData: number; closed: number };
}

const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const newer = (a: string | null, b: string) => (a === null || Date.parse(b) > Date.parse(a) ? b : a);

/** Sums detector counts into H3 cells and withholds cells with fewer than k devices. Site names and ids are dropped. */
export function binSites(sites: SiteFeature[], k = BLE_K_MIN, res = BLE_H3_RES): BinResult {
  const cells = new Map<string, { count: number; sites: number; last: string | null }>();
  for (const s of sites) {
    const [lng, lat] = s.geometry?.coordinates ?? [];
    const n = s.properties?.ProbeCount;
    if (!finite(lng) || !finite(lat) || !finite(n) || n < 0 || !s.properties.IntervalStart) continue;
    const id = latLngToCell(lat, lng, res);
    const c = cells.get(id) ?? { count: 0, sites: 0, last: null };
    c.count += n;
    c.sites += 1;
    c.last = newer(c.last, s.properties.IntervalStart);
    cells.set(id, c);
  }
  const out: BinResult = { bins: [], suppressedBins: 0, suppressedDevices: 0 };
  for (const [id, c] of cells) {
    if (c.count < k) {
      out.suppressedBins += 1;
      out.suppressedDevices += c.count;
      continue;
    }
    out.bins.push({
      bin_id: id,
      count: c.count,
      density: Math.round((c.count / cellArea(id, 'km2')) * 10) / 10,
      sites: c.sites,
      last_updated: new Date(Date.parse(c.last as string)).toISOString(),
    });
  }
  out.bins.sort((a, b) => a.bin_id.localeCompare(b.bin_id));
  return out;
}

export function binFeatures(bins: AggregatedBleBin[]): GeoJSON.FeatureCollection<GeoJSON.Polygon, AggregatedBleBin> {
  return {
    type: 'FeatureCollection',
    features: bins.map((b) => {
      const ring = cellToBoundary(b.bin_id, true);
      return { type: 'Feature', id: b.bin_id, geometry: { type: 'Polygon', coordinates: [[...ring, ring[0]]] }, properties: b };
    }),
  };
}

const round5 = (c: GeoJSON.Position) => [Math.round(c[0] * 1e5) / 1e5, Math.round(c[1] * 1e5) / 1e5];

export function linkFeatures(links: LinkFeature[]): GeoJSON.FeatureCollection<GeoJSON.LineString, BleLinkProps> {
  return {
    type: 'FeatureCollection',
    features: links.flatMap((l) => {
      const p = l.properties;
      if (!p || !finite(p.Id) || l.geometry?.type !== 'LineString' || l.geometry.coordinates.length < 2) return [];
      const ok = p.EnoughData === true && finite(p.Speed) && p.Speed >= 0;
      const props: BleLinkProps = {
        name: String(p.Name ?? ''),
        direction: String(p.Direction ?? ''),
        lengthM: finite(p.Length) ? p.Length : 0,
        speedKmh: ok ? p.Speed : null,
        travelTimeS: ok && finite(p.TT) ? p.TT : null,
        freeFlowS: finite(p.MinTT) ? p.MinTT : 0,
        delayS: ok && finite(p.Delay) ? p.Delay : null,
        score: ok && finite(p.Score) ? p.Score : 0,
        closed: p.Closed === true,
        last_updated: p.IntervalStart ? new Date(Date.parse(p.IntervalStart)).toISOString() : '',
      };
      return [{ type: 'Feature' as const, id: p.Id, geometry: { type: 'LineString' as const, coordinates: l.geometry.coordinates.map(round5) }, properties: props }];
    }),
  };
}

export function buildPayload(sites: SiteFeature[], links: LinkFeature[], now: number): BleTrafficPayload {
  const b = binSites(sites);
  const lf = linkFeatures(links);
  let updated: string | null = null;
  for (const f of lf.features) if (f.properties.last_updated) updated = newer(updated, f.properties.last_updated);
  for (const x of b.bins) updated = newer(updated, x.last_updated);
  const reporting = lf.features.filter((f) => f.properties.speedKmh !== null).length;
  return {
    source: 'ACT Government Bluetooth detectors (Addinsight real-time open data, Canberra, Australia)',
    sourceUrl: ADDINSIGHT_CATALOG,
    attribution: ADDINSIGHT_ATTRIBUTION,
    generatedAt: new Date(now).toISOString(),
    sourceUpdatedAt: updated,
    sourceLagSeconds: updated ? Math.max(0, Math.round((now - Date.parse(updated)) / 1000)) : null,
    k: BLE_K_MIN,
    h3Resolution: BLE_H3_RES,
    bins: b.bins,
    binFeatures: binFeatures(b.bins),
    linkFeatures: lf,
    suppressed: { bins: b.suppressedBins, devices: b.suppressedDevices },
    links: {
      total: lf.features.length,
      reporting,
      insufficientData: lf.features.length - reporting,
      closed: lf.features.filter((f) => f.properties.closed).length,
    },
  };
}

type IdFeature = GeoJSON.Feature & { id: GeoJSONFeatureId };

/** Remove / add / update diff from the previous features (by id) to the next ones, for GeoJSONSource.updateData. */
export function diffFeatures(prev: Map<GeoJSONFeatureId, IdFeature>, next: IdFeature[]): GeoJSONSourceDiff & { size: number } {
  const seen = new Set<GeoJSONFeatureId>();
  const add: GeoJSON.Feature[] = [];
  const update: GeoJSONFeatureDiff[] = [];
  for (const f of next) {
    seen.add(f.id);
    const old = prev.get(f.id);
    if (!old) {
      add.push(f);
      continue;
    }
    const d: GeoJSONFeatureDiff = { id: f.id };
    if (JSON.stringify(old.geometry) !== JSON.stringify(f.geometry)) d.newGeometry = f.geometry;
    const props = f.properties ?? {};
    const was = old.properties ?? {};
    const changed = Object.keys(props).filter((key) => props[key] !== was[key]).map((key) => ({ key, value: props[key] }));
    const gone = Object.keys(was).filter((key) => !(key in props));
    if (changed.length) d.addOrUpdateProperties = changed;
    if (gone.length) d.removeProperties = gone;
    if (d.newGeometry || changed.length || gone.length) update.push(d);
  }
  const remove = [...prev.keys()].filter((id) => !seen.has(id));
  return { add, update, remove, size: add.length + update.length + remove.length };
}

/** Server-side gauges from one /api/ble-traffic probe (null body = request failed). */
export function bleGauges(body: BleTrafficPayload | null): Gauge[] {
  return [
    { name: 'ble_source_up', help: '1 when /api/ble-traffic returned the ACT Bluetooth feed, 0 when the source was offline.', values: [{ value: body ? 1 : 0 }] },
    { name: 'ble_source_lag_seconds', help: 'Seconds since the newest ACT Bluetooth interval start.', values: [{ value: body?.sourceLagSeconds ?? null }] },
    { name: 'ble_bins_published', help: `H3 cells with at least ${BLE_K_MIN} Bluetooth devices in the latest interval.`, values: [{ value: body?.bins.length ?? null }] },
    { name: 'ble_bins_suppressed', help: `H3 cells withheld for having fewer than ${BLE_K_MIN} devices (k-anonymity).`, values: [{ value: body?.suppressed.bins ?? null }] },
    { name: 'ble_links_reporting', help: 'Road links with enough matched Bluetooth devices for a travel time.', values: [{ value: body?.links.reporting ?? null }] },
    { name: 'ble_links_insufficient_data', help: 'Road links Addinsight flags as having too few matched devices.', values: [{ value: body?.links.insufficientData ?? null }] },
  ];
}

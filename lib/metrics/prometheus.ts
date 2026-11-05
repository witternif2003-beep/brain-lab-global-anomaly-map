import type { LiveMarker } from '../ga-live-markers/parse';

export type Labels = Record<string, string>;
export interface Gauge {
  name: string;
  help: string;
  values: { labels?: Labels; value: number | null }[];
}

export interface LayerProbe {
  layer: string;
  durationMs: number;
  body: { markers?: LiveMarker[]; feeds?: { error: string | null }[] } | null;
}

const escapeLabel = (v: string) => v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/"/g, '\\"');

/** Prometheus text exposition format 0.0.4; samples with a null value are omitted. */
export function formatPrometheus(gauges: Gauge[]): string {
  const out: string[] = [];
  for (const g of gauges) {
    out.push(`# HELP ${g.name} ${g.help.replace(/\n/g, ' ')}`, `# TYPE ${g.name} gauge`);
    for (const { labels, value } of g.values) {
      if (value === null || !Number.isFinite(value)) continue;
      const l = labels && Object.keys(labels).length
        ? `{${Object.entries(labels).map(([k, v]) => `${k}="${escapeLabel(v)}"`).join(',')}}`
        : '';
      out.push(`${g.name}${l} ${value}`);
    }
  }
  return `${out.join('\n')}\n`;
}

/** Seconds between `now` and the newest marker observation, or null when no marker carries a time. */
export function newestAgeSeconds(markers: LiveMarker[], now: number): number | null {
  let newest = -Infinity;
  for (const m of markers) {
    const t = m.observedAt ? Date.parse(m.observedAt) : NaN;
    if (t > newest) newest = t;
  }
  return Number.isFinite(newest) ? Math.max(0, Math.round((now - newest) / 1000)) : null;
}

/** Markers observed at or after `since`. */
export function eventsSince(markers: LiveMarker[], since: number): number {
  return markers.filter((m) => m.observedAt !== null && Date.parse(m.observedAt) >= since).length;
}

/** FAA TFRs whose effective window contains `now` (no expiry = still in force). */
export function activeTfrCount(markers: LiveMarker[], now: number): number {
  return markers.filter((m) => {
    const from = typeof m.props.effective === 'string' ? Date.parse(m.props.effective) : -Infinity;
    const to = typeof m.props.expires === 'string' ? Date.parse(m.props.expires) : Infinity;
    return from <= now && now < to;
  }).length;
}

export function liveFeedGauges(probes: LayerProbe[], now: number): Gauge[] {
  const by = new Map(probes.map((p) => [p.layer, p]));
  const markers = (layer: string) => by.get(layer)?.body?.markers ?? null;
  const per = (f: (p: LayerProbe) => number | null) => probes.map((p) => ({ labels: { layer: p.layer }, value: f(p) }));
  const quakes = markers('quakes');
  const tfr = markers('tfr');
  const transit = markers('transit');
  return [
    { name: 'ga_feed_up', help: '1 when /api/ga-live-markers returned the layer, 0 when it failed.', values: per((p) => (p.body ? 1 : 0)) },
    { name: 'ga_feed_request_duration_ms', help: 'Time to fetch the layer from /api/ga-live-markers (includes CDN cache hits).', values: per((p) => Math.round(p.durationMs)) },
    { name: 'ga_feed_markers', help: 'Markers returned for the layer.', values: per((p) => p.body?.markers?.length ?? null) },
    { name: 'ga_feed_source_errors', help: 'Upstream sources of the layer that failed on the last refresh.', values: per((p) => p.body?.feeds?.filter((f) => f.error).length ?? null) },
    { name: 'ga_feed_data_age_seconds', help: 'Age of the newest observation in the layer.', values: per((p) => newestAgeSeconds(p.body?.markers ?? [], now)) },
    { name: 'aircraft_ingest_latency_ms', help: 'Time to fetch the ADS-B aircraft layer.', values: [{ value: by.get('aircraft')?.body ? Math.round(by.get('aircraft')!.durationMs) : null }] },
    { name: 'transit_gtfs_staleness_seconds', help: 'Age of the newest GTFS-realtime bus position.', values: [{ value: transit ? newestAgeSeconds(transit, now) : null }] },
    { name: 'usgs_seismic_events_30d', help: 'USGS ComCat earthquakes in the Georgia area in the last 30 days.', values: [{ value: quakes?.length ?? null }] },
    { name: 'usgs_seismic_event_delta', help: 'USGS earthquakes in the Georgia area whose origin time is within the last hour.', values: [{ value: quakes ? eventsSince(quakes, now - 3_600_000) : null }] },
    { name: 'usgs_seismic_latest_event_age_seconds', help: 'Seconds since the most recent USGS earthquake in the Georgia area.', values: [{ value: quakes ? newestAgeSeconds(quakes, now) : null }] },
    { name: 'faa_restriction_active_count', help: 'FAA TFRs in Georgia currently in effect.', values: [{ value: tfr ? activeTfrCount(tfr, now) : null }] },
  ];
}

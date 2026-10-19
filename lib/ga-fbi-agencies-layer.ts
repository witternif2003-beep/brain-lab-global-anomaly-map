import { Popup } from 'maplibre-gl';
import type { ExpressionSpecification, GeoJSONSource, Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import { AGENCY_TYPES, agencyTypeColor, CDE_WEBAPP, OFFENSES, policeStrobeColor, type Agency, type AgencyCategory, type OffenseSeries } from './fbi-agencies/parse';
import { STROBE_MS } from './ga-live-markers/strobe';
import { reportGaFeed } from './ga-live-status';
import { hitsGaDeck } from './ga-deck-overlay';

const SRC = 'ga-fbi-agencies';
const DOT = `${SRC}-dot`;
const HALO = `${SRC}-halo`;
const LABEL = `${SRC}-label`;
const REFRESH_MS = 6 * 60 * 60_000;
const BLINK_MS = 240;
const FEED = { id: 'fbi-agencies', label: 'FBI CDE reporting agencies, Georgia', color: '#ff2bd6', sourceUrl: 'https://cde.ucr.cjis.gov/LATEST/agency/byStateAbbr/GA' };
const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

interface DirectoryPayload {
  retrievedAt?: string;
  sha256?: string;
  totals?: { agencies: number; mapped: number; nibrs: number };
  categories?: AgencyCategory[];
  agencyOffenseSeries?: number;
  agencies?: Agency[];
  error?: string;
}

interface AgencyPayload {
  retrievedAt?: string;
  maxDataDate?: string | null;
  lastRefreshDate?: string | null;
  series?: OffenseSeries[];
  sources?: { offense: string; url: string; sha256: string | null; error: string | null }[];
  error?: string;
}

interface AgencyProps {
  ori: string;
  name?: string;
  type?: string;
  counties?: string;
  nibrs?: boolean | string;
  nibrsStart?: string;
}

interface State {
  agencies: Agency[];
  firstSeen: Map<string, number>;
  loaded: boolean;
}

declare global {
  interface Window {
    __gaFbiAgencies?: { agencies: number; strobing: () => string[] };
  }
}

const bound = new WeakSet<MapLibreMap>();

const typeColor: ExpressionSpecification = ['match', ['get', 'type'], ...AGENCY_TYPES.flatMap((t) => [t.type, t.color]), '#f8fafc'] as unknown as ExpressionSpecification;

const strobing = (s: State, now: number) => [...s.firstSeen.values()].some((t) => t > 0 && now - t < STROBE_MS);

function features(s: State, now: number): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: s.agencies.flatMap((a) =>
      a.lat === null || a.lon === null
        ? []
        : [{
            type: 'Feature' as const,
            geometry: { type: 'Point' as const, coordinates: [a.lon, a.lat] },
            properties: { ori: a.ori, name: a.name, type: a.type, counties: a.counties, nibrs: a.nibrs, nibrsStart: a.nibrsStart ?? '', strobe: (() => { const t = s.firstSeen.get(a.ori) ?? 0; return t > 0 && now - t < STROBE_MS; })() },
          }],
    ),
  };
}

function ensureLayers(map: MapLibreMap): void {
  if (!map.getSource(SRC)) map.addSource(SRC, { type: 'geojson', data: EMPTY, attribution: 'FBI Crime Data Explorer agency directory (public, U.S. Government work)' });
  if (!map.getLayer(HALO)) {
    map.addLayer({
      id: HALO,
      type: 'circle',
      source: SRC,
      filter: ['==', ['get', 'strobe'], true],
      paint: { 'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 9, 12, 18], 'circle-color': '#ff1744', 'circle-opacity': 0.35, 'circle-blur': 0.6, 'circle-pitch-alignment': 'map' },
    });
  }
  if (!map.getLayer(DOT)) {
    map.addLayer({
      id: DOT,
      type: 'circle',
      source: SRC,
      layout: { 'circle-sort-key': ['case', ['get', 'strobe'], 1, 0] },
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 6, 3, 12, 7],
        'circle-color': typeColor,
        'circle-opacity': 0.92,
        'circle-stroke-color': ['case', ['get', 'nibrs'], '#ffffff', '#64748b'],
        'circle-stroke-width': ['case', ['get', 'nibrs'], 1.4, 0.8],
        'circle-pitch-alignment': 'map',
      },
    });
  }
  if (!map.getLayer(LABEL)) {
    map.addLayer({
      id: LABEL,
      type: 'symbol',
      source: SRC,
      minzoom: 10,
      layout: { 'symbol-sort-key': ['case', ['get', 'strobe'], 0, 1], 'text-field': ['get', 'name'], 'text-size': 10, 'text-offset': [0, 1.1], 'text-anchor': 'top', 'text-optional': true },
      paint: { 'text-color': '#fdf2f8', 'text-halo-color': '#1e1b4b', 'text-halo-width': 1.2 },
    });
  }
}

function blink(map: MapLibreMap, s: State): void {
  if (!map.getLayer(DOT)) return;
  const now = Date.now();
  const c = policeStrobeColor(now, BLINK_MS);
  map.setPaintProperty(DOT, 'circle-color', strobing(s, now) ? ['case', ['get', 'strobe'], c, typeColor] : typeColor);
  if (map.getLayer(HALO)) map.setPaintProperty(HALO, 'circle-color', c);
}

function setData(map: MapLibreMap, s: State): void {
  (map.getSource(SRC) as GeoJSONSource | undefined)?.setData(features(s, Date.now()));
}

const row = (box: HTMLElement, k: string, v: string) => {
  if (!v) return;
  const r = document.createElement('div');
  const b = document.createElement('b');
  b.textContent = `${k}: `;
  r.append(b, v);
  box.append(r);
};

function offenceRows(box: HTMLElement, d: AgencyPayload, popup: Popup): boolean {
  const strobeDots: HTMLSpanElement[] = [];
  const shaByOffense = new Map((d.sources ?? []).map((x) => [x.offense, x.sha256]));
  for (const sr of d.series ?? []) {
    const r = document.createElement('div');
    r.style.cssText = 'display:flex;gap:5px;align-items:center;margin-top:2px';
    const dot = document.createElement('span');
    dot.style.cssText = `width:8px;height:8px;border-radius:50%;flex:none;background:${sr.color};box-shadow:0 0 5px ${sr.color}`;
    if (sr.newInLatestFbiMonth) strobeDots.push(dot);
    const name = document.createElement('span');
    name.textContent = `FBI CDE · ${sr.label}`;
    name.style.fontWeight = '700';
    const v = document.createElement('span');
    v.style.cssText = 'margin-left:auto;white-space:nowrap';
    v.textContent = sr.total === null ? 'not reported' : `${sr.total.toLocaleString()} / 12 mo · ${sr.latestMonth ?? '—'}: ${sr.latest ?? '—'}`;
    r.title = `SHA-256 ${shaByOffense.get(sr.offense) ?? 'n/a'}`;
    r.append(dot, name, v);
    box.append(r);
  }
  if (strobeDots.length) {
    const t = setInterval(() => strobeDots.forEach((el) => {
      const c = policeStrobeColor(Date.now(), BLINK_MS);
      el.style.background = c;
      el.style.boxShadow = `0 0 7px ${c}`;
    }), BLINK_MS);
    popup.once('close', () => clearInterval(t));
  }
  const failed = (d.sources ?? []).filter((x) => x.error);
  const foot = document.createElement('div');
  foot.style.cssText = 'margin-top:5px;color:#475569';
  foot.textContent = [
    strobeDots.length ? `red/blue = offences reported in the newest FBI month (${d.maxDataDate ?? '—'})` : '',
    `Source grade A: FBI Crime Data Explorer · retrieved ${d.retrievedAt ? new Date(d.retrievedAt).toLocaleString() : '—'}${d.lastRefreshDate ? ` · FBI refresh ${d.lastRefreshDate}` : ''}`,
    failed.length ? `${failed.length} of ${OFFENSES.length} categories unavailable` : '',
    'Reported offences by month for the whole agency; not live, not about any person, not a finding of admissibility.',
  ].filter(Boolean).join(' · ');
  box.append(foot);
  return strobeDots.length > 0;
}

/** Georgia law-enforcement agencies from the FBI CDE directory, coloured by agency type, with per-agency FBI offence categories on tap. */
export function addGaFbiAgencyLayers(map: MapLibreMap): void {
  ensureLayers(map);
  if (bound.has(map)) return;
  bound.add(map);
  const s: State = { agencies: [], firstSeen: new Map(), loaded: false };
  if (typeof window !== 'undefined') {
    window.__gaFbiAgencies = {
      get agencies() {
        return s.agencies.length;
      },
      strobing: () => [...s.firstSeen].filter(([, t]) => t > 0 && Date.now() - t < STROBE_MS).map(([ori]) => ori),
    };
  }

  const refresh = async () => {
    try {
      const r = await fetch('/api/fbi/agencies');
      const d = (await r.json()) as DirectoryPayload;
      if (!r.ok || !d.agencies) throw new Error(d.error ?? `HTTP ${r.status}`);
      const now = Date.now();
      const next = new Map<string, number>();
      for (const a of d.agencies) next.set(a.ori, s.loaded ? s.firstSeen.get(a.ori) ?? now : s.firstSeen.get(a.ori) ?? 0);
      s.firstSeen = next;
      s.agencies = d.agencies;
      s.loaded = true;
      setData(map, s);
      const byType = new Map<string, number>();
      for (const c of d.categories ?? []) byType.set(c.type, (byType.get(c.type) ?? 0) + c.count);
      reportGaFeed(map, {
        ...FEED,
        count: d.totals?.agencies ?? d.agencies.length,
        detail: `${d.totals?.mapped ?? 0} mapped · ${d.totals?.nibrs ?? 0} NIBRS (white ring) · ${(d.categories ?? []).length} agency type × NIBRS categories · ${OFFENSES.length} FBI offence categories per agency (${(d.agencyOffenseSeries ?? 0).toLocaleString()} agency×offence series, loaded on tap) · new = red/blue strobe 10 min · refresh 6 h`,
        updatedAt: d.retrievedAt ?? null,
        sha256: d.sha256,
        swatches: [...AGENCY_TYPES.map((t) => ({ label: t.type, color: t.color, count: byType.get(t.type) ?? 0 })), ...OFFENSES.map((o) => ({ label: o.label, color: o.color }))],
      });
    } catch (err) {
      reportGaFeed(map, { ...FEED, count: null, updatedAt: null, error: String(err instanceof Error ? err.message : err) });
    }
  };
  void refresh();
  const refreshTimer = setInterval(() => void refresh(), REFRESH_MS);
  const blinkTimer = setInterval(() => {
    const now = Date.now();
    if (strobing(s, now)) blink(map, s);
  }, BLINK_MS);
  const expireTimer = setInterval(() => {
    setData(map, s);
    blink(map, s);
  }, 60_000);
  map.on('style.load', () => {
    ensureLayers(map);
    setData(map, s);
  });
  map.once('remove', () => {
    clearInterval(refreshTimer);
    clearInterval(blinkTimer);
    clearInterval(expireTimer);
    bound.delete(map);
  });

  const showAgency = (box: HTMLElement, popup: Popup, p: AgencyProps) => {
    const ori = p.ori;
    box.replaceChildren();
    const h = document.createElement('div');
    h.textContent = `FBI CDE AGENCY · ${p.name ?? ori}`;
    h.style.cssText = 'font-weight:800;margin-bottom:4px';
    box.append(h);
    row(box, 'Category', `${p.type ?? 'Other'} · ${String(p.nibrs) === 'true' ? `NIBRS since ${p.nibrsStart || '—'}` : 'not NIBRS'}`);
    row(box, 'County', p.counties ?? '');
    row(box, 'ORI', ori);
    const status = document.createElement('div');
    status.textContent = 'Loading 10 FBI offence categories…';
    status.style.cssText = 'margin-top:4px;color:#475569';
    box.append(status);
    const link = document.createElement('a');
    link.href = CDE_WEBAPP;
    link.target = '_blank';
    link.rel = 'noreferrer';
    link.textContent = 'FBI Crime Data Explorer';
    link.style.cssText = 'display:block;margin-top:4px;color:#7c3aed';
    void (async () => {
      try {
        const r = await fetch(`/api/fbi/agency?ori=${encodeURIComponent(ori)}`);
        const d = (await r.json()) as AgencyPayload;
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
        status.remove();
        if (offenceRows(box, d, popup)) {
          s.firstSeen.set(ori, Date.now());
          setData(map, s);
        }
      } catch (err) {
        status.textContent = `FBI CDE unavailable: ${err instanceof Error ? err.message : String(err)}`;
        status.style.color = '#b91c1c';
      }
      box.append(link);
    })();
  };

  map.on('click', DOT, (e: MapLayerMouseEvent) => {
    if (hitsGaDeck(map, e.point)) return;
    const seen = new Set<string>();
    const here = (e.features ?? []).flatMap((f) => {
      const p = f.properties as AgencyProps | null;
      if (!p?.ori || seen.has(p.ori)) return [];
      seen.add(p.ori);
      return [p];
    });
    if (!here.length) return;
    const box = document.createElement('div');
    box.style.cssText = 'font:11px ui-monospace,monospace;color:#0f172a;line-height:1.45';
    const popup = new Popup({ closeButton: true, maxWidth: 'min(340px, 92vw)' }).setLngLat(e.lngLat).setDOMContent(box).addTo(map);
    if (here.length === 1) return showAgency(box, popup, here[0]);
    const h = document.createElement('div');
    h.textContent = `${here.length} FBI CDE AGENCIES AT THIS POINT`;
    h.style.cssText = 'font-weight:800;margin-bottom:4px';
    box.append(h);
    for (const p of here.sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))) {
      const b = document.createElement('button');
      b.type = 'button';
      b.dataset.ori = p.ori;
      b.textContent = `${p.name ?? p.ori} · ${p.type ?? 'Other'}`;
      b.style.cssText = `display:block;width:100%;text-align:left;margin-top:3px;padding:3px 5px;border:1px solid ${agencyTypeColor(p.type ?? 'Other')};border-radius:6px;background:#fff;font:inherit;cursor:pointer`;
      b.addEventListener('click', () => showAgency(box, popup, p));
      box.append(b);
    }
  });
  map.on('mouseenter', DOT, () => (map.getCanvas().style.cursor = 'pointer'));
  map.on('mouseleave', DOT, () => (map.getCanvas().style.cursor = ''));
}

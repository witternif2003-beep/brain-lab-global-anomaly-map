import type { IControl, Map as MapLibreMap } from 'maplibre-gl';
import { BEACON_CATEGORIES } from './ga-beacon-categories';

export interface GaFeedStatus {
  id: string;
  label: string;
  color: string;
  count: number | null;
  detail?: string;
  updatedAt: string | null;
  sourceUrl: string;
  error?: string | null;
}

const STALE_MIN = 90;
const order = ['anomalies', 'aircraft', 'transit', 'micromobility', 'stations', 'streamgauges', 'quakes', 'tfr', 'augusta911', 'athens911', 'gdotcams', 'police', 'firestations', 'sirens', 'speedcams', 'alpr', 'towers', 'signals', 'gps-integrity', 'satellites', 'fires', 'imagery', 'traffic', 'alerts', 'gauges', 'crime', 'fbi-wanted', 'fbi-cde', 'renderer', 'bench'];
const feeds = new WeakMap<MapLibreMap, Map<string, GaFeedStatus>>();
const controls = new WeakMap<MapLibreMap, GaLiveLegend>();

function age(iso: string | null): { text: string; stale: boolean } {
  if (!iso) return { text: 'no timestamp', stale: true };
  const min = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  const text = min < 1 ? 'just now' : min < 60 ? `${min} min ago` : min < 2880 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`;
  return { text, stale: min > STALE_MIN };
}

/** Collapsible in-map legend listing each live Georgia feed with its record count, data age and source. */
class GaLiveLegend implements IControl {
  private el: HTMLDetailsElement | null = null;
  private body: HTMLDivElement | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private map: MapLibreMap | null = null;
  private beaconsOpen = false;

  onAdd(map: MapLibreMap): HTMLElement {
    this.map = map;
    const el = document.createElement('details');
    el.className = 'maplibregl-ctrl';
    el.open = typeof window !== 'undefined' && window.innerWidth >= 640;
    el.style.cssText =
      'background:rgba(7,14,28,.92);border:1px solid rgba(56,189,248,.5);border-radius:10px;color:#e2e8f0;font:10px ui-monospace,monospace;max-width:min(270px,70vw);padding:6px 8px;pointer-events:auto';
    const summary = document.createElement('summary');
    summary.textContent = 'GEORGIA LIVE PUBLIC FEEDS';
    summary.style.cssText = 'cursor:pointer;font-weight:800;letter-spacing:.06em;color:#38bdf8';
    this.body = document.createElement('div');
    el.append(summary, this.body);
    this.el = el;
    this.render();
    this.timer = setInterval(() => this.render(), 30_000);
    return el;
  }

  onRemove(): void {
    if (this.timer) clearInterval(this.timer);
    this.el?.remove();
    this.el = null;
  }

  render(): void {
    if (!this.body || !this.map) return;
    const list = [...(feeds.get(this.map)?.values() ?? [])].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    this.body.replaceChildren();
    for (const f of list) {
      const row = document.createElement('div');
      row.style.cssText = 'margin-top:5px;line-height:1.35';
      const head = document.createElement('div');
      head.style.cssText = 'display:flex;gap:6px;align-items:center';
      const dot = document.createElement('span');
      dot.style.cssText = `width:8px;height:8px;border-radius:50%;flex:none;background:${f.color}`;
      const name = document.createElement('a');
      name.href = f.sourceUrl;
      name.target = '_blank';
      name.rel = 'noreferrer';
      name.textContent = f.label;
      name.style.cssText = 'color:#f8fafc;font-weight:700;text-decoration:none';
      const n = document.createElement('span');
      n.textContent = f.count === null ? '—' : f.count.toLocaleString();
      n.style.cssText = 'margin-left:auto;font-weight:800;color:#f8fafc';
      head.append(dot, name, n);
      const a = age(f.updatedAt);
      const sub = document.createElement('div');
      sub.style.cssText = `padding-left:14px;color:${f.error ? '#f87171' : a.stale ? '#fbbf24' : '#94a3b8'}`;
      sub.textContent = f.error ? `feed error: ${f.error}` : [f.detail, `data ${a.text}`].filter(Boolean).join(' · ');
      row.append(head, sub);
      this.body.append(row);
    }
    if (!list.length) this.body.textContent = 'loading…';
    else this.body.append(this.beacons(list));
  }

  private beacons(list: GaFeedStatus[]): HTMLDetailsElement {
    const byId = new Map(list.map((f) => [f.id, f]));
    const total = list.reduce((a, f) => a + (f.count ?? 0), 0);
    const el = document.createElement('details');
    el.open = this.beaconsOpen;
    el.addEventListener('toggle', () => (this.beaconsOpen = el.open));
    el.style.cssText = 'margin-top:8px;border-top:1px solid rgba(239,68,68,.45);padding-top:5px';
    const mapped = BEACON_CATEGORIES.filter((c) => c.feeds.length).length;
    const summary = document.createElement('summary');
    summary.textContent = `BEACON CATEGORIES · ${mapped} public / ${BEACON_CATEGORIES.length - mapped} not public`;
    summary.style.cssText = 'cursor:pointer;font-weight:800;letter-spacing:.06em;color:#f87171';
    el.append(summary);
    let domain = '';
    BEACON_CATEGORIES.forEach((c, i) => {
      if (c.domain !== domain) {
        domain = c.domain;
        const h = document.createElement('div');
        h.textContent = domain.toUpperCase();
        h.style.cssText = 'margin-top:6px;font-weight:800;color:#60a5fa;letter-spacing:.05em';
        el.append(h);
      }
      const fs = c.feeds.flatMap((id) => byId.get(id) ?? []);
      const count = c.feeds[0] === '*' ? total : fs.length ? fs.reduce((a, f) => a + (f.count ?? 0), 0) : null;
      const err = fs.find((f) => f.error);
      const row = document.createElement('div');
      row.style.cssText = 'margin-top:3px;line-height:1.3';
      const head = document.createElement('div');
      head.style.cssText = 'display:flex;gap:6px;align-items:center';
      const dot = document.createElement('span');
      dot.style.cssText = `width:7px;height:7px;flex:none;border-radius:2px;background:${c.feeds.length ? (i % 2 ? '#3b82f6' : '#ef4444') : '#475569'}`;
      const name = document.createElement('span');
      name.textContent = c.name;
      name.style.cssText = `font-weight:700;color:${c.feeds.length ? '#f8fafc' : '#94a3b8'}`;
      const n = document.createElement('span');
      n.textContent = count === null ? '—' : count.toLocaleString();
      n.style.cssText = 'margin-left:auto;font-weight:800;color:#f8fafc';
      head.append(dot, name, n);
      const sub = document.createElement('div');
      sub.style.cssText = `padding-left:13px;color:${err ? '#f87171' : '#94a3b8'}`;
      sub.textContent = err ? `feed error: ${err.error}` : c.note;
      row.append(head, sub);
      el.append(row);
    });
    return el;
  }
}

export function reportGaFeed(map: MapLibreMap, status: GaFeedStatus): void {
  let m = feeds.get(map);
  if (!m) feeds.set(map, (m = new Map()));
  m.set(status.id, status);
  if (!controls.has(map)) {
    const c = new GaLiveLegend();
    controls.set(map, c);
    map.addControl(c, 'top-left');
    map.once('remove', () => controls.delete(map));
  }
  controls.get(map)?.render();
}

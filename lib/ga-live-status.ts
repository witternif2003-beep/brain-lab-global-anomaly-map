import type { IControl, Map as MapLibreMap } from 'maplibre-gl';

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
const order = ['traffic', 'alerts', 'gauges', 'crime'];
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

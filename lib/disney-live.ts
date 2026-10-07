import { Marker } from 'maplibre-gl';
import type { Map as MapLibreMap } from 'maplibre-gl';

const API = 'https://api.themeparks.wiki/v1';
const RESORT: [number, number] = [-81.569324, 28.388195];
const SOURCE = 'disney-live-board';
const REFRESH_MS = 5 * 60_000;
const TICK_MS = 1000;
const TZ = 'America/New_York';
const ATTRIBUTION =
  'Walt Disney World live board: ThemeParks.wiki API (wait times, park hours, Lightning Lane prices; Disney does not publish ticket sales) · not affiliated with Disney';

const PARKS = [
  { id: '75ea578a-adc8-4116-a54d-dccb60765ef9', name: 'Magic Kingdom', short: 'MK' },
  { id: '47f90d2c-e191-4239-a466-5892ef59a88b', name: 'EPCOT', short: 'EPCOT' },
  { id: '288747d1-8b4f-4a64-867e-ea7c9b27bad8', name: "Hollywood Studios", short: 'DHS' },
  { id: '1c84a229-8862-4648-9c71-378ddd2c7693', name: 'Animal Kingdom', short: 'AK' },
  { id: 'b070cbc5-feaa-4b87-a8c1-f94cca037a18', name: 'Typhoon Lagoon', short: 'TL' },
  { id: 'ead53ea5-22e5-4095-9a83-8c29300d7c63', name: 'Blizzard Beach', short: 'BB' },
] as const;
type Park = (typeof PARKS)[number];

type LiveItem = {
  name: string;
  entityType: string;
  status: string;
  queue?: { STANDBY?: { waitTime: number | null } };
  lastUpdated: string;
};
type Purchase = { name: string; price?: { formatted: string }; available: boolean };
type ScheduleEntry = {
  date: string;
  type: string;
  description?: string;
  openingTime: string;
  closingTime: string;
  purchases?: Purchase[];
};
type ParkState = { park: Park; live: LiveItem[]; today: ScheduleEntry[]; updated: string | null; error: string | null };
type Board = { parks: ParkState[]; fetchedAt: Date | null };

const ymd = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
const hm = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
const hms = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit', second: '2-digit' });

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return (await r.json()) as T;
}

async function loadPark(park: Park): Promise<ParkState> {
  const today = ymd.format(new Date());
  const [live, sched] = await Promise.allSettled([
    getJson<{ liveData: LiveItem[] }>(`${API}/entity/${park.id}/live`),
    getJson<{ schedule: ScheduleEntry[] }>(`${API}/entity/${park.id}/schedule`),
  ]);
  const items = live.status === 'fulfilled' ? live.value.liveData : [];
  const updated = items.reduce<string | null>((m, x) => (!m || x.lastUpdated > m ? x.lastUpdated : m), null);
  const errors = [live, sched].filter((s) => s.status === 'rejected').map((s) => String((s as PromiseRejectedResult).reason));
  return {
    park,
    live: items,
    today: sched.status === 'fulfilled' ? sched.value.schedule.filter((s) => s.date === today) : [],
    updated,
    error: errors.length ? errors.join('; ') : null,
  };
}

const waits = (s: ParkState) =>
  s.live
    .filter((x) => x.entityType === 'ATTRACTION' && x.status === 'OPERATING' && typeof x.queue?.STANDBY?.waitTime === 'number')
    .sort((a, b) => (b.queue!.STANDBY!.waitTime as number) - (a.queue!.STANDBY!.waitTime as number));

const hours = (e: ScheduleEntry) => `${hm.format(new Date(e.openingTime))}–${hm.format(new Date(e.closingTime))}`;

function tickerLines(b: Board): string[] {
  const out: string[] = [];
  for (const s of b.parks) {
    const open = s.today.find((e) => e.type === 'OPERATING');
    out.push(`${s.park.name} · ${open ? `open ${hours(open)} ET` : 'no park hours listed today'}`);
    for (const a of waits(s).slice(0, 4)) out.push(`${s.park.short} · ${a.name} · ${a.queue!.STANDBY!.waitTime} min standby`);
    for (const p of open?.purchases ?? [])
      out.push(`${s.park.short} · ${p.name} · ${p.price?.formatted ?? 'price n/a'} · ${p.available ? 'available' : 'unavailable'}`);
  }
  return out;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, text?: string, cls?: string): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}

function renderPanel(target: HTMLElement, b: Board, onEnlarge: () => void, large: boolean, onClose: () => void): void {
  target.replaceChildren();
  const bar = el('div', undefined, 'dw-bar');
  bar.append(
    el('span', b.fetchedAt ? `Fetched ${hms.format(b.fetchedAt)} ET · refreshes every 5 min` : 'Loading live data…'),
  );
  const big = el('button', large ? 'Shrink' : 'Enlarge', 'dw-btn');
  big.type = 'button';
  big.onclick = onEnlarge;
  bar.append(big);
  if (large) {
    const x = el('button', 'Close', 'dw-btn');
    x.type = 'button';
    x.onclick = onClose;
    bar.append(x);
  }
  target.append(bar);
  for (const s of b.parks) {
    const sec = el('section', undefined, 'dw-park');
    sec.append(el('h4', s.park.name));
    if (s.error && !s.live.length) {
      sec.append(el('div', `Unavailable: ${s.error}`, 'dw-muted'));
      target.append(sec);
      continue;
    }
    const rows = s.today.length
      ? s.today.map((e) => `${e.type === 'OPERATING' ? 'Park hours' : (e.description ?? e.type)}: ${hours(e)} ET`)
      : ['No hours listed today'];
    for (const r of rows) sec.append(el('div', r));
    const attractions = s.live.filter((x) => x.entityType === 'ATTRACTION');
    const count = (st: string) => attractions.filter((x) => x.status === st).length;
    sec.append(
      el(
        'div',
        `Attractions: ${count('OPERATING')} operating · ${count('DOWN')} down · ${count('CLOSED')} closed · ${count('REFURBISHMENT')} refurbishment`,
        'dw-muted',
      ),
    );
    const top = waits(s).slice(0, large ? 12 : 5);
    if (top.length) {
      const t = el('table');
      for (const a of top) {
        const tr = el('tr');
        tr.append(el('td', a.name), el('td', `${a.queue!.STANDBY!.waitTime} min`));
        t.append(tr);
      }
      sec.append(el('div', 'Longest standby waits', 'dw-sub'), t);
    }
    const ll = s.today.find((e) => e.type === 'OPERATING')?.purchases ?? [];
    if (ll.length) {
      const t = el('table');
      for (const p of ll) {
        const tr = el('tr');
        tr.append(el('td', p.name), el('td', `${p.price?.formatted ?? 'n/a'} · ${p.available ? 'available' : 'unavailable'}`));
        t.append(tr);
      }
      sec.append(el('div', "Today's Lightning Lane prices", 'dw-sub'), t);
    }
    if (s.updated) sec.append(el('div', `Source data as of ${hms.format(new Date(s.updated))} ET`, 'dw-muted'));
    target.append(sec);
  }
  target.append(
    el(
      'div',
      'Source: ThemeParks.wiki API (public wait times, hours and Lightning Lane prices). Disney does not publish ticket or merchandise sales; none are shown. Not affiliated with Disney.',
      'dw-muted dw-foot',
    ),
  );
}

function isolate(n: HTMLElement): void {
  for (const ev of ['wheel', 'mousedown', 'touchstart', 'touchmove', 'pointerdown', 'dblclick'])
    n.addEventListener(ev, (e) => e.stopPropagation(), { passive: true });
}

const bound = new WeakSet<MapLibreMap>();

/** Pink neon live-data sign over Walt Disney World on the map (idempotent). */
export function addDisneyLiveBoard(map: MapLibreMap): void {
  if (!map.getSource(SOURCE)) {
    map.addSource(SOURCE, {
      type: 'geojson',
      data: { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: RESORT } },
      attribution: ATTRIBUTION,
    });
  }
  if (!map.getLayer('disney-live-dot')) {
    map.addLayer({
      id: 'disney-live-dot',
      type: 'circle',
      source: SOURCE,
      paint: { 'circle-radius': 5, 'circle-color': '#ff2ec4', 'circle-stroke-color': '#fff', 'circle-stroke-width': 1.5 },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);

  const board: Board = { parks: [], fetchedAt: null };
  const root = el('div', undefined, 'dw-sign');
  const head = el('button', 'WALT DISNEY WORLD · LIVE ▾', 'dw-head');
  head.type = 'button';
  const ticker = el('div', 'Loading live data…', 'dw-ticker');
  const panel = el('div', undefined, 'dw-panel');
  panel.hidden = true;
  root.append(head, ticker, panel);
  isolate(root);

  const overlay = el('div', undefined, 'dw-overlay dw-panel');
  overlay.hidden = true;
  isolate(overlay);
  map.getContainer().append(overlay);

  const render = () => {
    if (!panel.hidden) renderPanel(panel, board, enlarge, false, close);
    if (!overlay.hidden) renderPanel(overlay, board, shrink, true, close);
  };
  const enlarge = () => {
    panel.hidden = true;
    overlay.hidden = false;
    head.textContent = 'WALT DISNEY WORLD · LIVE ▾';
    render();
  };
  const shrink = () => {
    overlay.hidden = true;
    panel.hidden = false;
    head.textContent = 'WALT DISNEY WORLD · LIVE ▴';
    render();
    map.easeTo({ center: RESORT, offset: [0, map.getContainer().clientHeight * 0.38] });
  };
  const close = () => {
    overlay.hidden = true;
    panel.hidden = true;
    head.textContent = 'WALT DISNEY WORLD · LIVE ▾';
  };
  head.onclick = () => (panel.hidden && overlay.hidden ? shrink() : close());

  const marker = new Marker({ element: root, anchor: 'bottom', offset: [0, -8] }).setLngLat(RESORT).addTo(map);

  let lines: string[] = [];
  let tick = 0;
  const refresh = async () => {
    board.parks = await Promise.all(PARKS.map(loadPark));
    board.fetchedAt = new Date();
    lines = tickerLines(board);
    if (!lines.length) ticker.textContent = 'Live data unavailable';
    render();
  };
  void refresh();
  const refreshTimer = setInterval(() => void refresh(), REFRESH_MS);
  const tickTimer = setInterval(() => {
    if (!lines.length) return;
    tick = (tick + 1) % lines.length;
    ticker.textContent = lines[tick];
  }, TICK_MS);

  map.once('remove', () => {
    clearInterval(refreshTimer);
    clearInterval(tickTimer);
    marker.remove();
    overlay.remove();
    bound.delete(map);
  });
}

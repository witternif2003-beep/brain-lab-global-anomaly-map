import { Popup } from 'maplibre-gl';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import {
  getGaPatrolPosition,
  getGaPatrolTarget,
  loadGaWallRing,
  offset,
  randomInteriorPoint,
  setGaPatrolQuarry,
  vector,
  WALK_SPEED_MPS,
  wallDistance,
} from './ga-patrol-3d';
import type { LngLat } from './ga-patrol-3d';
import secProfiles from './ga-company-profiles.json';

export const GA_COMPETITORS_SOURCE = 'ga-competitor-markers';
const ATTRIBUTION =
  'Competitor markers: user-supplied list, abstract simulated movement inside the GA wall (not real locations or activity) · profiles: SEC EDGAR filings + company sites';

type Filing = {
  form: string;
  filed: string;
  accn: string;
  docUrl: string;
  indexUrl: string;
  viewerUrl: string;
  periodEnd?: string;
};
type SecProfile = {
  cik: number;
  name: string;
  tickers: string[];
  exchanges: string[];
  industry: string;
  incorporated: string;
  hq: string;
  fiscalYearEnd: string;
  edgarUrl: string;
  balanceSheet: Filing & {
    assets?: number;
    liabilities?: number;
    liabilitiesDerived?: boolean;
    equity?: number;
    cash?: number;
    longTermDebt?: number;
  };
  annual: (Filing & { periodStart?: string; revenue?: number; netIncome?: number }) | null;
};
type FilerKey = keyof typeof secProfiles.companies;
const SEC: Record<FilerKey, SecProfile> = secProfiles.companies;
const SEC_AS_OF = secProfiles.generatedAt.slice(0, 10);

const NO_SEC_FILINGS = 'No SEC periodic filings found in EDGAR company search: no public balance sheet.';

/**
 * `sec` keys into SEC EDGAR data (scripts/build-company-profiles.py); `status` explains a parent,
 * historical or non-SEC filer; `ir` is the public investor/financials page when not on EDGAR.
 */
type Entry = {
  name: string;
  listed: string;
  url: string;
  note?: string;
  sec?: FilerKey;
  status?: string;
  ir?: { label: string; url: string };
};

const MANTECH: Pick<Entry, 'sec' | 'status' | 'ir'> = {
  sec: 'MANT',
  status: 'Taken private by merger and delisted Sept 2022; balance sheet shown is its last SEC filing (historical).',
  ir: { label: 'Merger completion 8-K (2022-09-14)', url: 'https://www.sec.gov/Archives/edgar/data/892537/000119312522244730/d677708d8k.htm' },
};

/** Competitor list as supplied by the user; `url` is the entity's own (or successor's) public site. */
const ENTRIES: Entry[] = [
  { name: 'Booz Allen Hamilton', listed: 'San Antonio, TX', url: 'https://www.boozallen.com/', sec: 'BAH' },
  { name: 'SecureInfo Corp', listed: 'San Antonio, TX', url: 'https://ir.kratosdefense.com/static-files/8596ec95-782c-45b9-b62f-6a938d110f50', note: 'Acquired by Kratos Defense, Nov 2011', sec: 'KTOS', status: 'Subsidiary: financials shown are the parent, Kratos Defense & Security Solutions.' },
  { name: 'Raytheon (RTX)', listed: 'McKinney / Plano, TX', url: 'https://www.rtx.com/', sec: 'RTX', status: 'Raytheon is a business of RTX Corp; financials shown are RTX consolidated.' },
  { name: 'CACI International', listed: 'TX', url: 'https://www.caci.com/', sec: 'CACI' },
  { name: 'Consolidated Nuclear Security LLC', listed: 'Oak Ridge, TN', url: 'https://www.cns-llc.us/', status: NO_SEC_FILINGS },
  { name: 'Amentum', listed: 'TN', url: 'https://www.amentum.com/', sec: 'AMTM' },
  { name: 'Booz Allen Hamilton', listed: 'TN', url: 'https://www.boozallen.com/', sec: 'BAH' },
  { name: 'NewSat North America', listed: 'Indian Harbour Beach, FL', url: 'https://www.newsatnorthamerica.com/', status: NO_SEC_FILINGS },
  { name: 'Raytheon Largo (RTX)', listed: 'Pinellas County, FL', url: 'https://www.rtx.com/', sec: 'RTX', status: 'Raytheon is a business of RTX Corp; financials shown are RTX consolidated.' },
  { name: 'Celestar Corporation', listed: 'Tampa, FL', url: 'https://www.celestarcorp.com/', status: NO_SEC_FILINGS },
  { name: 'AITC (Advanced IT Concepts)', listed: 'Winter Springs, FL', url: 'https://aitc-llc.com/', status: NO_SEC_FILINGS },
  { name: 'SAS Institute', listed: 'Cary, NC', url: 'https://www.sas.com/', status: NO_SEC_FILINGS, ir: { label: 'Company information', url: 'https://www.sas.com/en_us/company-information.html' } },
  { name: 'VTG', listed: 'Lenoir, NC', url: 'https://vtgdefense.com/', status: NO_SEC_FILINGS },
  { name: 'Leonardo DRS', listed: 'Elizabeth City, NC', url: 'https://www.leonardodrs.com/', sec: 'DRS' },
  { name: 'CACI International', listed: 'Charlotte, NC', url: 'https://www.caci.com/', sec: 'CACI' },
  { name: 'SAIC', listed: 'Hanahan, SC', url: 'https://www.saic.com/', sec: 'SAIC' },
  { name: 'ManTech', listed: 'SC', url: 'https://www.mantech.com/', ...MANTECH },
  { name: 'BAE Systems', listed: 'North Charleston, SC', url: 'https://www.baesystems.com/', status: 'BAE Systems plc is listed in London and does not file 10-K/10-Q reports with the SEC; its annual report is on its investor site.', ir: { label: 'Investor relations / annual report', url: 'https://investors.baesystems.com/' } },
  { name: 'Adapt Forward', listed: 'North Charleston, SC', url: 'https://www.adaptforward.com/', status: NO_SEC_FILINGS },
  { name: 'SAIC', listed: 'Reston, VA', url: 'https://www.saic.com/', sec: 'SAIC' },
  { name: 'ManTech', listed: 'Herndon, VA', url: 'https://www.mantech.com/', ...MANTECH },
  { name: 'Booz Allen Hamilton', listed: 'McLean, VA', url: 'https://www.boozallen.com/', sec: 'BAH' },
  { name: 'CACI International', listed: 'Reston, VA', url: 'https://www.caci.com/', sec: 'CACI' },
  { name: 'SI International', listed: 'Reston, VA', url: 'https://www.sec.gov/Archives/edgar/data/1143363/000134100409000003/form8k.htm', note: 'Acquired by Serco, Dec 2008', status: 'Now part of Serco Group plc, which is listed in London and does not file balance sheets with the SEC.', ir: { label: 'Serco investor relations', url: 'https://www.serco.com/investors' } },
  { name: 'VTG', listed: 'Chantilly, VA', url: 'https://vtgdefense.com/', status: NO_SEC_FILINGS },
];

const FLEE_RADIUS_M = 1500;
const FLEE_RELEASE_M = 2000;
const FLEE_LEG_M = 200;
const MIN_LEG_M = 25;
const HEADING_TRIES = 64;
const SUBSTEP_S = 5;
const MAX_CATCHUP_S = 3600;
const PUSH_INTERVAL_MS = 1000;
const RESPAWN_MIN_FROM_PATROL_M = 20_000;

type Agent = {
  pos: LngLat;
  from: LngLat;
  to: LngLat;
  length: number;
  travelled: number;
  fleeing: boolean;
};

/**
 * One abstract marker per listed entity. Each walks wall-to-wall legs at WALK_SPEED_MPS; while the
 * patrol is within FLEE_RADIUS_M it switches to short legs pointing as directly away from the patrol
 * as the wall allows. Every leg length comes from wallDistance, so no marker can cross the wall.
 * A caught marker respawns at a random point inside the wall, away from the patrol.
 */
export class GaCompetitorSwarm {
  readonly agents: Agent[] = [];
  private lastTick = 0;

  constructor(private readonly ring: LngLat[]) {}

  start(now: number, count: number): void {
    for (let tries = 0; this.agents.length < count && tries < count * 20; tries++) {
      const agent = this.spawn();
      if (agent) this.agents.push(agent);
    }
    this.lastTick = now;
  }

  respawn(i: number, patrol: LngLat): void {
    for (let tries = 0; tries < 20; tries++) {
      const agent = this.spawn({ p: patrol, dist: RESPAWN_MIN_FROM_PATROL_M });
      if (!agent) continue;
      this.agents[i] = agent;
      return;
    }
  }

  private spawn(minFrom?: { p: LngLat; dist: number }): Agent | null {
    const p = randomInteriorPoint(this.ring, minFrom);
    const leg = p && this.wanderLeg(p);
    return p && leg ? { pos: p, ...leg, travelled: 0, fleeing: false } : null;
  }

  tick(now: number, patrol: LngLat | null): void {
    let left = Math.min((now - this.lastTick) / 1000, MAX_CATCHUP_S);
    this.lastTick = now;
    while (left > 0) {
      const dt = Math.min(left, SUBSTEP_S);
      left -= dt;
      for (const a of this.agents) this.step(a, dt, patrol);
    }
  }

  private step(a: Agent, dt: number, patrol: LngLat | null): void {
    const d = patrol ? vector(patrol, a.pos).dist : Infinity;
    const shouldFlee = a.fleeing ? d < FLEE_RELEASE_M : d < FLEE_RADIUS_M;
    if (shouldFlee !== a.fleeing) {
      a.fleeing = shouldFlee;
      this.replan(a, patrol);
    }
    let dist = dt * WALK_SPEED_MPS;
    while (dist > 0) {
      const step = Math.min(dist, a.length - a.travelled);
      a.travelled += step;
      dist -= step;
      const f = a.length > 0 ? a.travelled / a.length : 1;
      a.pos = [a.from[0] + (a.to[0] - a.from[0]) * f, a.from[1] + (a.to[1] - a.from[1]) * f];
      if (a.travelled < a.length) return;
      if (!this.replan(a, patrol)) return;
    }
  }

  private replan(a: Agent, patrol: LngLat | null): boolean {
    const leg = a.fleeing && patrol ? this.fleeLeg(a.pos, patrol) : this.wanderLeg(a.pos);
    if (!leg) {
      a.from = a.pos;
      a.to = a.pos;
      a.length = 0;
      a.travelled = 0;
      return false;
    }
    Object.assign(a, leg, { travelled: 0 });
    return true;
  }

  private wanderLeg(from: LngLat): Pick<Agent, 'from' | 'to' | 'length'> | null {
    for (let i = 0; i < HEADING_TRIES; i++) {
      const heading = Math.random() * Math.PI * 2;
      const length = wallDistance(this.ring, from, heading);
      if (length === null || length < MIN_LEG_M) continue;
      return { from, to: offset(from, heading, length), length };
    }
    return null;
  }

  /** Best heading away from the patrol: straight away first, then fanning out up to ±165° along the wall. */
  private fleeLeg(from: LngLat, patrol: LngLat): Pick<Agent, 'from' | 'to' | 'length'> | null {
    const away = vector(patrol, from).heading;
    for (let k = 0; k <= 11; k++) {
      for (const sign of k === 0 ? [1] : [1, -1]) {
        const heading = away + sign * k * (Math.PI / 12);
        const room = wallDistance(this.ring, from, heading);
        if (room === null || room < 1) continue;
        const length = Math.min(room, FLEE_LEG_M);
        return { from, to: offset(from, heading, length), length };
      }
    }
    return null;
  }
}

function featureData(swarm: GaCompetitorSwarm | null, chased: number | null): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: (swarm?.agents ?? []).map((a, i) => ({
      type: 'Feature',
      id: i,
      properties: { i, fleeing: a.fleeing, chased: i === chased },
      geometry: { type: 'Point', coordinates: a.pos },
    })),
  };
}

function usd(v: number | undefined): string {
  if (v === undefined) return 'not tagged';
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1e9) return `${sign}$${(a / 1e9).toFixed(2)}B`;
  return `${sign}$${(a / 1e6).toFixed(1)}M`;
}

function el(tag: string, text: string, css = ''): HTMLElement {
  const n = document.createElement(tag);
  n.textContent = text;
  if (css) n.style.cssText = css;
  return n;
}

function anchor(text: string, href: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = text;
  a.style.cssText = 'display: block; color: #1d4ed8';
  return a;
}

function table(rows: Array<[string, string]>): HTMLElement {
  const t = document.createElement('div');
  t.style.cssText = 'display: grid; grid-template-columns: auto 1fr; gap: 1px 8px; margin: 2px 0';
  for (const [k, v] of rows) t.append(el('span', k, 'color: #475569'), el('span', v, 'text-align: right; font-variant-numeric: tabular-nums'));
  return t;
}

const HEADING = 'font-weight: 600; margin-top: 6px; border-top: 1px solid #e2e8f0; padding-top: 4px';

function secSection(p: SecProfile): HTMLElement[] {
  const bs = p.balanceSheet;
  const out: HTMLElement[] = [
    el('div', 'SEC filer profile', HEADING),
    table([
      ['Registrant', p.name],
      ['CIK', String(p.cik)],
      ['Ticker', p.tickers.length ? p.tickers.map((t, i) => `${t}${p.exchanges[i] ? ` (${p.exchanges[i]})` : ''}`).join(', ') : 'none (delisted)'],
      ['HQ (business address)', p.hq],
      ['Industry (SIC)', p.industry || 'n/a'],
      ['Incorporated', p.incorporated || 'n/a'],
      ['Fiscal year end', p.fiscalYearEnd ? `${p.fiscalYearEnd.slice(0, 2)}/${p.fiscalYearEnd.slice(2)}` : 'n/a'],
    ]),
    el('div', `Balance sheet as of ${bs.periodEnd ?? 'n/a'} (${bs.form}, filed ${bs.filed})`, HEADING),
    table([
      ['Total assets', usd(bs.assets)],
      [bs.liabilitiesDerived ? 'Total liabilities*' : 'Total liabilities', usd(bs.liabilities)],
      ['Total equity', usd(bs.equity)],
      ['Cash & equivalents', usd(bs.cash)],
      ['Long-term debt', usd(bs.longTermDebt)],
    ]),
  ];
  if (bs.liabilitiesDerived) out.push(el('div', '* liabilities & equity minus total equity (filer does not tag total liabilities)', 'color: #64748b; font-size: 11px'));
  const a = p.annual;
  if (a) {
    out.push(
      el('div', `Fiscal year ${a.periodStart ?? '?'} to ${a.periodEnd ?? '?'} (10-K, filed ${a.filed})`, HEADING),
      table([
        ['Revenue', usd(a.revenue)],
        ['Net income', usd(a.netIncome)],
      ]),
    );
  }
  out.push(
    el('div', 'Links', HEADING),
    anchor(`Balance sheet: ${bs.form} financial statements (SEC viewer)`, bs.viewerUrl),
    anchor(`${bs.form} filing document`, bs.docUrl),
  );
  if (a && a.accn !== bs.accn) out.push(anchor('Latest 10-K annual report', a.docUrl));
  out.push(anchor('EDGAR company filings', p.edgarUrl));
  return out;
}

function popupContent(i: number, fleeing: boolean, chased: boolean): HTMLElement {
  const e = ENTRIES[i];
  const root = document.createElement('div');
  root.style.cssText =
    'font: 12px/1.4 system-ui, sans-serif; color: #0f172a; max-width: 300px; max-height: min(60vh, 460px); overflow-y: auto; padding-right: 4px';
  root.append(el('strong', e.name, 'font-size: 13px'), el('div', `Listed location: ${e.listed}`));
  if (e.note) root.append(el('div', e.note));
  if (e.status) root.append(el('div', e.status, 'color: #334155; margin-top: 4px'));
  const p = e.sec ? SEC[e.sec] : undefined;
  if (p) {
    root.append(...secSection(p));
  } else {
    root.append(el('div', 'Links', HEADING));
    if (e.ir) root.append(anchor(e.ir.label, e.ir.url));
  }
  root.append(anchor(e.url.includes('sec.gov') || e.url.includes('static-files') ? 'Acquisition source' : 'Company website', e.url));
  if (p) root.append(el('div', `SEC data retrieved ${SEC_AS_OF} from data.sec.gov.`, 'color: #64748b; margin-top: 4px'));
  root.append(
    el(
      'div',
      `Marker state: ${fleeing ? 'moving away from patrol' : 'random wall-to-wall'}${chased ? ' · current patrol target' : ''}`,
      'margin-top: 6px',
    ),
    el('div', 'Simulated marker position; not a real location or activity.', 'color: #64748b'),
  );
  return root;
}

const bound = new WeakSet<MapLibreMap>();

/** Adds the competitor marker source, layers, and simulation loop (idempotent). */
export function addGaCompetitorLayers(map: MapLibreMap): void {
  if (!map.getSource(GA_COMPETITORS_SOURCE)) {
    map.addSource(GA_COMPETITORS_SOURCE, { type: 'geojson', data: featureData(null, null), attribution: ATTRIBUTION });
  }
  if (!map.getLayer('ga-competitor-markers')) {
    map.addLayer({
      id: 'ga-competitor-markers',
      type: 'circle',
      source: GA_COMPETITORS_SOURCE,
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 4, 3.5, 10, 5.5, 16, 8],
        'circle-color': ['case', ['get', 'chased'], '#ef4444', ['get', 'fleeing'], '#f97316', '#a855f7'],
        'circle-stroke-color': '#f8fafc',
        'circle-stroke-width': 1.5,
        'circle-pitch-alignment': 'map',
      },
    });
  }
  if (bound.has(map)) return;
  bound.add(map);

  let swarm: GaCompetitorSwarm | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const push = () => {
    if (!swarm) return;
    swarm.tick(performance.now(), getGaPatrolPosition(map));
    (map.getSource(GA_COMPETITORS_SOURCE) as GeoJSONSource | undefined)?.setData(featureData(swarm, getGaPatrolTarget(map)));
  };
  loadGaWallRing()
    .then((ring) => {
      if (ring.length < 4 || !bound.has(map)) return;
      const s = new GaCompetitorSwarm(ring);
      s.start(performance.now(), ENTRIES.length);
      swarm = s;
      setGaPatrolQuarry(map, {
        positions: () => s.agents.map((a) => a.pos),
        caught: (i, patrol) => s.respawn(i, patrol),
      });
      push();
      timer = setInterval(push, PUSH_INTERVAL_MS);
    })
    .catch((err) => console.warn('[GaCompetitors] wall path load failed:', err));
  map.once('remove', () => {
    if (timer) clearInterval(timer);
    bound.delete(map);
  });

  map.on('click', 'ga-competitor-markers', (e) => {
    const f = e.features?.[0];
    if (!f || f.geometry.type !== 'Point') return;
    const i = Number(f.properties?.i);
    if (!ENTRIES[i]) return;
    new Popup({ closeButton: true, maxWidth: 'min(320px, 90vw)' })
      .setLngLat(f.geometry.coordinates as LngLat)
      .setDOMContent(popupContent(i, f.properties?.fleeing === true, f.properties?.chased === true))
      .addTo(map);
  });
  map.on('mouseenter', 'ga-competitor-markers', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'ga-competitor-markers', () => {
    map.getCanvas().style.cursor = '';
  });
}

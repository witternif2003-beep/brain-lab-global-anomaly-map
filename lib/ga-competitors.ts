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
  'Competitor markers: user-supplied list, abstract simulated movement inside the GA wall (not real locations or activity) · profiles: SEC EDGAR, USAspending.gov, company sites (icons via Google favicon service)';

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
  sic: string;
  ein: string;
  filerCategory: string;
  phone: string;
  street: string;
  formerNames: string[];
  sharesOutstanding: { value: number; asOf: string } | null;
  recentFilings: Array<{ form: string; filed: string; url: string }>;
  edgarUrl: string;
  balanceSheet: Filing & {
    assets?: number;
    liabilities?: number;
    liabilitiesDerived?: boolean;
    equity?: number;
    cash?: number;
    longTermDebt?: number;
    currentAssets?: number;
    currentLiabilities?: number;
    goodwill?: number;
  };
  annual:
    | (Filing & { periodStart?: string; revenue?: number; operatingIncome?: number; netIncome?: number; operatingCashFlow?: number })
    | null;
};
type FedProfile = {
  recipientId: string;
  name: string;
  uei: string | null;
  parentName: string | null;
  city: string;
  state: string;
  businessTypes: string[];
  last12mObligations: number;
  last12mTransactions: number;
  lifetimeObligations: number;
  lifetimeTransactions: number;
  fy2026TopAgencies: Array<{ name: string; amount: number }>;
  largestContracts: Array<{ id: string; description: string; amount: number; agency: string; start: string; end: string; recipient: string; url: string }>;
  profileUrl: string;
};
type FilerKey = keyof typeof secProfiles.companies;
type FedKey = keyof typeof secProfiles.federal;
const SEC: Record<FilerKey, SecProfile> = secProfiles.companies;
const FED: Record<FedKey, FedProfile> = secProfiles.federal;
const LOGOS: Record<string, string> = secProfiles.logos;
const SEC_AS_OF = secProfiles.generatedAt.slice(0, 10);

const NO_SEC_FILINGS = 'No SEC periodic filings found in EDGAR company search: no public balance sheet.';

/**
 * `sec` / `fed` key into SEC EDGAR and USAspending data (scripts/build-company-profiles.py);
 * `domain` is the company site whose icon is shown; `status` explains a parent, historical or
 * non-SEC filer; `ir` is the public investor/financials page when not on EDGAR.
 */
type Entry = {
  name: string;
  listed: string;
  url: string;
  domain: string;
  note?: string;
  sec?: FilerKey;
  fed?: FedKey;
  status?: string;
  ir?: { label: string; url: string };
};

const MANTECH: Pick<Entry, 'sec' | 'fed' | 'domain' | 'status' | 'ir'> = {
  sec: 'MANT',
  fed: 'MANT',
  domain: 'mantech.com',
  status: 'Taken private by merger and delisted Sept 2022; balance sheet shown is its last SEC filing (historical).',
  ir: { label: 'Merger completion 8-K (2022-09-14)', url: 'https://www.sec.gov/Archives/edgar/data/892537/000119312522244730/d677708d8k.htm' },
};

/** Competitor list as supplied by the user; `url` is the entity's own (or successor's) public site. */
const ENTRIES: Entry[] = [
  { name: 'Booz Allen Hamilton', listed: 'San Antonio, TX', url: 'https://www.boozallen.com/', domain: 'boozallen.com', sec: 'BAH', fed: 'BAH' },
  { name: 'SecureInfo Corp', listed: 'San Antonio, TX', url: 'https://ir.kratosdefense.com/static-files/8596ec95-782c-45b9-b62f-6a938d110f50', note: 'Acquired by Kratos Defense, Nov 2011', domain: 'kratosdefense.com', sec: 'KTOS', fed: 'KTOS', status: 'Subsidiary: financials shown are the parent, Kratos Defense & Security Solutions.' },
  { name: 'Raytheon (RTX)', listed: 'McKinney / Plano, TX', url: 'https://www.rtx.com/', domain: 'rtx.com', sec: 'RTX', fed: 'RTX', status: 'Raytheon is a business of RTX Corp; financials shown are RTX consolidated.' },
  { name: 'CACI International', listed: 'TX', url: 'https://www.caci.com/', domain: 'caci.com', sec: 'CACI', fed: 'CACI' },
  { name: 'Consolidated Nuclear Security LLC', listed: 'Oak Ridge, TN', url: 'https://www.cns-llc.us/', domain: 'cns-llc.us', fed: 'CNS', status: NO_SEC_FILINGS },
  { name: 'Amentum', listed: 'TN', url: 'https://www.amentum.com/', domain: 'amentum.com', sec: 'AMTM', fed: 'AMTM' },
  { name: 'Booz Allen Hamilton', listed: 'TN', url: 'https://www.boozallen.com/', domain: 'boozallen.com', sec: 'BAH', fed: 'BAH' },
  { name: 'NewSat North America', listed: 'Indian Harbour Beach, FL', url: 'https://www.newsatnorthamerica.com/', domain: 'newsatnorthamerica.com', fed: 'NEWSAT', status: NO_SEC_FILINGS },
  { name: 'Raytheon Largo (RTX)', listed: 'Pinellas County, FL', url: 'https://www.rtx.com/', domain: 'rtx.com', sec: 'RTX', fed: 'RTX', status: 'Raytheon is a business of RTX Corp; financials shown are RTX consolidated.' },
  { name: 'Celestar Corporation', listed: 'Tampa, FL', url: 'https://www.celestarcorp.com/', domain: 'celestarcorp.com', fed: 'CELESTAR', status: NO_SEC_FILINGS },
  { name: 'AITC (Advanced IT Concepts)', listed: 'Winter Springs, FL', url: 'https://aitc-llc.com/', domain: 'aitc-llc.com', fed: 'AITC', status: NO_SEC_FILINGS },
  { name: 'SAS Institute', listed: 'Cary, NC', url: 'https://www.sas.com/', domain: 'sas.com', fed: 'SAS', status: NO_SEC_FILINGS, ir: { label: 'Company information', url: 'https://www.sas.com/en_us/company-information.html' } },
  { name: 'VTG', listed: 'Lenoir, NC', url: 'https://vtgdefense.com/', domain: 'vtgdefense.com', status: NO_SEC_FILINGS },
  { name: 'Leonardo DRS', listed: 'Elizabeth City, NC', url: 'https://www.leonardodrs.com/', domain: 'leonardodrs.com', sec: 'DRS', fed: 'DRS' },
  { name: 'CACI International', listed: 'Charlotte, NC', url: 'https://www.caci.com/', domain: 'caci.com', sec: 'CACI', fed: 'CACI' },
  { name: 'SAIC', listed: 'Hanahan, SC', url: 'https://www.saic.com/', domain: 'saic.com', sec: 'SAIC', fed: 'SAIC' },
  { name: 'ManTech', listed: 'SC', url: 'https://www.mantech.com/', ...MANTECH },
  { name: 'BAE Systems', listed: 'North Charleston, SC', url: 'https://www.baesystems.com/', domain: 'baesystems.com', fed: 'BAE', status: 'BAE Systems plc is listed in London and does not file 10-K/10-Q reports with the SEC; its annual report is on its investor site.', ir: { label: 'Investor relations / annual report', url: 'https://investors.baesystems.com/' } },
  { name: 'Adapt Forward', listed: 'North Charleston, SC', url: 'https://www.adaptforward.com/', domain: 'adaptforward.com', fed: 'ADAPT', status: NO_SEC_FILINGS },
  { name: 'SAIC', listed: 'Reston, VA', url: 'https://www.saic.com/', domain: 'saic.com', sec: 'SAIC', fed: 'SAIC' },
  { name: 'ManTech', listed: 'Herndon, VA', url: 'https://www.mantech.com/', ...MANTECH },
  { name: 'Booz Allen Hamilton', listed: 'McLean, VA', url: 'https://www.boozallen.com/', domain: 'boozallen.com', sec: 'BAH', fed: 'BAH' },
  { name: 'CACI International', listed: 'Reston, VA', url: 'https://www.caci.com/', domain: 'caci.com', sec: 'CACI', fed: 'CACI' },
  { name: 'SI International', listed: 'Reston, VA', url: 'https://www.sec.gov/Archives/edgar/data/1143363/000134100409000003/form8k.htm', note: 'Acquired by Serco, Dec 2008', domain: 'serco.com', fed: 'SERCO', status: 'Now part of Serco Group plc, which is listed in London and does not file balance sheets with the SEC.', ir: { label: 'Serco investor relations', url: 'https://www.serco.com/investors' } },
  { name: 'VTG', listed: 'Chantilly, VA', url: 'https://vtgdefense.com/', domain: 'vtgdefense.com', status: NO_SEC_FILINGS },
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
  if (a < 1e6) return `${sign}$${Math.round(a).toLocaleString()}`;
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
      ...optRows([
        ['Street', p.street],
        ['Phone', p.phone],
        ['EIN', /^0*$/.test(p.ein) ? '' : p.ein],
        ['SIC code', p.sic],
        ['Filer category', p.filerCategory],
        ['Shares outstanding', p.sharesOutstanding ? `${(p.sharesOutstanding.value / 1e6).toFixed(1)}M (${p.sharesOutstanding.asOf})` : ''],
        ['Former names', p.formerNames.join('; ')],
      ]),
    ]),
    el('div', `Balance sheet as of ${bs.periodEnd ?? 'n/a'} (${bs.form}, filed ${bs.filed})`, HEADING),
    table([
      ['Total assets', usd(bs.assets)],
      [bs.liabilitiesDerived ? 'Total liabilities*' : 'Total liabilities', usd(bs.liabilities)],
      ['Total equity', usd(bs.equity)],
      ['Cash & equivalents', usd(bs.cash)],
      ['Long-term debt', usd(bs.longTermDebt)],
      ['Current assets', usd(bs.currentAssets)],
      ['Current liabilities', usd(bs.currentLiabilities)],
      ['Goodwill', usd(bs.goodwill)],
    ]),
  ];
  if (bs.liabilitiesDerived) out.push(el('div', '* liabilities & equity minus total equity (filer does not tag total liabilities)', 'color: #64748b; font-size: 11px'));
  const a = p.annual;
  if (a) {
    out.push(
      el('div', `Fiscal year ${a.periodStart ?? '?'} to ${a.periodEnd ?? '?'} (10-K, filed ${a.filed})`, HEADING),
      table([
        ['Revenue', usd(a.revenue)],
        ['Operating income', usd(a.operatingIncome)],
        ['Net income', usd(a.netIncome)],
        ['Operating cash flow', usd(a.operatingCashFlow)],
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
  if (p.recentFilings.length) {
    out.push(el('div', 'Recent SEC filings', HEADING));
    for (const f of p.recentFilings) out.push(anchor(`${f.form} · filed ${f.filed}`, f.url));
  }
  return out;
}

function optRows(rows: Array<[string, string]>): Array<[string, string]> {
  return rows.filter(([, v]) => v);
}

function label(code: string): string {
  return code.replace(/_/g, ' ');
}

function fedSection(f: FedProfile): HTMLElement[] {
  const out: HTMLElement[] = [
    el('div', 'Federal awards (USAspending.gov)', HEADING),
    table([
      ['Recipient', f.name],
      ...optRows([
        ['Parent', f.parentName && f.parentName !== f.name ? f.parentName : ''],
        ['UEI (SAM.gov)', f.uei ?? ''],
        ['Registered at', [f.city, f.state].filter(Boolean).join(', ')],
      ]),
      ['Last 12 months', `${usd(f.last12mObligations)} · ${f.last12mTransactions.toLocaleString()} transactions`],
      ['All years (FY2008+)', `${usd(f.lifetimeObligations)} · ${f.lifetimeTransactions.toLocaleString()} transactions`],
    ]),
  ];
  if (f.businessTypes.length) out.push(el('div', `Business types: ${f.businessTypes.map(label).join(', ')}`, 'color: #475569; font-size: 11px'));
  if (f.fy2026TopAgencies.length) {
    out.push(el('div', 'Top awarding agencies, FY2026', 'font-weight: 600; margin-top: 4px'), table(f.fy2026TopAgencies.map((a) => [a.name, usd(a.amount)])));
  }
  if (f.largestContracts.length) {
    out.push(el('div', 'Largest contracts active FY2022–FY2026', 'font-weight: 600; margin-top: 4px'));
    for (const c of f.largestContracts) {
      out.push(
        anchor(`${c.id} · ${usd(c.amount)} · ${c.agency}`, c.url),
        el('div', `${c.recipient}${c.description ? ` · ${c.description.slice(0, 90)}` : ''} · ${c.start} to ${c.end}`, 'color: #475569; font-size: 11px; margin-bottom: 2px'),
      );
    }
  }
  out.push(
    anchor('USAspending recipient profile', f.profileUrl),
    el('div', 'Totals are obligations reported to USAspending for this recipient record (parent level where one exists); subsidiaries filed under other names may be excluded.', 'color: #64748b; font-size: 11px'),
  );
  return out;
}

function header(e: Entry): HTMLElement {
  const row = document.createElement('div');
  row.style.cssText = 'display: flex; align-items: center; gap: 8px; margin-bottom: 2px';
  const badge = el('span', e.name.replace(/[^A-Za-z ]/g, '').split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase(),
    'flex: none; width: 32px; height: 32px; border-radius: 6px; background: #e2e8f0; color: #334155; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px');
  const logo = LOGOS[e.domain];
  if (logo) {
    const img = document.createElement('img');
    img.src = logo;
    img.alt = `${e.name} site icon`;
    img.width = 32;
    img.height = 32;
    img.style.cssText = 'flex: none; width: 32px; height: 32px; object-fit: contain; border-radius: 6px; background: #fff; border: 1px solid #e2e8f0';
    img.onerror = () => img.replaceWith(badge);
    row.append(img);
  } else {
    row.append(badge);
  }
  row.append(el('strong', e.name, 'font-size: 13px'));
  return row;
}

function popupContent(i: number, fleeing: boolean, chased: boolean): HTMLElement {
  const e = ENTRIES[i];
  const root = document.createElement('div');
  root.style.cssText =
    'font: 12px/1.4 system-ui, sans-serif; color: #0f172a; max-width: 300px; max-height: min(60vh, 460px); overflow-y: auto; padding-right: 4px';
  root.append(header(e), el('div', `Listed location: ${e.listed}`));
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
  const f = e.fed ? FED[e.fed] : undefined;
  if (f) root.append(...fedSection(f));
  else root.append(el('div', 'Federal awards: no USAspending recipient matched this entity with confidence.', 'color: #64748b; margin-top: 4px'));
  const sources = [p && 'data.sec.gov', f && 'api.usaspending.gov'].filter(Boolean).join(' and ');
  const provenance = [
    sources && `Data retrieved ${SEC_AS_OF} from ${sources}.`,
    LOGOS[e.domain] && `Icon: ${e.domain} site icon via Google's favicon service.`,
  ].filter(Boolean).join(' ');
  if (provenance) root.append(el('div', provenance, 'color: #64748b; margin-top: 4px'));
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
    const content = popupContent(i, f.properties?.fleeing === true, f.properties?.chased === true);
    new Popup({ closeButton: true, maxWidth: 'min(320px, 90vw)' })
      .setLngLat(f.geometry.coordinates as LngLat)
      .setDOMContent(content)
      .addTo(map);
    content.scrollTop = 0;
  });
  map.on('mouseenter', 'ga-competitor-markers', () => {
    map.getCanvas().style.cursor = 'pointer';
  });
  map.on('mouseleave', 'ga-competitor-markers', () => {
    map.getCanvas().style.cursor = '';
  });
}

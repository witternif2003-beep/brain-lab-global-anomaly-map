import type { Map as MapLibreMap } from 'maplibre-gl';
import type { OsintGeo } from './fbi-osint/load';
import { reportGaFeed } from './ga-live-status';
import { addOsintGeoLayer, setOsintGeoData } from './ga-osint-geo-layer';

const REFRESH_MS = 60 * 60_000;
const MIN_COVERAGE_PCT = 80;
const WANTED = { id: 'fbi-wanted', label: 'FBI Wanted notices (Atlanta field office)', color: '#60a5fa', sourceUrl: 'https://www.fbi.gov/wanted' };
const OSINT = { id: 'fbi-osint', label: 'FBI-relevant public OSINT indicators', color: '#f472b6', sourceUrl: '/fbi-osint' };
const OSINT_REFRESH_MS = 5 * 60_000;
const CDE = { id: 'fbi-cde', label: 'FBI CDE violent crime, Georgia (monthly)', color: '#818cf8', sourceUrl: 'https://cde.ucr.cjis.gov/' };

type MonthSeries = Record<string, number | null>;
interface CdePayload {
  offenses?: { rates?: Record<string, MonthSeries>; actuals?: Record<string, MonthSeries> };
  tooltips?: { 'Percent of Population Coverage'?: Record<string, MonthSeries> };
  cde_properties?: { last_refresh_date?: { UCR?: string } };
  fetchedAt?: string;
  error?: string;
}

const monthKey = (k: string) => `${k.slice(3)}-${k.slice(0, 2)}`;

async function loadWanted(map: MapLibreMap) {
  try {
    const r = await fetch('/api/fbi/wanted?field_office=atlanta');
    const d = (await r.json()) as { total?: number; fetchedAt?: string; error?: string };
    if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
    reportGaFeed(map, { ...WANTED, count: d.total ?? 0, detail: 'fbi.gov Wanted API · count only, no names or photos on the map · refresh 1 h', updatedAt: d.fetchedAt ?? null });
  } catch (err) {
    reportGaFeed(map, { ...WANTED, count: null, updatedAt: null, error: String(err) });
  }
}

async function loadOsint(map: MapLibreMap) {
  try {
    const r = await fetch('/api/fbi-osint?limit=0&geo=1');
    const d = (await r.json()) as { total?: number; fetchedAt?: string; error?: string; geo?: OsintGeo; sources?: { label: string; shown: number; error: string | null }[] };
    if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
    const ok = (d.sources ?? []).filter((s) => !s.error).length;
    if (d.geo) setOsintGeoData(map, d.geo.countries);
    const geo = d.geo ? ` · ${d.geo.located.toLocaleString()} placed on the map by country (IP hosting country / victim country)` : '';
    reportGaFeed(map, { ...OSINT, count: d.total ?? 0, detail: `all available across ${ok}/${d.sources?.length ?? 0} feeds (FBI, IC3, CISA KEV, abuse.ch, ransomware.live)${geo} · search via FBI OSINT button · refresh 5 min`, updatedAt: d.fetchedAt ?? null });
  } catch (err) {
    reportGaFeed(map, { ...OSINT, count: null, updatedAt: null, error: String(err) });
  }
}

async function loadCde(map: MapLibreMap) {
  try {
    const y = new Date().getFullYear();
    const r = await fetch(`/api/fbi/crime?level=state&state=GA&offense=violent-crime&from=01-${y - 1}&to=12-${y}`);
    const d = (await r.json()) as CdePayload;
    if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
    const rates = d.offenses?.rates?.['Georgia Offenses'] ?? {};
    const actuals = d.offenses?.actuals?.['Georgia Offenses'] ?? {};
    const coverage = d.tooltips?.['Percent of Population Coverage']?.Georgia ?? {};
    const month = Object.keys(rates)
      .filter((k) => rates[k] !== null && (coverage[k] ?? 0) >= MIN_COVERAGE_PCT)
      .sort((a, b) => monthKey(b).localeCompare(monthKey(a)))[0];
    if (!month) throw new Error('no month with enough reporting coverage');
    reportGaFeed(map, {
      ...CDE,
      count: actuals[month] ?? null,
      detail: `offenses in ${month} · ${rates[month]} per 100k · ${coverage[month]}% of population covered (latest month ≥${MIN_COVERAGE_PCT}%)${d.cde_properties?.last_refresh_date?.UCR ? ` · FBI refresh ${d.cde_properties.last_refresh_date.UCR}` : ''}`,
      updatedAt: d.fetchedAt ?? null,
    });
  } catch (err) {
    reportGaFeed(map, { ...CDE, count: null, updatedAt: null, error: String(err) });
  }
}

const bound = new WeakSet<MapLibreMap>();

/** Lists the public FBI Wanted and Crime Data Explorer endpoints in the Georgia live-feeds panel (idempotent). */
export function addGaFbiFeeds(map: MapLibreMap): void {
  addOsintGeoLayer(map, 'IP geolocation by DB-IP (CC BY 4.0)');
  if (bound.has(map)) return;
  bound.add(map);
  const load = () => Promise.all([loadWanted(map), loadCde(map)]);
  void load();
  void loadOsint(map);
  const timer = setInterval(() => void load(), REFRESH_MS);
  const osintTimer = setInterval(() => void loadOsint(map), OSINT_REFRESH_MS);
  map.once('remove', () => {
    clearInterval(timer);
    clearInterval(osintTimer);
    bound.delete(map);
  });
}

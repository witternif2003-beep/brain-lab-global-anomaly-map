import { IP_COUNTRY_ATTRIBUTION, loadIpCountryDb } from './geo';
import { newestFirst, OSINT_SOURCES, parseFeodo, parseKev, parseRansomware, parseRss, parseSslbl, parseThreatfox, parseUrlhaus, type OsintIndicator, type OsintSourceId } from './parse';

const TTL_MS = 5 * 60_000;
const UA = 'BrainLab-Research-Platform/1.0';

const FETCH: Record<OsintSourceId, { url: string; parse: (body: string) => OsintIndicator[] }> = {
  'fbi-press': { url: 'https://www.fbi.gov/feeds/national-press-releases/rss.xml', parse: (b) => parseRss(b, 'fbi-press', 'press release') },
  'ic3-psa': { url: 'https://www.ic3.gov/PSA/RSS', parse: (b) => parseRss(b, 'ic3-psa', 'PSA') },
  'ic3-csa': { url: 'https://www.ic3.gov/CSA/RSS', parse: (b) => parseRss(b, 'ic3-csa', 'advisory') },
  kev: { url: 'https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json', parse: (b) => parseKev(JSON.parse(b)) },
  ransomware: { url: 'https://api.ransomware.live/v2/recentvictims', parse: (b) => parseRansomware(JSON.parse(b)) },
  threatfox: { url: 'https://threatfox.abuse.ch/export/json/recent/', parse: (b) => parseThreatfox(JSON.parse(b)) },
  urlhaus: { url: 'https://urlhaus.abuse.ch/downloads/json_recent/', parse: (b) => parseUrlhaus(JSON.parse(b)) },
  sslbl: { url: 'https://sslbl.abuse.ch/blacklist/sslblacklist.csv', parse: parseSslbl },
  feodo: { url: 'https://feodotracker.abuse.ch/downloads/ipblocklist.json', parse: (b) => parseFeodo(JSON.parse(b)) },
};

export interface OsintSourceStatus { id: OsintSourceId; label: string; publisher: string; url: string; why: string; available: number; shown: number; newest: string | null; error: string | null }
export interface OsintCountry { cc: string; name: string; lat: number; lon: number; count: number; bySource: Partial<Record<OsintSourceId, number>> }
export interface OsintGeo { located: number; attribution: string; countries: OsintCountry[]; error: string | null }
export interface OsintSnapshot { fetchedAt: string; total: number; available: number; sources: OsintSourceStatus[]; geo: OsintGeo; items: OsintIndicator[] }

let cache: { at: number; snap: OsintSnapshot } | null = null;
let inflight: Promise<OsintSnapshot> | null = null;

async function fetchSource(id: OsintSourceId): Promise<OsintIndicator[]> {
  const res = await fetch(FETCH[id].url, { cache: 'no-store', signal: AbortSignal.timeout(25_000), headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return FETCH[id].parse(await res.text());
}

/** Tags each IPv4-hosted indicator with its hosting country and aggregates per-country counts for the map. */
async function geolocate(items: OsintIndicator[]): Promise<OsintGeo> {
  const byCc = new Map<string, OsintCountry>();
  let error: string | null = null;
  const db = await loadIpCountryDb().catch((e: Error) => ((error = `IP database: ${e.message}`), null));
  for (const it of items) {
    if (it.ip && db) it.cc = db.lookup(it.ip) ?? it.cc;
    delete it.ip;
    const c = it.cc && db?.centroid(it.cc);
    if (!it.cc || !c) continue;
    const row = byCc.get(it.cc) ?? { cc: it.cc, ...c, count: 0, bySource: {} };
    row.count++;
    row.bySource[it.source] = (row.bySource[it.source] ?? 0) + 1;
    byCc.set(it.cc, row);
  }
  const countries = [...byCc.values()].sort((a, b) => b.count - a.count);
  return { located: countries.reduce((n, c) => n + c.count, 0), attribution: IP_COUNTRY_ATTRIBUTION, countries, error };
}

async function build(): Promise<OsintSnapshot> {
  const results = await Promise.allSettled(OSINT_SOURCES.map((s) => fetchSource(s.id)));
  const all: OsintIndicator[] = [];
  const raw = OSINT_SOURCES.map((s, i) => {
    const r = results[i];
    const list = r.status === 'fulfilled' ? r.value : [];
    all.push(...list);
    return { ...s, available: list.length, error: r.status === 'rejected' ? String((r.reason as Error)?.message ?? r.reason) : null };
  });
  const items = newestFirst(all);
  const geo = await geolocate(items);
  const shown = new Map<OsintSourceId, { n: number; newest: string | null }>();
  for (const it of items) {
    const s = shown.get(it.source) ?? { n: 0, newest: it.seenAt };
    s.n++;
    shown.set(it.source, s);
  }
  return {
    fetchedAt: new Date().toISOString(),
    total: items.length,
    available: all.length,
    sources: raw.map((s) => ({ ...s, shown: shown.get(s.id)?.n ?? 0, newest: shown.get(s.id)?.newest ?? null })),
    geo,
    items,
  };
}

/** Every public FBI-relevant OSINT indicator currently published by the sources, newest first, cached 5 min per server instance. */
export async function getOsintSnapshot(): Promise<OsintSnapshot> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.snap;
  inflight ??= build()
    .then((snap) => {
      if (snap.total || !cache) cache = { at: Date.now(), snap };
      return cache.snap;
    })
    .finally(() => (inflight = null));
  return inflight;
}

export type OsintSourceId = 'urlhaus' | 'threatfox' | 'sslbl' | 'feodo' | 'kev' | 'ic3-psa' | 'ic3-csa' | 'fbi-press' | 'ransomware';

export interface OsintIndicator {
  id: string;
  source: OsintSourceId;
  kind: string;
  /** Defanged where it is a URL, domain or IP so it can't be clicked by accident. */
  value: string;
  threat: string;
  seenAt: string;
  ref: string;
  /** ISO 3166-1 alpha-2: hosting country of the indicator's IPv4 (DB-IP Lite), or the victim country reported by ransomware.live. */
  cc?: string;
  /** Raw IPv4 host, used server-side for geolocation only and stripped before the snapshot is served. */
  ip?: string;
}

export interface OsintSource {
  id: OsintSourceId;
  label: string;
  publisher: string;
  url: string;
  why: string;
}

export const OSINT_SOURCES: OsintSource[] = [
  { id: 'fbi-press', label: 'FBI national press releases', publisher: 'FBI', url: 'https://www.fbi.gov/feeds/national-press-releases/rss.xml', why: 'FBI arrests, indictments and operations announced publicly' },
  { id: 'ic3-psa', label: 'IC3 public service announcements', publisher: 'FBI IC3', url: 'https://www.ic3.gov/PSA/RSS', why: 'FBI fraud and cybercrime warnings to the public' },
  { id: 'ic3-csa', label: 'IC3 industry alerts (FBI/CISA advisories)', publisher: 'FBI IC3', url: 'https://www.ic3.gov/CSA/RSS', why: 'joint FBI cybersecurity advisories with indicators' },
  { id: 'kev', label: 'CISA Known Exploited Vulnerabilities', publisher: 'CISA', url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog', why: 'CVEs confirmed exploited in the wild' },
  { id: 'ransomware', label: 'Ransomware leak-site victim posts', publisher: 'ransomware.live', url: 'https://www.ransomware.live/', why: 'ransomware is an FBI priority; victims named publicly by the gangs' },
  { id: 'threatfox', label: 'ThreatFox malware IOCs (48 h)', publisher: 'abuse.ch', url: 'https://threatfox.abuse.ch/', why: 'botnet C2s, stealer/loader infrastructure' },
  { id: 'urlhaus', label: 'URLhaus malware URLs (30 days)', publisher: 'abuse.ch', url: 'https://urlhaus.abuse.ch/', why: 'URLs distributing malware' },
  { id: 'sslbl', label: 'SSLBL malicious TLS certificates', publisher: 'abuse.ch', url: 'https://sslbl.abuse.ch/', why: 'certificates used by malware C2 servers' },
  { id: 'feodo', label: 'Feodo Tracker botnet C2 IPs', publisher: 'abuse.ch', url: 'https://feodotracker.abuse.ch/', why: 'Emotet/QakBot/Dridex-family C2 servers' },
];

/** IPv4 host of a URL, "ip:port" or bare IP, else undefined. */
export function ipv4Host(v: string | undefined): string | undefined {
  const m = v?.match(/^(?:[a-z]+:\/\/)?(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:[/?#]|$)/i);
  return m && m[1].split('.').every((o) => +o < 256) ? m[1] : undefined;
}

export function defang(v: string): string {
  return v.replace(/^http/i, 'hxxp').replace(/\./g, '[.]');
}

/** "2026-10-14 20:20:12 UTC" / "2026-10-14 20:20:12" / "2026-10-14" → ISO, or null. */
export function utcIso(s: string | null | undefined): string | null {
  if (!s) return null;
  const t = s.trim().replace(/ UTC$/, '');
  const m = t.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?/);
  const ms = m ? Date.parse(`${m[1]}T${m[2] ?? '00:00:00'}Z`) : Date.parse(t);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

const decodeXml = (s: string) =>
  s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim();

const tag = (block: string, name: string) => {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? decodeXml(m[1]) : '';
};

export function parseRss(xml: string, source: OsintSourceId, kind: string): OsintIndicator[] {
  const out: OsintIndicator[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const title = tag(m[1], 'title');
    const link = tag(m[1], 'link') || tag(m[1], 'guid');
    const seenAt = utcIso(tag(m[1], 'pubDate'));
    if (!title || !seenAt) continue;
    out.push({ id: `${source}:${link || title}`, source, kind, value: title, threat: tag(m[1], 'description').replace(/<[^>]+>/g, '').slice(0, 240), seenAt, ref: link });
  }
  return out;
}

interface UrlhausRow { dateadded?: string; url?: string; url_status?: string; threat?: string; tags?: string[] | null; urlhaus_link?: string }
export function parseUrlhaus(d: Record<string, UrlhausRow[]>): OsintIndicator[] {
  const out: OsintIndicator[] = [];
  for (const [id, rows] of Object.entries(d)) {
    for (const r of rows) {
      const seenAt = utcIso(r.dateadded);
      if (!r.url || !seenAt) continue;
      out.push({ id: `urlhaus:${id}`, source: 'urlhaus', kind: 'url', value: defang(r.url), threat: [r.threat, r.url_status, ...(r.tags ?? [])].filter(Boolean).join(' · '), seenAt, ref: r.urlhaus_link ?? `https://urlhaus.abuse.ch/url/${id}/`, ip: ipv4Host(r.url) });
    }
  }
  return out;
}

interface ThreatfoxRow { ioc_value?: string; ioc_type?: string; threat_type?: string; malware_printable?: string; first_seen_utc?: string; confidence_level?: number }
export function parseThreatfox(d: Record<string, ThreatfoxRow[]>): OsintIndicator[] {
  const out: OsintIndicator[] = [];
  for (const [id, rows] of Object.entries(d)) {
    for (const r of rows) {
      const seenAt = utcIso(r.first_seen_utc);
      if (!r.ioc_value || !seenAt) continue;
      const hash = /hash/.test(r.ioc_type ?? '');
      out.push({ id: `threatfox:${id}`, source: 'threatfox', kind: r.ioc_type ?? 'ioc', value: hash ? r.ioc_value : defang(r.ioc_value), threat: [r.malware_printable, r.threat_type, r.confidence_level != null ? `${r.confidence_level}% confidence` : ''].filter(Boolean).join(' · '), seenAt, ref: `https://threatfox.abuse.ch/ioc/${id}/`, ip: hash ? undefined : ipv4Host(r.ioc_value) });
    }
  }
  return out;
}

export function parseSslbl(csv: string): OsintIndicator[] {
  const out: OsintIndicator[] = [];
  for (const line of csv.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    const [date, sha1, reason] = line.split(',');
    const seenAt = utcIso(date);
    if (!sha1 || !seenAt) continue;
    out.push({ id: `sslbl:${sha1}`, source: 'sslbl', kind: 'tls-sha1', value: sha1.trim(), threat: (reason ?? '').trim(), seenAt, ref: `https://sslbl.abuse.ch/ssl-certificates/sha1/${sha1.trim()}/` });
  }
  return out;
}

interface FeodoRow { ip_address?: string; port?: number; status?: string; malware?: string; country?: string; first_seen?: string; last_online?: string; as_name?: string }
export function parseFeodo(rows: FeodoRow[]): OsintIndicator[] {
  return rows.flatMap((r) => {
    const seenAt = utcIso(r.last_online) ?? utcIso(r.first_seen);
    if (!r.ip_address || !seenAt) return [];
    return [{ id: `feodo:${r.ip_address}:${r.port}`, source: 'feodo' as const, kind: 'ip:port', value: `${defang(r.ip_address)}:${r.port}`, threat: [r.malware, r.status, r.country, r.as_name].filter(Boolean).join(' · '), seenAt, ref: `https://feodotracker.abuse.ch/browse/host/${r.ip_address}/`, ip: r.ip_address, cc: r.country || undefined }];
  });
}

interface KevRow { cveID?: string; vendorProject?: string; product?: string; vulnerabilityName?: string; dateAdded?: string; knownRansomwareCampaignUse?: string }
export function parseKev(d: { vulnerabilities?: KevRow[] }): OsintIndicator[] {
  return (d.vulnerabilities ?? []).flatMap((r) => {
    const seenAt = utcIso(r.dateAdded);
    if (!r.cveID || !seenAt) return [];
    return [{ id: `kev:${r.cveID}`, source: 'kev' as const, kind: 'cve', value: r.cveID, threat: [`${r.vendorProject ?? ''} ${r.product ?? ''}`.trim(), r.vulnerabilityName, r.knownRansomwareCampaignUse === 'Known' ? 'used in ransomware' : ''].filter(Boolean).join(' · '), seenAt, ref: `https://nvd.nist.gov/vuln/detail/${r.cveID}` }];
  });
}

interface RansomRow { victim?: string; group?: string; country?: string; activity?: string; discovered?: string; attackdate?: string; url?: string }
export function parseRansomware(rows: RansomRow[]): OsintIndicator[] {
  return rows.flatMap((r) => {
    const seenAt = utcIso(r.discovered) ?? utcIso(r.attackdate);
    if (!r.victim || !seenAt) return [];
    return [{ id: `ransomware:${r.group}:${r.victim}`, source: 'ransomware' as const, kind: 'victim post', value: r.victim, threat: [r.group, r.country, r.activity && r.activity !== 'Not Found' ? r.activity : ''].filter(Boolean).join(' · '), seenAt, ref: r.url ?? 'https://www.ransomware.live/', cc: /^[A-Z]{2}$/.test(r.country ?? '') ? r.country : undefined }];
  });
}

export function newestFirst(list: OsintIndicator[], cap = Infinity): OsintIndicator[] {
  const seen = new Set<string>();
  return list
    .filter((i) => !seen.has(i.id) && (seen.add(i.id), true))
    .sort((a, b) => b.seenAt.localeCompare(a.seenAt))
    .slice(0, cap);
}

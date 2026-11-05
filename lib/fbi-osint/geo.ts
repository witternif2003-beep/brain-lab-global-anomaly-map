import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';

export const IP_COUNTRY_FILE = path.join(process.cwd(), 'data/geo/ipv4-country.json.gz');
export const IP_COUNTRY_ATTRIBUTION = 'IP geolocation by DB-IP (db-ip.com, CC BY 4.0) · country centroids: Google DSPL';

interface Raw { source: string; codes: string[]; starts: number[]; cc: number[]; centroids: Record<string, [number, number, string]> }
export interface IpCountryDb { lookup(ip: string): string | undefined; centroid(cc: string): { lat: number; lon: number; name: string } | undefined; source: string }

export function buildIpCountryDb(raw: Raw): IpCountryDb {
  const starts = new Float64Array(raw.starts.length);
  let acc = 0;
  raw.starts.forEach((d, i) => (starts[i] = acc += d));
  return {
    source: raw.source,
    lookup(ip) {
      const o = ip.split('.').map(Number);
      if (o.length !== 4 || o.some((n) => !(n >= 0 && n < 256))) return undefined;
      const n = ((o[0] * 256 + o[1]) * 256 + o[2]) * 256 + o[3];
      let lo = 0;
      let hi = starts.length - 1;
      if (n < starts[0]) return undefined;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= n) lo = mid;
        else hi = mid - 1;
      }
      return raw.codes[raw.cc[lo]] || undefined;
    },
    centroid(cc) {
      const c = raw.centroids[cc];
      return c ? { lat: c[0], lon: c[1], name: c[2] } : undefined;
    },
  };
}

let memo: Promise<IpCountryDb> | null = null;
export function loadIpCountryDb(): Promise<IpCountryDb> {
  memo ??= readFile(IP_COUNTRY_FILE).then((b) => buildIpCountryDb(JSON.parse(gunzipSync(b).toString('utf8')) as Raw));
  memo.catch(() => (memo = null));
  return memo;
}

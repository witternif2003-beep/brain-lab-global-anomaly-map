#!/usr/bin/env python3
"""Build data/geo/ipv4-country.json.gz from DB-IP IP-to-Country Lite (CC BY 4.0) + Google DSPL country centroids.

Usage: python3 scripts/build-ip-country.py [YYYY-MM]
"""
import csv, datetime, gzip, io, ipaddress, json, re, sys, urllib.request

month = sys.argv[1] if len(sys.argv) > 1 else datetime.date.today().strftime('%Y-%m')
DBIP = f'https://download.db-ip.com/free/dbip-country-lite-{month}.csv.gz'
CENTROIDS = 'https://developers.google.com/public-data/docs/canonical/countries_csv'

def get(url):
    req = urllib.request.Request(url, headers={'User-Agent': 'BrainLab-Research-Platform/1.0'})
    return urllib.request.urlopen(req, timeout=120).read()

rows = csv.reader(io.StringIO(gzip.decompress(get(DBIP)).decode()))
codes, starts, idx = [], [], []
code_ix = {}
prev_end, prev_cc = None, None
for start, end, cc in rows:
    if ':' in start:
        continue
    s, e = int(ipaddress.IPv4Address(start)), int(ipaddress.IPv4Address(end))
    if cc == 'ZZ':
        cc = ''
    if prev_cc == cc and prev_end is not None and s == prev_end + 1:
        prev_end = e
        continue
    if prev_end is not None and s != prev_end + 1:
        starts.append(prev_end + 1); idx.append(code_ix.setdefault('', len(code_ix)))
    if cc not in code_ix:
        code_ix[cc] = len(code_ix)
    starts.append(s); idx.append(code_ix[cc])
    prev_end, prev_cc = e, cc
codes = [c for c, _ in sorted(code_ix.items(), key=lambda kv: kv[1])]
deltas = [starts[0]] + [b - a for a, b in zip(starts, starts[1:])]

html = get(CENTROIDS).decode()
cent = {cc: [float(lat), float(lon), name.strip()] for cc, lat, lon, name in
        re.findall(r'<tr>\s*<td>([A-Z]{2})</td>\s*<td>([-\d.]+)</td>\s*<td>([-\d.]+)</td>\s*<td>([^<]+)</td>', html)}

out = {
    'source': f'DB-IP IP to Country Lite {month} (CC BY 4.0, https://db-ip.com); centroids: Google DSPL countries.csv',
    'codes': codes, 'starts': deltas, 'cc': idx, 'centroids': cent,
}
path = 'data/geo/ipv4-country.json.gz'
with gzip.open(path, 'wt') as f:
    json.dump(out, f, separators=(',', ':'))
print(path, len(starts), 'ranges', len(codes), 'codes', len(cent), 'centroids')

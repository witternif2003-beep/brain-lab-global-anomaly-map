#!/usr/bin/env node
// @ts-nocheck
// Builds lib/ga-terrain/sources.json: every USGS 3DEP 1 m DEM tile (S1M seamless + 1 m project tiles) whose
// footprint overlaps Georgia's bounding box, with the georeferencing read from each GeoTIFF header.
// Usage: node --import tsx scripts/build-ga-terrain-index.ts
import { writeFile, mkdtemp } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { DatabaseSync } from 'node:sqlite';
import { fromUrl } from 'geotiff';
import { lonLatConverter } from '../lib/ga-terrain/crs';

const BUCKET = 'https://prd-tnm.s3.amazonaws.com/';
const BASE = `${BUCKET}StagedProducts/Elevation/`;
const S1M_INDEX = `${BASE}S1M/FullExtentSpatialMetadata/S1M_Products.gpkg`;
const TIGER_GA = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer/0/query?where=STUSAB%3D%27GA%27&outFields=NAME&outSR=4326&f=geojson';
// Newest first: where tiles overlap, the newer survey wins. S1M is USGS's own seamless mosaic, so it leads.
const PROJECT_PRIORITY = ['GA_9County_D24', 'GA_Central_2019_B19', 'GA_Statewide_2018_B18_DRRA', 'GA_SW_Georgia_22_County_Lidar_2017_B17', 'GA_Georgia_A1_2016', 'GA_Georgia_A2_2016', 'GA_Georgia_A3_2016'];

async function gaBbox() {
  const g = await (await fetch(TIGER_GA)).json();
  let [w, s, e, n] = [180, 90, -180, -90];
  const walk = (c) => typeof c[0] === 'number' ? ([w, s, e, n] = [Math.min(w, c[0]), Math.min(s, c[1]), Math.max(e, c[0]), Math.max(n, c[1])]) : c.forEach(walk);
  walk(g.features[0].geometry.coordinates);
  return [w, s, e, n].map((v) => Math.round(v * 1e5) / 1e5);
}

async function listProjects() {
  const xml = await (await fetch(`${BUCKET}?list-type=2&prefix=StagedProducts/Elevation/1m/Projects/GA_&delimiter=/`)).text();
  const found = [...xml.matchAll(/<Prefix>StagedProducts\/Elevation\/1m\/Projects\/(GA_[^/<]+)\/<\/Prefix>/g)].map((m) => m[1]);
  const unknown = found.filter((p) => !PROJECT_PRIORITY.includes(p));
  if (unknown.length) throw new Error(`New Georgia 1 m projects need a priority: ${unknown.join(', ')}`);
  return PROJECT_PRIORITY.filter((p) => found.includes(p));
}

async function s1mUrls() {
  const dir = await mkdtemp(join(tmpdir(), 's1m-'));
  const file = join(dir, 'S1M_Products.gpkg');
  const res = await fetch(S1M_INDEX);
  if (!res.ok) throw new Error(`S1M index HTTP ${res.status}`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(file));
  const db = new DatabaseSync(file, { readOnly: true });
  return db.prepare('select dataset_link from current where current = 1 or current is null').all().map((r) => r.dataset_link);
}

function lonLatBox(epsg, x0, y0, x1, y1) {
  const inv = lonLatConverter(epsg);
  const pts = [[x0, y0], [x1, y0], [x0, y1], [x1, y1], [(x0 + x1) / 2, y0], [(x0 + x1) / 2, y1]].map((p) => inv.inverse(p));
  return [Math.min(...pts.map((p) => p[0])), Math.min(...pts.map((p) => p[1])), Math.max(...pts.map((p) => p[0])), Math.max(...pts.map((p) => p[1]))];
}

const overlaps = (a, b) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1];

async function header(url) {
  for (let attempt = 0; ; attempt++) {
    try {
      const tiff = await fromUrl(url);
      const im = await tiff.getImage(0);
      const [x0, y0] = im.getOrigin();
      const [rx, ry] = im.getResolution();
      const epsg = im.getGeoKeys().ProjectedCSTypeGeoKey;
      return { x0, y0, rx, ry: -ry, w: im.getWidth(), h: im.getHeight(), epsg, levels: await tiff.getImageCount(), nodata: im.getGDALNoData() };
    } catch (e) {
      if (attempt >= 3) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: limit }, async () => { while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); } }));
  return out;
}

async function main() {
  const bbox = await gaBbox();
  const projects = await listProjects();
  const groups = [['S1M', await s1mUrls()]];
  for (const p of projects) {
    const txt = await (await fetch(`${BASE}1m/Projects/${p}/0_file_download_links.txt`)).text();
    groups.push([p, txt.split(/\s+/).filter((u) => u.endsWith('.tif'))]);
  }

  const sources = [];
  const pad = [bbox[0] - 0.05, bbox[1] - 0.05, bbox[2] + 0.05, bbox[3] + 0.05];
  for (const [priority, [name, urls]] of groups.entries()) {
    // S1M names encode the Albers NW corner (n0870e1260 → y 870 km, x 1260 km), so filter before reading headers.
    const pre = name === 'S1M'
      ? urls.filter((u) => {
          const m = /S1M_n(\d{4})e(\d{4})_/.exec(u);
          if (!m) return false;
          const x = +m[2] * 1000, y = +m[1] * 1000;
          return overlaps(lonLatBox(6350, x, y - 10000, x + 10000, y), pad);
        })
      : urls;
    const heads = await mapLimit(pre, 24, header);
    let kept = 0;
    pre.forEach((url, k) => {
      const h = heads[k];
      const box = lonLatBox(h.epsg, h.x0, h.y0 - h.h * h.ry, h.x0 + h.w * h.rx, h.y0);
      if (!overlaps(box, bbox)) return;
      kept++;
      sources.push({ p: url.slice(BASE.length), e: h.epsg, x0: h.x0, y0: h.y0, rx: h.rx, ry: h.ry, w: h.w, h: h.h, l: h.levels, n: h.nodata, pri: priority, bb: box.map((v) => Math.round(v * 1e5) / 1e5) });
    });
    console.error(`${name}: ${urls.length} listed, ${pre.length} near Georgia, ${kept} kept`);
  }

  const out = { generatedAt: new Date().toISOString(), base: BASE, gaBbox: bbox, groups: groups.map(([n]) => n), sources };
  await writeFile(new URL('../lib/ga-terrain/sources.json', `file://${__filename}`), JSON.stringify(out));
  console.error(`wrote ${sources.length} sources`);
}

main().catch((e) => { console.error(e); process.exit(1); });

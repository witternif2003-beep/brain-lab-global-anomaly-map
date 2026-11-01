// Builds lib/ga-lidar/projects.json: every USGS 3DEP LiDAR point-cloud project (Entwine/EPT on AWS Open Data)
// over Georgia (names starting GA_ or USGS_LPC_GA_), with its EPT cube, conforming bounds, collection year and
// USGS quality level (QL) from the 3DEP Work Unit Extent Spatial Metadata (WESM) index.
// Source lists: https://github.com/hobuinc/usgs-lidar (boundaries/resources.geojson) and
// https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer/8 (WESM lidar point cloud work units)
import fs from 'node:fs';
import path from 'node:path';

const RESOURCES = 'https://raw.githubusercontent.com/hobuinc/usgs-lidar/master/boundaries/resources.geojson';
const WESM = 'https://index.nationalmap.gov/arcgis/rest/services/3DEPElevationIndex/MapServer/8/query';
const out = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'lib', 'ga-lidar', 'projects.json');

/** Collection year: the first 4-digit year in the name (USGS_LPC_GA_Georgia_A1_2016_LAS_2018 was flown in 2016). */
export const collectionYear = (name) => Number(/_((?:19|20)\d{2})(?=_|$)/.exec(name)?.[1] ?? 0);

/** QL of the WESM work units flown within a year of `year` that overlap the project box most (bbox overlap, EPSG:3857). */
async function qualityLevel(b, year) {
  const q = new URLSearchParams({
    geometry: [b[0], b[1], b[3], b[4]].join(','), geometryType: 'esriGeometryEnvelope', inSR: '3857', outSR: '3857',
    spatialRel: 'esriSpatialRelIntersects', outFields: 'workunit,ql,collect_start,collect_end', returnGeometry: 'true',
    maxAllowableOffset: '500', f: 'json',
  });
  const res = await (await fetch(`${WESM}?${q}`)).json();
  const area = {};
  for (const f of res.features ?? []) {
    const a = f.attributes;
    const y0 = new Date(a.collect_start).getUTCFullYear();
    const y1 = new Date(a.collect_end).getUTCFullYear();
    if (year < y0 - 1 || year > y1 + 1) continue;
    let x0 = Infinity, y0b = Infinity, x1 = -Infinity, y1b = -Infinity;
    for (const ring of f.geometry?.rings ?? []) for (const [x, y] of ring) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0b = Math.min(y0b, y); y1b = Math.max(y1b, y);
    }
    const ov = Math.max(0, Math.min(x1, b[3]) - Math.max(x0, b[0])) * Math.max(0, Math.min(y1b, b[4]) - Math.max(y0b, b[1]));
    const ql = /^QL \d$/.test(a.ql) ? a.ql.replace(' ', '') : 'other';
    area[ql] = (area[ql] ?? 0) + ov;
  }
  const best = Object.entries(area).sort((p, q) => q[1] - p[1])[0];
  return best && best[1] > 0 ? best[0] : 'unknown';
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const fc = await (await fetch(RESOURCES)).json();
  const ga = fc.features.filter((f) => /^(USGS_LPC_)?GA_/.test(f.properties.name));
  const projects = [];
  for (const f of ga) {
    const ept = await (await fetch(f.properties.url)).json();
    if (ept.dataType !== 'laszip' || ept.srs?.horizontal !== '3857') continue;
    const year = collectionYear(f.properties.name);
    projects.push({
      name: f.properties.name,
      year,
      ql: await qualityLevel(ept.boundsConforming, year),
      points: ept.points,
      bounds: ept.bounds,
      boundsConforming: ept.boundsConforming,
      span: ept.span,
    });
  }
  projects.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
  fs.writeFileSync(out, JSON.stringify({ source: RESOURCES, qlSource: WESM, retrieved: new Date().toISOString(), projects }, null, 1) + '\n');
  console.log(`wrote ${projects.length} projects to ${out}`);
}

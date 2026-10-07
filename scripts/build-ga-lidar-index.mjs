// Builds lib/ga-lidar/projects.json: every USGS 3DEP LiDAR point-cloud project (Entwine/EPT on AWS Open Data)
// whose name starts with GA_, with its EPT cube and conforming bounds.
// Source list: https://github.com/hobuinc/usgs-lidar (boundaries/resources.geojson)
import fs from 'node:fs';
import path from 'node:path';

const RESOURCES = 'https://raw.githubusercontent.com/hobuinc/usgs-lidar/master/boundaries/resources.geojson';
const out = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'lib', 'ga-lidar', 'projects.json');

const fc = await (await fetch(RESOURCES)).json();
const ga = fc.features.filter((f) => /^GA_/.test(f.properties.name));
const projects = [];
for (const f of ga) {
  const ept = await (await fetch(f.properties.url)).json();
  if (ept.dataType !== 'laszip' || ept.srs?.horizontal !== '3857') continue;
  const year = Number(/_(\d{4})$/.exec(f.properties.name)?.[1] ?? 0);
  projects.push({
    name: f.properties.name,
    year,
    points: ept.points,
    bounds: ept.bounds,
    boundsConforming: ept.boundsConforming,
    span: ept.span,
  });
}
projects.sort((a, b) => b.year - a.year || a.name.localeCompare(b.name));
fs.writeFileSync(out, JSON.stringify({ source: RESOURCES, retrieved: new Date().toISOString(), projects }, null, 1) + '\n');
console.log(`wrote ${projects.length} projects to ${out}`);

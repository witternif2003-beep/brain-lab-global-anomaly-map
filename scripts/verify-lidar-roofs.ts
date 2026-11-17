/**
 * Field check of the LiDAR roof fit on real data: the same /api/ga-lidar nodes the browser draws, the same Overture
 * footprints, the same buildRoofModel. Reports fitted/rejected counts, roof kinds, RMS, and agreement with Overture's
 * own `roof_shape` (OpenStreetMap-mapped) where recorded. Usage: npx tsx scripts/verify-lidar-roofs.ts [api-origin]
 */
import { PMTiles } from 'pmtiles';
import { VectorTile } from '@mapbox/vector-tile';
import { PbfReader as Pbf } from 'pbf';
import { gunzipSync } from 'node:zlib';
import { EPT_ROOT, decodeNode, lngLatTo3857, pickCoveringProject, planNodes, targetDepthFor, type Hierarchy, type LidarNodeData } from '../lib/ga-lidar/ept';
import { ringFromCoordinates } from '../lib/ga-buildings/lidar-heights';
import { buildRoofModel, fitRoofPlanes, roofPoints, roofSurface, MAX_FIT_RMS_M, MIN_INLIER_SHARE, ROOF_FIT_MIN_POINTS } from '../lib/ga-buildings/lidar-roofs';
import { OVERTURE_FALLBACK_RELEASE, OVERTURE_TILES_BUCKET } from '../lib/ga-buildings/overture';

const API = process.argv[2] ?? 'https://brain-lab-six.vercel.app';
const SITES: [string, number, number][] = [
  ['Athens (Five Points)', -83.392, 33.944],
  ['Athens (downtown, OSM roof shapes mapped)', -83.377, 33.957],
  ['Atlanta (Inman Park)', -84.353, 33.757],
  ['Savannah (Ardsley Park)', -81.096, 32.045],
];
const HALF = 140;

const tileXY = (lon: number, lat: number, z: number) => {
  const n = 2 ** z;
  return [Math.floor(((lon + 180) / 360) * n), Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n)];
};

async function lidarNodes(x: number, y: number): Promise<LidarNodeData[]> {
  const roots = new Map<string, Hierarchy>();
  const root = async (p: { name: string }) => {
    if (!roots.has(p.name)) roots.set(p.name, await (await fetch(`${EPT_ROOT}/${p.name}/ept-hierarchy/0-0-0-0.json`)).json());
    return roots.get(p.name)!;
  };
  const project = await pickCoveringProject(x, y, root);
  if (!project) return [];
  const h: Hierarchy = { ...(await root(project)) };
  const load = async (k: string) => Object.assign(h, await (await fetch(`${EPT_ROOT}/${project.name}/ept-hierarchy/${k}.json`)).json());
  // Same view the desktop map plans at zoom 17 (lib/ga-lidar-layer.ts: VIEW_TILES 3.5, EXTRA_DEPTH_DESKTOP 3, MAX_EPT_DEPTH 18).
  const viewHalf = (3.5 * 40075016.68557849) / 2 ** 17;
  const view = { cx: x, cy: y, half: viewHalf, targetDepth: Math.min(18, targetDepthFor(project, viewHalf, 18) + Number(process.env.EXTRA_DEPTH ?? 3)), pointBudget: Number(process.env.POINT_BUDGET ?? 4_000_000) };
  let plan = planNodes(project, h, view);
  const seen = new Set<string>();
  for (let r = 0; r < 8 && plan.pendingHierarchy.some((k) => !seen.has(k)); r++) {
    const todo = plan.pendingHierarchy.filter((k) => !seen.has(k));
    todo.forEach((k) => seen.add(k));
    await Promise.all(todo.map(load));
    plan = planNodes(project, h, view);
  }
  const out: LidarNodeData[] = [];
  for (let i = 0; i < plan.nodes.length; i += 8) {
    await Promise.all(
      plan.nodes.slice(i, i + 8).map(async (n) => {
        const r = await fetch(`${API}/api/ga-lidar?project=${encodeURIComponent(project.name)}&node=${n.key}`);
        if (r.ok) out.push(decodeNode(await r.arrayBuffer()));
      }),
    );
  }
  console.log(`  depth ${view.targetDepth}, pending ${plan.pendingHierarchy.length}, planned points ${plan.points}`);
  console.log(`  LiDAR project ${project.name} (${project.year}, ${project.ql}); ${plan.nodes.length} nodes, ${out.reduce((s, n) => s + n.count, 0)} points`);
  return out;
}

async function main(): Promise<void> {
  const pm = new PMTiles(`${OVERTURE_TILES_BUCKET}/tiles/${OVERTURE_FALLBACK_RELEASE}/buildings.pmtiles`);
  const totals = { buildings: 0, fitted: 0, rejected: 0, labelled: 0, agree: 0 };
  const allRms: number[] = [];
  const allReasons: Record<string, number> = {};
  for (const [name, lon, lat] of SITES) {
    console.log(name);
    const [cx, cy] = lngLatTo3857(lon, lat);
    const nodes = await lidarNodes(cx, cy);
    const [tx, ty] = tileXY(lon, lat, 14);
    const t = await pm.getZxy(14, tx, ty);
    if (!t) continue;
    let buf = Buffer.from(t.data);
    if (buf[0] === 0x1f) buf = gunzipSync(buf);
    const L = new VectorTile(new Pbf(buf)).layers.building;
    const kinds: Record<string, number> = {};
    const reasons: Record<string, number> = {};
    const rms: number[] = [];
    let n = 0, fitted = 0;
    for (let i = 0; i < L.length; i++) {
      const f = L.feature(i).toGeoJSON(tx, ty, 14);
      const pr = f.properties as Record<string, unknown>;
      if (pr.has_parts === true || pr.is_underground === true) continue;
      const g = f.geometry;
      const outer = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0]?.[0] : null;
      if (!outer || outer.length < 4) continue;
      const ring = ringFromCoordinates(outer);
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (let k = 0; k < ring.xy.length; k += 2) {
        minX = Math.min(minX, ring.xy[k]); maxX = Math.max(maxX, ring.xy[k]);
        minY = Math.min(minY, ring.xy[k + 1]); maxY = Math.max(maxY, ring.xy[k + 1]);
      }
      const ox = (minX + maxX) / 2, oy = (minY + maxY) / 2;
      if (Math.abs(ox - cx) > HALF - 20 || Math.abs(oy - cy) > HALF - 20) continue;
      n++;
      const local = new Float64Array(ring.xy.length);
      for (let k = 0; k < ring.xy.length; k += 2) { local[k] = ring.xy[k] - ox; local[k + 1] = ring.xy[k + 1] - oy; }
      const pts = roofPoints(ring, nodes, ox, oy);
      const m = buildRoofModel(local, pts);
      if (!m) {
        let why = 'mesh';
        if (pts.x.length < ROOF_FIT_MIN_POINTS) why = 'too few returns';
        else {
          const fit = fitRoofPlanes(pts);
          const share = fit.label.filter((l) => l >= 0).length / pts.x.length;
          if (!fit.planes.length || share < MIN_INLIER_SHARE) why = 'returns not planar';
          else {
            const surf = roofSurface(pts, fit);
            let se = 0;
            for (let k = 0; k < pts.x.length; k++) se += (surf(pts.x[k], pts.y[k]) - pts.z[k]) ** 2;
            if (Math.sqrt(se / pts.x.length) > MAX_FIT_RMS_M) why = 'RMS too high';
          }
        }
        reasons[why] = (reasons[why] ?? 0) + 1;
        allReasons[why] = (allReasons[why] ?? 0) + 1;
        continue;
      }
      fitted++;
      kinds[m.kind] = (kinds[m.kind] ?? 0) + 1;
      rms.push(m.rmsM);
      const shape = typeof pr.roof_shape === 'string' ? pr.roof_shape : null;
      if (shape) {
        totals.labelled++;
        const expect = shape === 'flat' ? 'flat' : shape === 'gabled' ? 'gabled' : shape === 'skillion' ? 'single-slope' : 'multi-plane';
        if (expect === m.kind || (expect === 'multi-plane' && m.kind !== 'flat')) totals.agree++;
      }
    }
    rms.sort((a, b) => a - b);
    const q = (p: number) => (rms.length ? rms[Math.min(rms.length - 1, Math.floor(p * rms.length))].toFixed(2) : 'n/a');
    console.log(`  buildings ${n}, fitted ${fitted} (${n ? ((100 * fitted) / n).toFixed(1) : 0}%), kinds ${JSON.stringify(kinds)}, RMS median ${q(0.5)} m, p90 ${q(0.9)} m, rejected ${JSON.stringify(reasons)}`);
    totals.buildings += n;
    totals.fitted += fitted;
    totals.rejected += n - fitted;
    allRms.push(...rms);
  }
  allRms.sort((a, b) => a - b);
  console.log('TOTAL', JSON.stringify({ ...totals, rejectedBecause: allReasons, rmsMedianM: allRms[Math.floor(allRms.length / 2)] ?? null, rmsP90M: allRms[Math.floor(allRms.length * 0.9)] ?? null }));
}

void main();

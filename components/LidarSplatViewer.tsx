'use client';

import { useEffect, useRef, useState } from 'react';
import type * as PC from 'playcanvas';
import {
  EPT_ROOT,
  GA_LIDAR_SOURCE_URL,
  decodeNode,
  lidarColor,
  lngLatTo3857,
  pickProject,
  planNodes,
  targetDepthFor,
  type EptProject,
  type Hierarchy,
} from '../lib/ga-lidar/ept';
import { gaussianize, toPlyColumns } from '../lib/ga-lidar/gaussian';

const PRESETS = [
  { id: 'atl', label: 'Downtown Atlanta', lng: -84.388, lat: 33.749 },
  { id: 'stadium', label: 'Mercedes-Benz Stadium', lng: -84.4008, lat: 33.7554 },
  { id: 'midtown', label: 'Midtown Atlanta', lng: -84.3857, lat: 33.7816 },
] as const;
const HALF_3857 = 350;
const SPLAT_BUDGET_DESKTOP = 1_200_000;
const SPLAT_BUDGET_TOUCH = 400_000;
const FETCH_PARALLEL = 6;
/** Gaussian sigma as a fraction of the mean 3-neighbour distance. */
const SPLAT_SIZE_FACTOR = 0.4;

export interface SplatStats {
  status: string;
  device: 'webgpu' | 'webgl2' | null;
  webgpuInBrowser: boolean;
  xrVr: boolean | null;
  xrActive: boolean;
  project: string | null;
  year: number | null;
  splats: number;
  fps: number | null;
  errors: number;
}

declare global {
  interface Window {
    __gaSplat?: SplatStats;
  }
}

const isTouch = () => typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;

async function loadHierarchy(project: EptProject, file: string, into: Hierarchy): Promise<void> {
  const r = await fetch(`${EPT_ROOT}/${project.name}/ept-hierarchy/${file}.json`);
  if (!r.ok) throw new Error(`hierarchy ${file}: HTTP ${r.status}`);
  Object.assign(into, (await r.json()) as Hierarchy);
}

/** USGS 3DEP points around a centre as local metres (x east, y north, z height above ground) and ASPRS-class colours. */
async function loadPoints(project: EptProject, cx: number, cy: number, budget: number, lat: number, stats: SplatStats, onProgress: () => void) {
  const hierarchy: Hierarchy = {};
  const loaded = new Set<string>();
  const view = { cx, cy, half: HALF_3857, targetDepth: targetDepthFor(project, HALF_3857), pointBudget: budget };
  await loadHierarchy(project, '0-0-0-0', hierarchy);
  loaded.add('0-0-0-0');
  let plan = planNodes(project, hierarchy, view);
  for (let round = 0; round < 8 && plan.pendingHierarchy.some((k) => !loaded.has(k)); round++) {
    const todo = plan.pendingHierarchy.filter((k) => !loaded.has(k));
    await Promise.all(todo.map(async (k) => {
      loaded.add(k);
      await loadHierarchy(project, k, hierarchy).catch(() => { stats.errors++; });
    }));
    plan = planNodes(project, hierarchy, view);
  }
  const k = Math.cos((lat * Math.PI) / 180);
  const pos: number[] = [];
  const rgb: number[] = [];
  const queue = [...plan.nodes];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      try {
        const r = await fetch(`/api/ga-lidar?project=${encodeURIComponent(project.name)}&node=${next.key}`);
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const d = decodeNode(await r.arrayBuffer());
        for (let i = 0; i < d.count; i++) {
          if (d.cls[i] === 7 || d.cls[i] === 18) continue;
          pos.push((d.minX + d.x[i] - cx) * k, (d.minY + d.y[i] - cy) * k, d.hag[i]);
          const c = lidarColor(d.cls[i], d.hag[i], d.intensity[i]);
          rgb.push(c[0], c[1], c[2]);
        }
        stats.status = `loading points (${(pos.length / 3).toLocaleString()})`;
        onProgress();
      } catch {
        stats.errors++;
      }
    }
  };
  await Promise.all(Array.from({ length: FETCH_PARALLEL }, worker));
  return { position: new Float32Array(pos), rgb: Uint8Array.from(rgb) };
}

export default function LidarSplatViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<PC.Entity | null>(null);
  const pcRef = useRef<typeof PC | null>(null);
  const [preset, setPreset] = useState<(typeof PRESETS)[number]['id']>('atl');
  const [stats, setStats] = useState<SplatStats>({
    status: 'starting', device: null, webgpuInBrowser: false, xrVr: null, xrActive: false,
    project: null, year: null, splats: 0, fps: null, errors: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    let disposed = false;
    let app: PC.AppBase | null = null;
    const s: SplatStats = {
      status: 'starting renderer', device: null, webgpuInBrowser: typeof navigator !== 'undefined' && 'gpu' in navigator,
      xrVr: null, xrActive: false, project: null, year: null, splats: 0, fps: null, errors: 0,
    };
    const publish = () => {
      window.__gaSplat = { ...s };
      if (!disposed) setStats({ ...s });
    };
    const cleanups: (() => void)[] = [];

    (async () => {
      const pc = await import('playcanvas');
      pcRef.current = pc;
      const device = await pc.createGraphicsDevice(canvas, {
        deviceTypes: [pc.DEVICETYPE_WEBGPU, pc.DEVICETYPE_WEBGL2],
        xrCompatible: true,
        antialias: false,
        powerPreference: 'high-performance',
      });
      if (disposed) {
        device.destroy();
        return;
      }
      s.device = device.isWebGPU ? 'webgpu' : 'webgl2';
      const opts = new pc.AppOptions();
      opts.graphicsDevice = device;
      opts.componentSystems = [pc.CameraComponentSystem, pc.GSplatComponentSystem];
      opts.resourceHandlers = [];
      opts.xr = pc.XrManager;
      app = new pc.AppBase(canvas);
      app.init(opts);
      app.setCanvasFillMode(pc.FILLMODE_NONE);
      app.setCanvasResolution(pc.RESOLUTION_AUTO);
      const fit = () => app?.resizeCanvas(wrap.clientWidth, wrap.clientHeight);
      const ro = new ResizeObserver(fit);
      ro.observe(wrap);
      cleanups.push(() => ro.disconnect());
      fit();

      const camera = new pc.Entity('camera');
      camera.addComponent('camera', { clearColor: new pc.Color(0.02, 0.03, 0.06), farClip: 5000, nearClip: 0.3, fov: 60 });
      app.root.addChild(camera);
      cameraRef.current = camera;

      let yaw = 30, pitch = -35, dist = 600;
      const target = new pc.Vec3(0, 10, 0);
      const place = () => {
        if (app?.xr?.active) return;
        const p = (pitch * Math.PI) / 180, y = (yaw * Math.PI) / 180;
        camera.setPosition(target.x + dist * Math.cos(p) * Math.sin(y), target.y - dist * Math.sin(p), target.z + dist * Math.cos(p) * Math.cos(y));
        camera.lookAt(target);
      };
      let drag: { x: number; y: number } | null = null;
      const down = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); };
      const move = (e: PointerEvent) => {
        if (!drag) return;
        yaw -= (e.clientX - drag.x) * 0.3;
        pitch = Math.max(-89, Math.min(-3, pitch - (e.clientY - drag.y) * 0.3));
        drag = { x: e.clientX, y: e.clientY };
        place();
      };
      const up = () => { drag = null; };
      const wheel = (e: WheelEvent) => { e.preventDefault(); dist = Math.max(20, Math.min(2000, dist * Math.exp(e.deltaY * 0.001))); place(); };
      canvas.addEventListener('pointerdown', down);
      canvas.addEventListener('pointermove', move);
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('wheel', wheel, { passive: false });
      cleanups.push(() => {
        canvas.removeEventListener('pointerdown', down);
        canvas.removeEventListener('pointermove', move);
        canvas.removeEventListener('pointerup', up);
        canvas.removeEventListener('wheel', wheel);
      });
      place();

      const xr = app.xr;
      if (xr) {
        s.xrVr = xr.supported ? xr.isAvailable(pc.XRTYPE_VR) : false;
        xr.on(`available:${pc.XRTYPE_VR}`, (available: boolean) => { s.xrVr = available; publish(); });
        xr.on('start', () => { s.xrActive = true; camera.setPosition(0, 0, 0); camera.setEulerAngles(0, 0, 0); publish(); });
        xr.on('end', () => { s.xrActive = false; place(); publish(); });
      }

      let frames = 0, acc = 0;
      app.on('update', (dt: number) => {
        frames++;
        acc += dt;
        if (acc >= 1) {
          s.fps = Math.round((frames / acc) * 10) / 10;
          frames = 0;
          acc = 0;
          publish();
        }
      });
      app.start();
      publish();

      const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[0];
      const [cx, cy] = lngLatTo3857(p.lng, p.lat);
      const project = pickProject(cx, cy);
      if (!project) {
        s.status = 'no USGS 3DEP LiDAR covers this location';
        publish();
        return;
      }
      s.project = project.name;
      s.year = project.year;
      s.status = 'loading LiDAR hierarchy';
      publish();
      const pts = await loadPoints(project, cx, cy, isTouch() ? SPLAT_BUDGET_TOUCH : SPLAT_BUDGET_DESKTOP, p.lat, s, publish);
      if (disposed || !app) return;
      s.status = 'building Gaussians (3-nearest-neighbour scales)';
      publish();
      await new Promise((r) => setTimeout(r, 0));
      const set = gaussianize(pts.position, pts.rgb, { minScale: 0.03, maxScale: 0.6, sizeFactor: SPLAT_SIZE_FACTOR });
      const cols = toPlyColumns(set, 0.92);
      const n = set.count;
      for (let i = 0; i < n; i++) {
        const north = cols.y[i];
        cols.y[i] = cols.z[i];
        cols.z[i] = -north;
      }
      const data = new pc.GSplatData([{
        name: 'vertex',
        count: n,
        properties: Object.entries(cols).map(([name, storage]) => ({ type: 'float', name, storage, byteSize: 4 })),
      }]);
      const resource = new pc.GSplatResource(device, data);
      const splat = new pc.Entity('lidar-gaussians');
      splat.addComponent('gsplat', { resource });
      app.root.addChild(splat);
      s.splats = n;
      s.status = 'ready';
      publish();
    })().catch((err: unknown) => {
      s.status = `error: ${err instanceof Error ? err.message : String(err)}`;
      s.errors++;
      publish();
    });

    return () => {
      disposed = true;
      cleanups.forEach((f) => f());
      cameraRef.current = null;
      app?.destroy();
      delete window.__gaSplat;
    };
  }, [preset]);

  const enterVr = () => {
    const pc = pcRef.current;
    const cam = cameraRef.current?.camera;
    if (!pc || !cam) return;
    cam.startXr(pc.XRTYPE_VR, pc.XRSPACE_LOCALFLOOR, {
      callback: (err: Error | null) => {
        if (err) setStats((x) => ({ ...x, status: `VR failed: ${err.message}` }));
      },
    });
  };

  return (
    <div className="space-y-3 font-mono">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {PRESETS.map((p) => (
          <button key={p.id} type="button" onClick={() => setPreset(p.id)}
            className={`rounded border px-2 py-1 ${preset === p.id ? 'border-cyan-400 text-cyan-300' : 'border-slate-700 text-slate-400'}`}>
            {p.label}
          </button>
        ))}
        <button type="button" onClick={enterVr} disabled={!stats.xrVr || stats.status !== 'ready'}
          className="rounded border border-fuchsia-500 px-2 py-1 text-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-40">
          {stats.xrVr ? 'Enter VR' : 'VR not available in this browser'}
        </button>
      </div>
      <div ref={wrapRef} className="relative h-[70vh] w-full overflow-hidden rounded border border-slate-800 bg-black">
        <canvas ref={canvasRef} className="block h-full w-full touch-none" data-testid="lidar-splat-canvas" />
        <div className="pointer-events-none absolute left-2 top-2 space-y-0.5 rounded bg-black/70 p-2 text-[11px] text-slate-300">
          <div>renderer: {stats.device ?? '…'}{stats.device === 'webgl2' ? (stats.webgpuInBrowser ? ' (WebGPU adapter refused)' : ' (no WebGPU in this browser)') : ''}</div>
          <div>status: {stats.status}</div>
          <div>gaussians: {stats.splats.toLocaleString()} · fps: {stats.fps ?? '–'} · errors: {stats.errors}</div>
          <div>survey: {stats.project ?? '–'}{stats.year ? ` (${stats.year})` : ''}</div>
          <div>WebXR immersive-vr: {stats.xrVr === null ? 'checking' : stats.xrVr ? 'available' : 'not available'}{stats.xrActive ? ' · in VR' : ''}</div>
        </div>
      </div>
      <p className="text-[11px] text-slate-500">
        One isotropic Gaussian per USGS 3DEP laser return (noise classes dropped), sized at 0.4× the mean distance to its 3 nearest
        neighbours and coloured by ASPRS class, the same initialisation 3D Gaussian Splatting uses before training. No photo
        training or optimisation is done, so this is a splat rendering of measured points, not a photoreal radiance field.
        Rendered by PlayCanvas Engine 2.23.0 (WebGPU, falling back to WebGL2). Source:{' '}
        <a className="underline" href={GA_LIDAR_SOURCE_URL} target="_blank" rel="noreferrer">USGS 3DEP on AWS Open Data</a>.
      </p>
    </div>
  );
}

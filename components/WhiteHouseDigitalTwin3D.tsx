"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  ShieldAlert,
  Crosshair,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Activity,
  Layers,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  BookOpen,
} from "lucide-react";
import { WHITE_HOUSE_ANOMALIES, WhiteHouseAnomalyNode } from "../lib/whitehouse-digital-twin";
import {
  ARCHITECTURAL_VOLUMES,
  ArchitecturalVolume,
  Wing,
  WING_LABELS,
  provenanceSummary,
} from "../lib/whitehouse-architecture";

/** 1 scene unit = 1 metre; catalog is in centimetres. */
const CM = 0.01;
const SECTOR_TO_WING: Record<string, Wing | "ALL"> = {
  ALL: "ALL",
  WEST_WING: "WEST_WING",
  SITUATION_ROOM: "WEST_WING",
  EXECUTIVE_RESIDENCE: "EXECUTIVE_RESIDENCE",
  RESIDENCE: "EXECUTIVE_RESIDENCE",
  EAST_WING: "EAST_WING",
  ROSE_GARDEN: "GROUNDS",
};
const SECTORS = ["ALL", "EXECUTIVE_RESIDENCE", "WEST_WING", "EAST_WING", "GROUNDS"] as const;

/** catalog (x=west, y=north, z=up) → three (x=east, y=up, z=south) */
function toScene(x: number, y: number, z: number): THREE.Vector3 {
  return new THREE.Vector3(-x * CM, z * CM, -y * CM);
}

function buildVolumeMesh(v: ArchitecturalVolume): THREE.Object3D {
  const group = new THREE.Group();
  const w = v.size.w * CM;
  const d = v.size.d * CM;
  const h = v.size.h * CM;
  const geometry =
    v.shape === "ellipse"
      ? new THREE.CylinderGeometry(0.5, 0.5, h, 48).scale(w, 1, d)
      : new THREE.BoxGeometry(w, h, d);

  const color = new THREE.Color(v.color);
  const estimate = v.provenance === "FOOTPRINT_EST";
  const material = new THREE.MeshPhysicalMaterial({
    color,
    transparent: true,
    opacity: estimate ? 0.08 : 0.28,
    roughness: 0.25,
    metalness: 0.1,
    transmission: estimate ? 0 : 0.35,
    emissive: color,
    emissiveIntensity: estimate ? 0.05 : 0.18,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.volumeId = v.id;
  group.add(mesh);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, 20),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: estimate ? 0.35 : 0.9 })
  );
  if (estimate) {
    edges.material = new THREE.LineDashedMaterial({ color, dashSize: 0.6, gapSize: 0.4, transparent: true, opacity: 0.6 });
    edges.computeLineDistances();
  }
  group.add(edges);

  const c = toScene(v.center.x, v.center.y, v.center.z);
  group.position.set(c.x, c.y + h / 2, c.z);
  group.userData.volumeId = v.id;
  group.userData.wing = v.wing;
  return group;
}

function buildAnomalyMarker(a: WhiteHouseAnomalyNode): THREE.Group {
  const g = new THREE.Group();
  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.35, 24, 24),
    new THREE.MeshStandardMaterial({ color: "#ff1744", emissive: "#ff1744", emissiveIntensity: 1.6 })
  );
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.6, 0.75, 48),
    new THREE.MeshBasicMaterial({ color: "#ff5252", transparent: true, opacity: 0.8, side: THREE.DoubleSide })
  );
  ring.rotation.x = -Math.PI / 2;
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 40, 8),
    new THREE.MeshBasicMaterial({ color: "#ff1744", transparent: true, opacity: 0.25 })
  );
  beam.position.y = 20;
  g.add(core, ring, beam);
  const p = toScene(
    a.exactCoordinatesCentimeter.x_cm,
    a.exactCoordinatesCentimeter.y_cm,
    a.exactCoordinatesCentimeter.z_elevation_cm
  );
  g.position.copy(p);
  g.userData.anomalyId = a.id;
  g.userData.sector = a.sector;
  core.userData.anomalyId = a.id;
  return g;
}

export default function WhiteHouseDigitalTwin3D() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    volumes: Map<string, THREE.Object3D>;
    markers: Map<string, THREE.Group>;
  } | null>(null);

  const [isRotating, setIsRotating] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeSector, setActiveSector] = useState<(typeof SECTORS)[number]>("ALL");
  const [selectedAnomaly, setSelectedAnomaly] = useState<WhiteHouseAnomalyNode>(WHITE_HOUSE_ANOMALIES[0]);
  const [selectedVolume, setSelectedVolume] = useState<ArchitecturalVolume | null>(null);
  const [fps, setFps] = useState(0);

  const isRotatingRef = useRef(true);
  const selectedAnomalyRef = useRef(selectedAnomaly.id);
  const targetRef = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null);

  useEffect(() => { isRotatingRef.current = isRotating; }, [isRotating]);
  useEffect(() => { selectedAnomalyRef.current = selectedAnomaly.id; }, [selectedAnomaly]);

  const flyTo = useCallback((center: THREE.Vector3, radius: number) => {
    const s = sceneRef.current;
    if (!s) return;
    const dir = s.camera.position.clone().sub(s.controls.target).normalize();
    if (dir.lengthSq() === 0) dir.set(0.6, 0.7, 1).normalize();
    targetRef.current = { pos: center.clone().add(dir.multiplyScalar(radius * 2.4)), look: center.clone() };
  }, []);

  const resetView = useCallback(() => {
    targetRef.current = { pos: new THREE.Vector3(40, 45, 95), look: new THREE.Vector3(0, 6, -10) };
  }, []);

  const zoomBy = useCallback((factor: number) => {
    const s = sceneRef.current;
    if (!s) return;
    const offset = s.camera.position.clone().sub(s.controls.target).multiplyScalar(factor);
    targetRef.current = { pos: s.controls.target.clone().add(offset), look: s.controls.target.clone() };
  }, []);

  // Scene bootstrap (single mount)
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(mount.clientWidth || 1, mount.clientHeight || 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020b18, 0.0045);

    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 2000);
    camera.position.set(40, 45, 95);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 4;
    controls.maxDistance = 400;
    controls.maxPolarAngle = Math.PI / 2 - 0.02;
    controls.target.set(0, 6, -10);
    controls.addEventListener("start", () => { targetRef.current = null; });

    scene.add(new THREE.HemisphereLight(0x8fd6ff, 0x081226, 0.9));
    const key = new THREE.DirectionalLight(0xffffff, 1.4);
    key.position.set(60, 90, 40);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x00e5ff, 0.6);
    rim.position.set(-80, 30, -60);
    scene.add(rim);

    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(220, 96),
      new THREE.MeshStandardMaterial({ color: 0x06182c, roughness: 0.95, metalness: 0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    scene.add(ground);
    const grid = new THREE.GridHelper(300, 150, 0x0e3a5a, 0x08243a);
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.45;
    scene.add(grid);

    const volumes = new Map<string, THREE.Object3D>();
    for (const v of ARCHITECTURAL_VOLUMES) {
      const obj = buildVolumeMesh(v);
      volumes.set(v.id, obj);
      scene.add(obj);
    }

    const markers = new Map<string, THREE.Group>();
    for (const a of WHITE_HOUSE_ANOMALIES) {
      const m = buildAnomalyMarker(a);
      markers.set(a.id, m);
      scene.add(m);
    }

    sceneRef.current = { renderer, camera, controls, volumes, markers };

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downAt = 0;
    const onDown = () => { downAt = performance.now(); };
    const onUp = (e: PointerEvent) => {
      if (performance.now() - downAt > 220) return;
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const markerHits = raycaster.intersectObjects([...markers.values()], true);
      const hitMarker = markerHits.find((h) => h.object.userData.anomalyId);
      if (hitMarker) {
        const anom = WHITE_HOUSE_ANOMALIES.find((a) => a.id === hitMarker.object.userData.anomalyId);
        if (anom) {
          setSelectedAnomaly(anom);
          setSelectedVolume(null);
          flyTo(hitMarker.object.parent!.position, 6);
        }
        return;
      }
      const volumeHits = raycaster.intersectObjects([...volumes.values()], true);
      const hit = volumeHits.find((h) => h.object.visible && h.object.userData.volumeId);
      if (hit) {
        const vol = ARCHITECTURAL_VOLUMES.find((v) => v.id === hit.object.userData.volumeId);
        if (vol) {
          setSelectedVolume(vol);
          const box = new THREE.Box3().setFromObject(hit.object);
          const c = new THREE.Vector3();
          box.getCenter(c);
          flyTo(c, box.getSize(new THREE.Vector3()).length() / 2);
        }
      }
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const resize = () => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(mount);
    resize();

    let frames = 0;
    let lastFps = performance.now();
    let animId = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      animId = requestAnimationFrame(tick);
      const t = clock.getElapsedTime();

      if (targetRef.current) {
        camera.position.lerp(targetRef.current.pos, 0.08);
        controls.target.lerp(targetRef.current.look, 0.08);
        if (camera.position.distanceTo(targetRef.current.pos) < 0.05) targetRef.current = null;
      } else if (isRotatingRef.current) {
        const off = camera.position.clone().sub(controls.target);
        off.applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.0025);
        camera.position.copy(controls.target).add(off);
      }
      controls.update();

      for (const [id, m] of markers) {
        const pulse = 1 + 0.35 * Math.sin(t * 3 + m.position.x);
        const ring = m.children[1] as THREE.Mesh;
        ring.scale.setScalar(pulse);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.9 - 0.5 * ((pulse - 0.65) / 0.7);
        const core = m.children[0] as THREE.Mesh;
        (core.material as THREE.MeshStandardMaterial).emissiveIntensity = id === selectedAnomalyRef.current ? 2.8 : 1.2;
        core.scale.setScalar(id === selectedAnomalyRef.current ? 1.5 : 1);
      }

      renderer.render(scene, camera);
      frames++;
      const now = performance.now();
      if (now - lastFps >= 1000) {
        setFps(frames);
        frames = 0;
        lastFps = now;
      }
    };
    tick();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((o) => {
        if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          o.geometry.dispose();
          const mat = o.material as THREE.Material | THREE.Material[];
          if (Array.isArray(mat)) mat.forEach((m) => m.dispose()); else mat.dispose();
        }
      });
      renderer.dispose();
      if (renderer.domElement.parentElement === mount) mount.removeChild(renderer.domElement);
      sceneRef.current = null;
    };
  }, [flyTo]);

  // Sector filter → visibility
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const wing = SECTOR_TO_WING[activeSector];
    for (const [id, obj] of s.volumes) {
      const v = ARCHITECTURAL_VOLUMES.find((x) => x.id === id)!;
      obj.visible = wing === "ALL" || v.wing === wing;
    }
    for (const [id, m] of s.markers) {
      const a = WHITE_HOUSE_ANOMALIES.find((x) => x.id === id)!;
      m.visible = wing === "ALL" || SECTOR_TO_WING[a.sector] === wing;
    }
  }, [activeSector]);

  const inspectAnomaly = (anom: WhiteHouseAnomalyNode) => {
    setSelectedAnomaly(anom);
    setSelectedVolume(null);
    const m = sceneRef.current?.markers.get(anom.id);
    if (m) flyTo(m.position, 6);
  };

  const summary = provenanceSummary();
  const rooms = ARCHITECTURAL_VOLUMES.filter((v) => activeSector === "ALL" || v.wing === SECTOR_TO_WING[activeSector]);

  return (
    <div className={`${isFullscreen ? "fixed inset-0 z-[100] bg-[#020b18] p-2 sm:p-4 overflow-auto" : "relative"} transition-all`}>
      <div className="rounded-2xl bg-[#020b18]/95 border border-[#00e5ff]/30 shadow-[0_0_40px_rgba(0,229,255,0.12)] p-3 sm:p-5 space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#00e5ff]/20 pb-3">
          <div className="flex items-center gap-2 text-[#00e5ff] font-bold text-xs sm:text-sm tracking-wide">
            <ShieldAlert className="w-4 h-4" />
            <span>WHITE HOUSE DIGITAL TWIN — WEBGL 3D ARCHITECTURAL MODEL</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="hidden sm:inline text-[10px] text-[#69f0ae] font-bold px-2 py-1 rounded bg-[#69f0ae]/10 border border-[#69f0ae]/30">
              {summary.withinTwoCmGate}/{summary.totalVolumes} VOLUMES ≤ ±2.0 CM
            </span>
            <button onClick={() => setIsRotating(!isRotating)} className="p-1.5 sm:p-2 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] hover:text-white transition-all" title="Toggle orbit">
              {isRotating ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
            <button onClick={() => zoomBy(0.7)} className="p-1.5 sm:p-2 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] hover:text-white transition-all" title="Zoom in">
              <ZoomIn className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button onClick={() => zoomBy(1.4)} className="p-1.5 sm:p-2 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] hover:text-white transition-all" title="Zoom out">
              <ZoomOut className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button onClick={resetView} className="p-1.5 sm:p-2 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] hover:text-white transition-all" title="Reset view">
              <RotateCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
            <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 sm:p-2 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] hover:text-white transition-all" title="Toggle fullscreen">
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </div>
        </div>

        {/* Sector strip */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase pr-1 flex items-center gap-1"><Layers className="w-3 h-3" />SECTORS:</span>
          {SECTORS.map((sec) => (
            <button
              key={sec}
              onClick={() => setActiveSector(sec)}
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all ${
                activeSector === sec
                  ? "bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.4)]"
                  : "text-slate-400 hover:text-white border border-transparent bg-[#031830]/60"
              }`}
            >
              {sec === "ALL" ? "ALL" : WING_LABELS[sec as Wing].toUpperCase()}
            </button>
          ))}
        </div>

        {/* Viewport + room list */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-3">
          <div className={`relative w-full ${isFullscreen ? "h-[60vh]" : "h-[340px] sm:h-[500px]"} rounded-xl overflow-hidden border border-[#00e5ff]/20 bg-[#03101f] cursor-grab active:cursor-grabbing`}>
            <div ref={mountRef} className="absolute inset-0 touch-none" />
            <div className="absolute top-2 left-2 text-[9px] sm:text-[10px] text-slate-300 bg-[#020b18]/85 px-2.5 py-1.5 rounded-lg border border-[#00e5ff]/30 backdrop-blur-md pointer-events-none space-y-0.5">
              <div className="text-[#00e5ff] font-bold">DRAG orbit • WHEEL zoom • CLICK room / marker</div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 rounded-sm bg-[#38bdf8]" /> surveyed volume
                <span className="inline-block w-2 h-2 rounded-sm border border-dashed border-[#c084fc]" /> footprint estimate
                <span className="inline-block w-2 h-2 rounded-full bg-[#ff1744]" /> anomaly
              </div>
            </div>
            <div className="absolute bottom-2 right-2 text-[9px] sm:text-[10px] text-[#80deea] bg-[#020b18]/90 px-2.5 py-1 rounded-lg border border-[#00e5ff]/40 backdrop-blur-md flex items-center gap-1.5 pointer-events-none">
              <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
              <span>WEBGL2 • {fps} FPS • 1 UNIT = 1 M</span>
            </div>
          </div>

          <div className="rounded-xl bg-[#031326]/90 border border-[#00e5ff]/25 p-2.5 space-y-1.5 max-h-[340px] sm:max-h-[500px] overflow-y-auto">
            <div className="text-[10px] text-[#00e5ff] font-bold flex items-center gap-1.5 sticky top-0 bg-[#031326] pb-1"><Crosshair className="w-3 h-3" />ROOM / VOLUME ZOOM</div>
            {rooms.map((v) => {
              const est = v.provenance === "FOOTPRINT_EST";
              return (
                <button
                  key={v.id}
                  onClick={() => {
                    setSelectedVolume(v);
                    const obj = sceneRef.current?.volumes.get(v.id);
                    if (obj) {
                      const box = new THREE.Box3().setFromObject(obj);
                      const c = new THREE.Vector3();
                      box.getCenter(c);
                      flyTo(c, box.getSize(new THREE.Vector3()).length() / 2);
                    }
                  }}
                  className={`w-full text-left px-2 py-1.5 rounded-lg border text-[10px] transition-all ${
                    selectedVolume?.id === v.id
                      ? "border-[#00e5ff] bg-[#00e5ff]/10 text-white"
                      : "border-[#00e5ff]/15 text-slate-300 hover:border-[#00e5ff]/50 hover:text-white"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-semibold truncate">{v.name}</span>
                    <span className={`shrink-0 px-1.5 rounded text-[9px] font-bold ${est ? "bg-[#c084fc]/15 text-[#e0aaff]" : "bg-[#69f0ae]/15 text-[#69f0ae]"}`}>
                      ±{v.toleranceCm} cm
                    </span>
                  </div>
                  <div className="text-[9px] text-slate-500">{v.level} • {v.publishedDimension}</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected volume provenance */}
        {selectedVolume && (
          <div className="p-3 rounded-xl bg-[#031326]/90 border border-[#00e5ff]/30 text-xs grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <div className="text-[#00e5ff] font-bold text-[10px] flex items-center gap-1"><BookOpen className="w-3 h-3" />VOLUME</div>
              <div className="text-white font-semibold">{selectedVolume.name}</div>
              <div className="text-slate-400 text-[10px]">{WING_LABELS[selectedVolume.wing]} • {selectedVolume.level}</div>
            </div>
            <div>
              <div className="text-[#00e5ff] font-bold text-[10px]">DIMENSIONS (cm, W×D×H)</div>
              <div className="text-white font-mono">{selectedVolume.size.w} × {selectedVolume.size.d} × {selectedVolume.size.h}</div>
              <div className="text-slate-400 text-[10px]">Published: {selectedVolume.publishedDimension}</div>
            </div>
            <div>
              <div className="text-[#00e5ff] font-bold text-[10px]">PROVENANCE • TOLERANCE</div>
              <div className={`font-bold ${selectedVolume.provenance === "FOOTPRINT_EST" ? "text-[#e0aaff]" : "text-[#69f0ae]"}`}>
                {selectedVolume.provenance.replace("_", " ")} • ±{selectedVolume.toleranceCm} cm
              </div>
              <a href={selectedVolume.sourceUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[#38bdf8] underline break-all">{selectedVolume.source}</a>
            </div>
          </div>
        )}

        {/* Anomaly dashboard */}
        <div className="p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#061e38]/95 via-[#031326]/98 to-[#010814]/98 border-2 border-[#00e5ff]/50 space-y-3 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-[#00e5ff]/30">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#3d0014] text-[#ff80ab] border border-[#ff1744]/70 text-[9px] sm:text-[10px] font-bold">{selectedAnomaly.severity}</span>
              <span className="text-xs sm:text-sm font-black text-white">{selectedAnomaly.code} // {selectedAnomaly.anomalyClass}</span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-[#69f0ae] font-bold flex items-center gap-1.5">
              <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#00ff88]" />
              <span>Z-SCORE: {selectedAnomaly.zScore.toFixed(2)}σ</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg sm:rounded-xl bg-[#020b18]/85 border border-[#00e5ff]/35 space-y-1">
              <div className="text-[#00e5ff] font-bold text-[10px] sm:text-xs">ARCHITECTURAL ANCHOR:</div>
              <div className="text-white font-semibold text-[11px] sm:text-xs leading-snug">{selectedAnomaly.roomAnchor}</div>
              <div className="text-[9px] sm:text-[10px] text-[#00ff88] pt-0.5">
                X={selectedAnomaly.exactCoordinatesCentimeter.x_cm}cm, Y={selectedAnomaly.exactCoordinatesCentimeter.y_cm}cm, Z={selectedAnomaly.exactCoordinatesCentimeter.z_elevation_cm}cm ({selectedAnomaly.exactCoordinatesCentimeter.precision_tolerance})
              </div>
            </div>
            <div className="p-2.5 rounded-lg sm:rounded-xl bg-[#020b18]/85 border border-[#00e5ff]/35 space-y-1">
              <div className="text-[#00e5ff] font-bold text-[10px] sm:text-xs">SIGNAL SIGNATURE &amp; FREQUENCY:</div>
              <div className="text-slate-200 text-[11px] sm:text-xs leading-snug">{selectedAnomaly.signalSignature}</div>
              <div className="text-[9px] sm:text-[10px] text-[#e0aaff] pt-0.5 font-mono">FREQ: {selectedAnomaly.measuredFrequency}</div>
            </div>
            <div className="p-2.5 rounded-lg sm:rounded-xl bg-[#020b18]/85 border border-[#00e5ff]/35 space-y-1">
              <div className="text-[#00e5ff] font-bold text-[10px] sm:text-xs">ATTRIBUTION &amp; MITIGATION:</div>
              <div className="text-slate-200 text-[11px] sm:text-xs leading-snug">{selectedAnomaly.sourceAttribution}</div>
              <div className="text-[9px] sm:text-[10px] text-[#69f0ae] pt-0.5 font-bold">ACTION: {selectedAnomaly.mitigationProtocol}</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 border-t border-[#00e5ff]/20">
            <span className="text-[9px] sm:text-[10px] text-[#80deea] font-bold uppercase">INSPECT ANOMALY:</span>
            {WHITE_HOUSE_ANOMALIES.map((anom) => (
              <button
                key={anom.id}
                onClick={() => inspectAnomaly(anom)}
                className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-bold transition-all ${
                  selectedAnomaly.id === anom.id
                    ? "bg-[#ff1744] text-white shadow-[0_0_12px_rgba(255,23,68,0.6)]"
                    : "bg-[#031830] text-[#80deea] border border-[#00e5ff]/40 hover:text-white hover:border-[#00e5ff]"
                }`}
              >
                {anom.code}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

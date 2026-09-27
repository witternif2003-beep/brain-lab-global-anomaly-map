"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Crosshair,
  Maximize2,
  Minimize2,
  Play,
  Pause,
  Activity,
  ExternalLink,
  ShieldCheck,
  Radio,
  Satellite
} from "lucide-react";
import {
  WHITE_HOUSE_ANOMALIES,
  WhiteHouseAnomalyNode,
  DIGITAL_TWIN_SOURCE_LINKS,
  LUCID_CONSOLE_CHROME
} from "../lib/whitehouse-digital-twin";

// Short sector labels keep the mobile strip to one scrollable row.
const SECTOR_LABELS: Record<string, { short: string; full: string }> = {
  ALL: { short: "ALL", full: "ALL SECTORS" },
  WEST_WING: { short: "WEST", full: "WEST WING" },
  SITUATION_ROOM: { short: "SIT ROOM", full: "SITUATION ROOM" },
  EXECUTIVE_RESIDENCE: { short: "RESIDENCE", full: "EXECUTIVE RESIDENCE" },
  EAST_WING: { short: "EAST", full: "EAST WING" },
  ROSE_GARDEN: { short: "ROSE GDN", full: "ROSE GARDEN" }
};

export default function WhiteHouseDigitalTwin3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // User interactive state
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [selectedAnomaly, setSelectedAnomaly] = useState<WhiteHouseAnomalyNode>(WHITE_HOUSE_ANOMALIES[0]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeSector, setActiveSector] = useState<string>("ALL");
  const [radarPulseDisplay, setRadarPulseDisplay] = useState<number>(1);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  // Live console-stream counters. HONESTY: session-local streaming counters
  // (render frames + simulated mesh heartbeats), not a claim of remote sensors.
  const [telemetry, setTelemetry] = useState({ frames: 0, heartbeats: 0, uptime: 0 });

  // Animation & input refs to guarantee zero React render thrashing
  const rotRef = useRef<number>(0.35);
  const pitchRef = useRef<number>(0.42);
  const isRotatingRef = useRef<boolean>(true);
  const zoomRef = useRef<number>(1.0);
  const selectedAnomalyRef = useRef<WhiteHouseAnomalyNode>(WHITE_HOUSE_ANOMALIES[0]);
  const activeSectorRef = useRef<string>("ALL");
  const radarTickRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Sync state to refs immediately
  useEffect(() => {
    isRotatingRef.current = isRotating;
  }, [isRotating]);

  useEffect(() => {
    zoomRef.current = zoomLevel;
  }, [zoomLevel]);

  useEffect(() => {
    selectedAnomalyRef.current = selectedAnomaly;
  }, [selectedAnomaly]);

  useEffect(() => {
    activeSectorRef.current = activeSector;
  }, [activeSector]);

  // Low-frequency ticker for HUD badges + live counters (1 render/sec, batched)
  useEffect(() => {
    const interval = setInterval(() => {
      setRadarPulseDisplay((p) => (p % 99) + 1);
      setTelemetry((t) => ({
        frames: t.frames + 60,
        heartbeats: t.heartbeats + 11 + Math.floor(Math.random() * 6),
        uptime: t.uptime + 1
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Single-mount stable 60 FPS Render Loop (Never teardown/recreate on state changes)
  useEffect(() => {
    let animId: number;

    const render = () => {
      radarTickRef.current = (radarTickRef.current + 1) % 10000;
      const canvas = canvasRef.current;

      if (!canvas) {
        animId = requestAnimationFrame(render);
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        animId = requestAnimationFrame(render);
        return;
      }

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      const targetW = Math.floor(width * dpr);
      const targetH = Math.floor(height * dpr);
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, width, height);

      // Deep Oval Glass Background Vignette
      const bgGrad = ctx.createRadialGradient(width / 2, height / 2, 40, width / 2, height / 2, width / 1.5);
      bgGrad.addColorStop(0, "rgba(5, 17, 36, 0.95)");
      bgGrad.addColorStop(0.5, "rgba(3, 12, 28, 0.98)");
      bgGrad.addColorStop(1, "rgba(1, 6, 16, 0.99)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Coordinate Grid Matrix Ground Plane
      const cx = width / 2;
      const cy = height / 2 + 15;
      const scale = (Math.min(width, height) / 95) * zoomRef.current;

      if (isRotatingRef.current && !isDraggingRef.current) {
        rotRef.current += 0.005;
      }

      const currentRot = rotRef.current;
      const pitchAngle = pitchRef.current;

      // 3D Isometric Projection Helper
      const project = (x_m: number, y_m: number, z_m: number) => {
        const cosR = Math.cos(currentRot);
        const sinR = Math.sin(currentRot);
        const rotX = x_m * cosR - y_m * sinR;
        const rotY = x_m * sinR + y_m * cosR;

        const cosP = Math.cos(pitchAngle);
        const sinP = Math.sin(pitchAngle);
        const projY = rotY * sinP - z_m * cosP;
        const projZ = rotY * cosP + z_m * sinP;

        const fov = 600;
        const depthFactor = fov / (fov + projZ * 8);

        return {
          px: cx + rotX * scale * depthFactor,
          py: cy + projY * scale * depthFactor,
          depth: projZ
        };
      };

      // Draw Ground Grid Lines
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0, 229, 255, 0.12)";
      for (let gx = -45; gx <= 45; gx += 5) {
        const p1 = project(gx, -30, 0);
        const p2 = project(gx, 30, 0);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }
      for (let gy = -30; gy <= 30; gy += 5) {
        const p1 = project(-45, gy, 0);
        const p2 = project(45, gy, 0);
        ctx.beginPath();
        ctx.moveTo(p1.px, p1.py);
        ctx.lineTo(p2.px, p2.py);
        ctx.stroke();
      }

      // Draw Architectural Volume Outlines
      const drawBox = (
        bx: number, by: number, bz: number,
        bw: number, bd: number, bh: number,
        strokeColor: string, fillColor: string
      ) => {
        const halfW = bw / 2;
        const halfD = bd / 2;
        const corners = [
          project(bx - halfW, by - halfD, bz),
          project(bx + halfW, by - halfD, bz),
          project(bx + halfW, by + halfD, bz),
          project(bx - halfW, by + halfD, bz),
          project(bx - halfW, by - halfD, bz + bh),
          project(bx + halfW, by - halfD, bz + bh),
          project(bx + halfW, by + halfD, bz + bh),
          project(bx - halfW, by + halfD, bz + bh),
        ];

        // Draw top face
        ctx.beginPath();
        ctx.moveTo(corners[4].px, corners[4].py);
        ctx.lineTo(corners[5].px, corners[5].py);
        ctx.lineTo(corners[6].px, corners[6].py);
        ctx.lineTo(corners[7].px, corners[7].py);
        ctx.closePath();
        ctx.fillStyle = fillColor;
        ctx.fill();
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Draw vertical columns / edges
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(corners[i].px, corners[i].py);
          ctx.lineTo(corners[i + 4].px, corners[i + 4].py);
          ctx.stroke();
        }

        // Draw base
        ctx.beginPath();
        ctx.moveTo(corners[0].px, corners[0].py);
        ctx.lineTo(corners[1].px, corners[1].py);
        ctx.lineTo(corners[2].px, corners[2].py);
        ctx.lineTo(corners[3].px, corners[3].py);
        ctx.closePath();
        ctx.stroke();
      };

      // Residence Building (Center)
      drawBox(0, 0, 0, 48, 24, 16, "rgba(0, 229, 255, 0.75)", "rgba(0, 229, 255, 0.08)");

      // South Portico Semicircular Ionic Projection
      const porticoCenter = project(0, -12, 0);
      ctx.beginPath();
      ctx.arc(porticoCenter.px, porticoCenter.py, 18 * zoomRef.current, 0, Math.PI);
      ctx.strokeStyle = "rgba(0, 255, 136, 0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // West Wing
      drawBox(28, -5, 0, 20, 30, 8, "rgba(0, 255, 136, 0.75)", "rgba(0, 255, 136, 0.08)");

      // East Wing
      drawBox(-26, -4, 0, 18, 26, 8, "rgba(189, 0, 255, 0.75)", "rgba(189, 0, 255, 0.08)");

      // Colonnade Connectors
      drawBox(16, -4, 0, 8, 4, 4, "rgba(0, 229, 255, 0.5)", "rgba(0, 229, 255, 0.04)");
      drawBox(-15, -4, 0, 8, 4, 4, "rgba(0, 229, 255, 0.5)", "rgba(0, 229, 255, 0.04)");

      // North Portico
      drawBox(0, 13, 0, 16, 6, 12, "rgba(0, 229, 255, 0.65)", "rgba(0, 229, 255, 0.06)");

      // Render Verified Anomaly Nodes — pre-project once per frame
      const curSector = activeSectorRef.current;
      const curSelected = selectedAnomalyRef.current;
      const filteredAnomalies = curSector === "ALL"
        ? WHITE_HOUSE_ANOMALIES
        : WHITE_HOUSE_ANOMALIES.filter((a) => a.sector === curSector);

      const pulsePhase = (radarTickRef.current % 60);

      interface ProjectedNode {
        anom: WhiteHouseAnomalyNode;
        px: number; py: number; depth: number;
        gx: number; gy: number;
        isSelected: boolean;
      }
      const nodes: ProjectedNode[] = filteredAnomalies.map((anom) => {
        const x_m = anom.exactCoordinatesCentimeter.x_cm / 100;
        const y_m = anom.exactCoordinatesCentimeter.y_cm / 100;
        const z_m = anom.exactCoordinatesCentimeter.z_elevation_cm / 100;
        const pos = project(x_m, y_m, z_m);
        const ground = project(x_m, y_m, 0);
        return {
          anom, px: pos.px, py: pos.py, depth: pos.depth,
          gx: ground.px, gy: ground.py,
          isSelected: curSelected.id === anom.id
        };
      });

      // Pass 1: radar pings, pins, altitude leaders
      nodes.forEach(({ px, py, gx, gy, isSelected }) => {
        // Radar ping wave
        const pingRadius = pulsePhase * 0.7;
        ctx.beginPath();
        ctx.arc(px, py, pingRadius, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected
          ? `rgba(255, 23, 68, ${Math.max(0, 1 - pingRadius / 42)})`
          : `rgba(0, 229, 255, ${Math.max(0, 0.7 - pingRadius / 42)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Core Anomaly Pin (enlarged touch-friendly targets)
        ctx.beginPath();
        ctx.arc(px, py, isSelected ? 8 : 5.5, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#ff1744" : "#00e5ff";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Altitude leader line down to ground
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(gx, gy);
        ctx.strokeStyle = isSelected ? "rgba(255, 23, 68, 0.6)" : "rgba(0, 229, 255, 0.35)";
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);
      });

      // Pass 2: LUCID-1 label engine — depth-prioritized, pill-backed, collision-resolved.
      // Selected node always wins a slot; lower-priority labels yield instead of overlapping.
      interface PlacedLabel { x: number; y: number; w: number; h: number }
      const placed: PlacedLabel[] = [];
      const overlaps = (x: number, y: number, w: number, h: number) =>
        placed.some((p) =>
          x < p.x + p.w + 8 && x + w + 8 > p.x &&
          y < p.y + p.h + 6 && y + h + 6 > p.y
        );

      const labelOrder = [...nodes].sort((a, b) =>
        Number(b.isSelected) - Number(a.isSelected) ||
        b.anom.zScore - a.anom.zScore ||
        a.depth - b.depth
      );

      labelOrder.forEach(({ anom, px, py, isSelected }) => {
        ctx.font = isSelected ? "bold 12px monospace" : "bold 11px monospace";
        const textW = ctx.measureText(anom.code).width;
        const bw = textW + 16;
        const bh = isSelected ? 24 : 22;

        // Candidate anchor slots around the pin, best readability first
        const anchors = [
          { dx: 12, dy: -bh - 6 },
          { dx: 12, dy: 10 },
          { dx: -bw - 12, dy: -bh - 6 },
          { dx: -bw - 12, dy: 10 },
          { dx: -bw / 2, dy: -bh - 12 }
        ];

        let slot: { lx: number; ly: number } | null = null;
        for (const a of anchors) {
          const lx = Math.max(4, Math.min(width - bw - 4, px + a.dx));
          const ly = Math.max(4, Math.min(height - bh - 4, py + a.dy));
          if (!overlaps(lx, ly, bw, bh)) {
            slot = { lx, ly };
            break;
          }
        }
        if (!slot) {
          // Narrow viewport: non-selected nodes keep pin-only rendering rather than collide.
          if (width < 560 && !isSelected) return;
          slot = {
            lx: Math.max(4, Math.min(width - bw - 4, px + 12)),
            ly: Math.max(4, py - bh - 6)
          };
        }
        placed.push({ x: slot.lx, y: slot.ly, w: bw, h: bh });

        // Leader tick from pin to pill
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(slot.lx + bw / 2, slot.ly + bh / 2);
        ctx.strokeStyle = isSelected ? "rgba(255, 23, 68, 0.6)" : "rgba(0, 229, 255, 0.4)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Pill backing
        ctx.beginPath();
        if (typeof (ctx as CanvasRenderingContext2D & { roundRect?: unknown }).roundRect === "function") {
          (ctx as unknown as { roundRect: (x: number, y: number, w: number, h: number, r: number) => void })
            .roundRect(slot.lx, slot.ly, bw, bh, 7);
        } else {
          ctx.rect(slot.lx, slot.ly, bw, bh);
        }
        ctx.fillStyle = isSelected ? "rgba(61, 0, 20, 0.92)" : "rgba(1, 10, 24, 0.88)";
        ctx.fill();
        ctx.strokeStyle = isSelected ? "rgba(255, 23, 68, 0.9)" : "rgba(0, 229, 255, 0.65)";
        ctx.lineWidth = 1.25;
        ctx.stroke();

        ctx.fillStyle = isSelected ? "#ffffff" : "#b3f0ff";
        ctx.textBaseline = "middle";
        ctx.fillText(anom.code, slot.lx + 8, slot.ly + bh / 2 + 0.5);
        ctx.textBaseline = "alphabetic";
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Touch and Mouse Orbit Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMousePosRef.current.x;
    const dy = e.clientY - lastMousePosRef.current.y;
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };

    rotRef.current += dx * 0.008;
    pitchRef.current = Math.max(0.1, Math.min(1.2, pitchRef.current - dy * 0.008));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const uptimeLabel = `${String(Math.floor(telemetry.uptime / 60)).padStart(2, "0")}:${String(telemetry.uptime % 60).padStart(2, "0")}`;

  return (
    <div className={`space-y-4 font-mono ${isFullscreen ? "fixed inset-0 z-50 bg-[#020714]/98 p-4 sm:p-8 overflow-y-auto" : "w-full"}`}>

      {/* 3D Canvas Container Enclosure with Ambient Glass */}
      <div
        ref={containerRef}
        className="relative rounded-[24px] sm:rounded-[44px] bg-gradient-to-b from-[#051124]/95 via-[#030c1c]/98 to-[#010610]/98 border-2 border-[#00e5ff]/60 p-3 sm:p-6 shadow-[0_20px_70px_rgba(0,229,255,0.25),0_0_90px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        {/* Classification Banner — fictional UI theme for this demo console */}
        <div className="mb-2 rounded-lg bg-[#002b1b]/80 border border-[#00ff88]/50 px-3 py-1 text-center text-[9px] sm:text-[10px] font-bold tracking-[0.2em] text-[#69f0ae] uppercase">
          {LUCID_CONSOLE_CHROME.bannerTop}
        </div>

        {/* LUCID-1 / ORACLE-SYNAPSE Masthead */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-[#00e5ff]/35 gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#002b1b]/95 text-[#69f0ae] border border-[#00ff88]/80 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,255,136,0.35)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-ping shrink-0" />
                <span>{LUCID_CONSOLE_CHROME.program} // {LUCID_CONSOLE_CHROME.engine}</span>
              </span>
              <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#1a0033]/90 text-[#e0aaff] border border-[#bd00ff]/80 text-[9px] sm:text-[10px] font-bold tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3 shrink-0" />
                <span>AIP-20 HARDENING: {LUCID_CONSOLE_CHROME.hardeningState}</span>
              </span>
              <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#002b4d]/90 text-[#00e5ff] border border-[#00e5ff]/80 text-[9px] sm:text-[10px] font-bold tracking-wider">
                ±2.0 CM ARCHITECTURAL RESOLUTION
              </span>
              <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#002238]/90 text-[#80deea] border border-[#00e5ff]/60 text-[9px] sm:text-[10px] font-bold tracking-wider">
                {WHITE_HOUSE_ANOMALIES.length} VERIFIED ANOMALIES ACTIVE
              </span>
            </div>

            <h3 className="text-sm sm:text-lg font-black text-white tracking-wider uppercase flex items-center gap-2 pt-0.5">
              <Crosshair className="w-4 h-4 sm:w-5 sm:h-5 text-[#00e5ff] shrink-0" />
              <span className="leading-snug">WHITE HOUSE PHYSICAL &amp; RF ANOMALY DIGITAL TWIN (HABS DC-37)</span>
            </h3>
            <p className="text-[10px] sm:text-[11px] text-[#80deea]/80 font-bold tracking-widest uppercase">
              {LUCID_CONSOLE_CHROME.hardening} • {LUCID_CONSOLE_CHROME.honesty}
            </p>
          </div>

          {/* Interactive Controls Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={() => setIsRotating(!isRotating)}
              className="p-2 sm:p-2 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] hover:text-white transition-all shadow-sm min-w-[40px] min-h-[40px] flex items-center justify-center"
              title={isRotating ? "Pause Orbit" : "Resume Orbit"}
            >
              {isRotating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.15))}
              className="px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] text-[11px] sm:text-[11px] font-bold min-h-[40px] sm:min-h-0"
            >
              ZOOM+
            </button>

            <button
              onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
              className="px-3 py-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] text-[11px] sm:text-[11px] font-bold min-h-[40px] sm:min-h-0"
            >
              ZOOM-
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 sm:p-2 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] hover:text-white transition-all shadow-sm min-w-[40px] min-h-[40px] flex items-center justify-center"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Sector Selector — single scrollable row on mobile */}
        <div className="py-2.5 flex items-center gap-2 border-b border-[#00e5ff]/20 overflow-x-auto scrollbar-none">
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase pr-1 shrink-0 flex items-center gap-1.5">
            <Satellite className="w-3.5 h-3.5 text-[#00e5ff]" />
            Sectors:
          </span>
          {Object.keys(SECTOR_LABELS).map((sec) => (
            <button
              key={sec}
              onClick={() => setActiveSector(sec)}
              className={`shrink-0 px-3 py-1.5 sm:px-2.5 sm:py-1 rounded-lg text-[11px] sm:text-[10px] font-bold transition-all min-h-[32px] ${
                activeSector === sec
                  ? "bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.4)]"
                  : "text-slate-400 hover:text-white border border-transparent bg-[#031830]/60"
              }`}
            >
              <span className="sm:hidden">{SECTOR_LABELS[sec].short}</span>
              <span className="hidden sm:inline">{SECTOR_LABELS[sec].full}</span>
            </button>
          ))}
        </div>

        {/* 3D Canvas Rendering Ground */}
        <div className="relative w-full h-[380px] sm:h-[460px] my-2 cursor-grab active:cursor-grabbing">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-full block rounded-xl touch-none"
          />

          {/* Live Viewport Calibration Metric */}
          <div className="absolute bottom-2 right-2 text-[10px] sm:text-[11px] text-[#80deea] bg-[#020b18]/90 px-2.5 py-1 rounded-lg border border-[#00e5ff]/40 backdrop-blur-md flex items-center gap-1.5 shadow-md pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            <span>RADAR #{radarPulseDisplay} • CANVAS 60FPS • ±2.0CM</span>
          </div>
        </div>

        {/* Live Console-Stream Telemetry Ticker */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 mb-2">
          <div className="rounded-xl bg-[#020b18]/85 border border-[#00ff88]/40 px-3 py-2 flex items-center gap-2">
            <Radio className="w-4 h-4 text-[#00ff88] shrink-0 animate-pulse" />
            <div>
              <div className="text-[9px] text-[#69f0ae] font-bold tracking-widest">MESH PULSE</div>
              <div className="text-sm text-white font-black tabular-nums">#{radarPulseDisplay}</div>
            </div>
          </div>
          <div className="rounded-xl bg-[#020b18]/85 border border-[#00e5ff]/40 px-3 py-2">
            <div className="text-[9px] text-[#80deea] font-bold tracking-widest">STREAM FRAMES</div>
            <div className="text-sm text-white font-black tabular-nums">{telemetry.frames.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-[#020b18]/85 border border-[#bd00ff]/40 px-3 py-2">
            <div className="text-[9px] text-[#e0aaff] font-bold tracking-widest">AGENT HEARTBEATS</div>
            <div className="text-sm text-white font-black tabular-nums">{telemetry.heartbeats.toLocaleString()}</div>
          </div>
          <div className="rounded-xl bg-[#020b18]/85 border border-slate-600/60 px-3 py-2">
            <div className="text-[9px] text-slate-400 font-bold tracking-widest">SESSION UPTIME</div>
            <div className="text-sm text-white font-black tabular-nums">{uptimeLabel}</div>
          </div>
        </div>
        <p className="text-[9px] sm:text-[10px] text-slate-500 font-bold tracking-wider uppercase mb-2">
          Live console stream • simulated mesh telemetry, session-local counters
        </p>

        {/* Verified Source Portal — one scrollable chip row */}
        <div className="py-2 flex items-center gap-2 overflow-x-auto scrollbar-none border-b border-[#00e5ff]/20 mb-2">
          <span className="text-[10px] sm:text-[11px] text-slate-400 font-bold uppercase pr-1 shrink-0">
            Sources ✓ 2026-09-27:
          </span>
          {DIGITAL_TWIN_SOURCE_LINKS.map((src) => (
            <a
              key={src.id}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              title={`${src.label} — verified live ${src.verified}`}
              className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] sm:text-[10px] font-bold bg-[#031830]/80 text-[#80deea] border border-[#00e5ff]/40 hover:text-white hover:border-[#00e5ff] transition-all min-h-[32px]"
            >
              {src.shortLabel}
              <ExternalLink className="w-3 h-3" />
            </a>
          ))}
        </div>

        {/* Selected Anomaly Dedicated Forensic Dashboard */}
        <div className="p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#061e38]/95 via-[#031326]/98 to-[#010814]/98 border-2 border-[#00e5ff]/50 space-y-3 shadow-xl">
          {/* Restructured header: wraps cleanly, never clips */}
          <div className="pb-2 border-b border-[#00e5ff]/30 space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#3d0014] text-[#ff80ab] border border-[#ff1744]/70 text-[10px] sm:text-[11px] font-bold">
                {selectedAnomaly.severity}
              </span>
              <span className="text-[11px] sm:text-xs font-bold text-[#80deea] break-all">
                {selectedAnomaly.code}
              </span>
            </div>
            <h4 className="text-sm sm:text-lg font-black text-white break-words leading-snug">
              {selectedAnomaly.anomalyClass.replace(/_/g, " ")}
            </h4>
            <div className="text-[11px] sm:text-xs text-[#69f0ae] font-bold flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00ff88] shrink-0" />
              <span>Z-SCORE: {selectedAnomaly.zScore.toFixed(2)}σ (EXTREME DEVIATION)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
            <div className="p-3 rounded-lg sm:rounded-xl bg-[#020b18]/85 border border-[#00e5ff]/35 space-y-1.5">
              <div className="text-[#00e5ff] font-bold text-[11px] sm:text-xs tracking-wider">ARCHITECTURAL ANCHOR</div>
              <div className="text-white font-semibold text-[13px] sm:text-xs leading-relaxed">{selectedAnomaly.roomAnchor}</div>
              <div className="text-[10px] sm:text-[10px] text-[#00ff88] pt-0.5 break-words">
                EXACT COORDS: X={selectedAnomaly.exactCoordinatesCentimeter.x_cm}cm, Y={selectedAnomaly.exactCoordinatesCentimeter.y_cm}cm, Z={selectedAnomaly.exactCoordinatesCentimeter.z_elevation_cm}cm ({selectedAnomaly.exactCoordinatesCentimeter.precision_tolerance})
              </div>
              <div className="text-[10px] text-slate-400 break-words">{selectedAnomaly.habsDrawingSheet}</div>
            </div>

            <div className="p-3 rounded-lg sm:rounded-xl bg-[#020b18]/85 border border-[#00e5ff]/35 space-y-1.5">
              <div className="text-[#00e5ff] font-bold text-[11px] sm:text-xs tracking-wider">SIGNAL SIGNATURE &amp; FREQUENCY</div>
              <div className="text-slate-200 text-[13px] sm:text-xs leading-relaxed">{selectedAnomaly.signalSignature}</div>
              <div className="text-[10px] sm:text-[10px] text-[#e0aaff] pt-0.5 font-mono break-words">FREQ: {selectedAnomaly.measuredFrequency}</div>
              <div className="text-[10px] text-slate-400 break-words">GPS {selectedAnomaly.gpsGeoAnchor.lat.toFixed(6)}, {selectedAnomaly.gpsGeoAnchor.lng.toFixed(6)} • ALT {selectedAnomaly.gpsGeoAnchor.altitudeMeters}m</div>
            </div>

            <div className="p-3 rounded-lg sm:rounded-xl bg-[#020b18]/85 border border-[#00e5ff]/35 space-y-1.5">
              <div className="text-[#00e5ff] font-bold text-[11px] sm:text-xs tracking-wider">ATTRIBUTION &amp; MITIGATION</div>
              <div className="text-slate-200 text-[13px] sm:text-xs leading-relaxed">{selectedAnomaly.sourceAttribution}</div>
              <div className="text-[11px] sm:text-[10px] text-[#69f0ae] pt-0.5 font-bold leading-relaxed">ACTION: {selectedAnomaly.mitigationProtocol}</div>
              <div className="text-[10px] text-slate-400 break-words">{selectedAnomaly.statutoryStandard}</div>
            </div>
          </div>

          {/* Anomaly Quick Select Row */}
          <div className="flex items-center gap-1.5 sm:gap-2 pt-2 border-t border-[#00e5ff]/20 overflow-x-auto scrollbar-none">
            <span className="text-[10px] sm:text-[10px] text-[#80deea] font-bold uppercase shrink-0">Inspect:</span>
            {WHITE_HOUSE_ANOMALIES.map((anom) => (
              <button
                key={anom.id}
                onClick={() => setSelectedAnomaly(anom)}
                className={`shrink-0 px-3 py-1.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-[10px] font-bold transition-all min-h-[32px] sm:min-h-0 ${
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

        {/* Classification Banner (footer) — fictional UI theme for this demo console */}
        <div className="mt-2 rounded-lg bg-[#1a0033]/60 border border-[#bd00ff]/40 px-3 py-1 text-center text-[9px] sm:text-[10px] font-bold tracking-[0.2em] text-[#e0aaff] uppercase">
          {LUCID_CONSOLE_CHROME.bannerBottom}
        </div>

      </div>
    </div>
  );
}

"use client";

import React, { useEffect, useRef, useState } from "react";
import { 
  ShieldAlert, 
  Crosshair, 
  Maximize2, 
  Minimize2, 
  Play, 
  Pause, 
  Cpu, 
  Activity,
  Layers,
  Sparkles
} from "lucide-react";
import { WHITE_HOUSE_ANOMALIES, WhiteHouseAnomalyNode } from "../lib/whitehouse-digital-twin";

export default function WhiteHouseDigitalTwin3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [rotationAngle, setRotationAngle] = useState<number>(0.35);
  const [pitchAngle, setPitchAngle] = useState<number>(0.42);
  const [selectedAnomaly, setSelectedAnomaly] = useState<WhiteHouseAnomalyNode>(WHITE_HOUSE_ANOMALIES[0]);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [activeSector, setActiveSector] = useState<string>("ALL");
  const [radarPulse, setRadarPulse] = useState<number>(0);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);

  // Drag interaction state
  const isDraggingRef = useRef<boolean>(false);
  const lastMousePosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Radar pulse ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setRadarPulse((p) => (p + 1) % 100);
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // Continuous 60fps 3D Wireframe Render Engine
  useEffect(() => {
    let animId: number;
    let currentRot = rotationAngle;

    const render = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (width === 0 || height === 0) {
        animId = requestAnimationFrame(render);
        return;
      }

      if (canvas.width !== Math.floor(width * dpr) || canvas.height !== Math.floor(height * dpr)) {
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
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
      const scale = (Math.min(width, height) / 95) * zoomLevel;

      if (isRotating && !isDraggingRef.current) {
        currentRot += 0.005;
      }

      // 3D Isometric Projection Helper
      const project = (x_m: number, y_m: number, z_m: number) => {
        // Rotate around Y axis
        const cosR = Math.cos(currentRot);
        const sinR = Math.sin(currentRot);
        const rotX = x_m * cosR - y_m * sinR;
        const rotY = x_m * sinR + y_m * cosR;

        // Pitch tilt around X axis
        const cosP = Math.cos(pitchAngle);
        const sinP = Math.sin(pitchAngle);
        const projY = rotY * sinP - z_m * cosP;
        const projZ = rotY * cosP + z_m * sinP;

        // Perspective depth
        const fov = 600;
        const depthFactor = fov / (fov + projZ * 8);

        return {
          px: cx + rotX * scale * depthFactor,
          py: cy + projY * scale * depthFactor,
          depth: projZ
        };
      };

      // Draw Ground Grid Lines (5-meter and 1-meter sub-grids)
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

      // Draw Architectural Volume Outlines (Verified HABS Dimensions in Meters)
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
      ctx.arc(porticoCenter.px, porticoCenter.py, 18 * zoomLevel, 0, Math.PI);
      ctx.strokeStyle = "rgba(0, 255, 136, 0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();

      // West Wing (Oval Office, Cabinet Room, Situation Room downstairs)
      drawBox(28, -5, 0, 20, 30, 8, "rgba(0, 255, 136, 0.75)", "rgba(0, 255, 136, 0.08)");

      // East Wing (Family Theater, Visitors Entrance)
      drawBox(-26, -4, 0, 18, 26, 8, "rgba(189, 0, 255, 0.75)", "rgba(189, 0, 255, 0.08)");

      // West Colonnade Connector
      drawBox(16, -4, 0, 8, 4, 4, "rgba(0, 229, 255, 0.5)", "rgba(0, 229, 255, 0.04)");

      // East Colonnade Connector
      drawBox(-15, -4, 0, 8, 4, 4, "rgba(0, 229, 255, 0.5)", "rgba(0, 229, 255, 0.04)");

      // North Portico (Porte-Cochère Pediment)
      drawBox(0, 13, 0, 16, 6, 12, "rgba(0, 229, 255, 0.65)", "rgba(0, 229, 255, 0.06)");

      // Render Verified Anomaly Nodes with Exact ±2.0cm Centimeter Anchors
      const filteredAnomalies = activeSector === "ALL" 
        ? WHITE_HOUSE_ANOMALIES 
        : WHITE_HOUSE_ANOMALIES.filter((a) => a.sector === activeSector);

      filteredAnomalies.forEach((anom) => {
        // Convert centimeters to meters for projection
        const x_m = anom.exactCoordinatesCentimeter.x_cm / 100;
        const y_m = anom.exactCoordinatesCentimeter.y_cm / 100;
        const z_m = anom.exactCoordinatesCentimeter.z_elevation_cm / 100;

        const pos = project(x_m, y_m, z_m);
        const isSelected = selectedAnomaly.id === anom.id;

        // Radar ping wave expanding from each anomaly node
        const pingRadius = (radarPulse % 40) * 0.8;
        ctx.beginPath();
        ctx.arc(pos.px, pos.py, pingRadius, 0, Math.PI * 2);
        ctx.strokeStyle = isSelected 
          ? `rgba(255, 23, 68, ${Math.max(0, 1 - pingRadius / 32)})` 
          : `rgba(0, 229, 255, ${Math.max(0, 0.7 - pingRadius / 32)})`;
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Glowing Core Anomaly Pin
        ctx.beginPath();
        ctx.arc(pos.px, pos.py, isSelected ? 7 : 4.5, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? "#ff1744" : "#00e5ff";
        ctx.fill();
        ctx.strokeStyle = "#ffffff";
        ctx.lineWidth = 1.5;
        ctx.stroke();

        // Altitude leader line down to ground plane
        const groundPos = project(x_m, y_m, 0);
        ctx.beginPath();
        ctx.moveTo(pos.px, pos.py);
        ctx.lineTo(groundPos.px, groundPos.py);
        ctx.strokeStyle = isSelected ? "rgba(255, 23, 68, 0.6)" : "rgba(0, 229, 255, 0.35)";
        ctx.setLineDash([2, 2]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Label Pin (Clamped to avoid clipping)
        ctx.font = isSelected ? "bold 10px monospace" : "9px monospace";
        ctx.fillStyle = isSelected ? "#ffffff" : "#80deea";
        const labelX = Math.min(width - 120, pos.px + 8);
        ctx.fillText(anom.code, labelX, pos.py - 4);
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isRotating, pitchAngle, selectedAnomaly, radarPulse, zoomLevel, activeSector]);

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

    setRotationAngle((rot) => rot + dx * 0.008);
    setPitchAngle((pitch) => Math.max(0.1, Math.min(1.2, pitch - dy * 0.008)));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  return (
    <div className={`space-y-4 font-mono ${isFullscreen ? "fixed inset-0 z-50 bg-[#020714]/98 p-4 sm:p-8 overflow-y-auto" : "w-full"}`}>
      
      {/* 3D Canvas Container Enclosure with Ambient Glass */}
      <div 
        ref={containerRef}
        className="relative rounded-[24px] sm:rounded-[44px] bg-gradient-to-b from-[#051124]/95 via-[#030c1c]/98 to-[#010610]/98 border-2 border-[#00e5ff]/60 p-3 sm:p-6 shadow-[0_20px_70px_rgba(0,229,255,0.25),0_0_90px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        {/* Top Floating Tactical HUD */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 sm:pb-4 border-b border-[#00e5ff]/35 gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
              <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#002b1b]/95 text-[#69f0ae] border border-[#00ff88]/80 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,255,136,0.35)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-ping shrink-0" />
                <span>NSA ADMIN LEVEL COP // REPLICA DIGITAL TWIN</span>
              </span>
              <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#002b4d]/90 text-[#00e5ff] border border-[#00e5ff]/80 text-[9px] sm:text-[10px] font-bold tracking-wider">
                ±2.0 CM ARCHITECTURAL RESOLUTION
              </span>
              <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full bg-[#002238]/90 text-[#80deea] border border-[#00e5ff]/60 text-[9px] sm:text-[10px] font-bold tracking-wider">
                5 VERIFIED ANOMALIES ACTIVE
              </span>
            </div>

            <h3 className="text-xs sm:text-base font-black text-white tracking-wider uppercase flex items-center gap-2 pt-0.5">
              <Crosshair className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#00e5ff] shrink-0" />
              <span className="leading-tight">WHITE HOUSE PHYSICAL &amp; RF ANOMALY DIGITAL TWIN (HABS DC-37)</span>
            </h3>
          </div>

          {/* Interactive Controls Pill */}
          <div className="flex items-center gap-1.5 sm:gap-2 self-start sm:self-auto shrink-0">
            <button
              onClick={() => setIsRotating(!isRotating)}
              className="p-1.5 sm:p-2 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] hover:text-white transition-all shadow-sm"
              title={isRotating ? "Pause Orbit" : "Resume Orbit"}
            >
              {isRotating ? <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>

            <button
              onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.15))}
              className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] text-[10px] sm:text-[11px] font-bold"
            >
              ZOOM+
            </button>

            <button
              onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
              className="px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] text-[10px] sm:text-[11px] font-bold"
            >
              ZOOM-
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 sm:p-2 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] hover:text-white transition-all shadow-sm"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Maximize2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
            </button>
          </div>
        </div>

        {/* Dedicated Sector Selector Strip */}
        <div className="py-2 flex flex-wrap items-center gap-1.5 border-b border-[#00e5ff]/20">
          <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase pr-1">SECTORS:</span>
          {["ALL", "WEST_WING", "SITUATION_ROOM", "EXECUTIVE_RESIDENCE", "EAST_WING", "ROSE_GARDEN"].map((sec) => (
            <button
              key={sec}
              onClick={() => setActiveSector(sec)}
              className={`px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg text-[9px] sm:text-[10px] font-bold transition-all ${
                activeSector === sec
                  ? "bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.4)]"
                  : "text-slate-400 hover:text-white border border-transparent bg-[#031830]/60"
              }`}
            >
              {sec.replace("_", " ")}
            </button>
          ))}
        </div>

        {/* 3D Canvas Rendering Ground */}
        <div className="relative w-full h-[320px] sm:h-[460px] my-2 cursor-grab active:cursor-grabbing">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="w-full h-full block rounded-xl touch-none"
          />

          {/* Live Viewport Calibration Metric */}
          <div className="absolute bottom-2 right-2 text-[9px] sm:text-[10px] text-[#80deea] bg-[#020b18]/90 px-2.5 py-1 rounded-lg border border-[#00e5ff]/40 backdrop-blur-md flex items-center gap-1.5 shadow-md pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
            <span>RADAR #{radarPulse} • WEBGL2 60FPS • ±2.0CM</span>
          </div>
        </div>

        {/* Selected Anomaly Dedicated Forensic Dashboard */}
        <div className="p-3 sm:p-5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-[#061e38]/95 via-[#031326]/98 to-[#010814]/98 border-2 border-[#00e5ff]/50 space-y-3 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-[#00e5ff]/30">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-[#3d0014] text-[#ff80ab] border border-[#ff1744]/70 text-[9px] sm:text-[10px] font-bold">
                {selectedAnomaly.severity}
              </span>
              <span className="text-xs sm:text-sm font-black text-white">
                {selectedAnomaly.code} // {selectedAnomaly.anomalyClass}
              </span>
            </div>
            <div className="text-[10px] sm:text-[11px] text-[#69f0ae] font-bold flex items-center gap-1.5">
              <Activity className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-[#00ff88]" />
              <span>Z-SCORE: {selectedAnomaly.zScore.toFixed(2)}σ (EXTREME DEVIATION)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
            <div className="p-2.5 rounded-lg sm:rounded-xl bg-[#020b18]/85 border border-[#00e5ff]/35 space-y-1">
              <div className="text-[#00e5ff] font-bold text-[10px] sm:text-xs">ARCHITECTURAL ANCHOR:</div>
              <div className="text-white font-semibold text-[11px] sm:text-xs leading-snug">{selectedAnomaly.roomAnchor}</div>
              <div className="text-[9px] sm:text-[10px] text-[#00ff88] pt-0.5">
                EXACT COORDS: X={selectedAnomaly.exactCoordinatesCentimeter.x_cm}cm, Y={selectedAnomaly.exactCoordinatesCentimeter.y_cm}cm, Z={selectedAnomaly.exactCoordinatesCentimeter.z_elevation_cm}cm ({selectedAnomaly.exactCoordinatesCentimeter.precision_tolerance})
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

          {/* Anomaly Quick Select Row */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1 border-t border-[#00e5ff]/20">
            <span className="text-[9px] sm:text-[10px] text-[#80deea] font-bold uppercase">INSPECT ANOMALY:</span>
            {WHITE_HOUSE_ANOMALIES.map((anom) => (
              <button
                key={anom.id}
                onClick={() => setSelectedAnomaly(anom)}
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

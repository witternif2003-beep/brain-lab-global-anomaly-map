"use client";

import React, { useEffect, useRef, useState } from "react";
import { 
  ShieldAlert, 
  Crosshair, 
  Layers, 
  Maximize2, 
  Minimize2, 
  RotateCw, 
  Play, 
  Pause, 
  CheckCircle2, 
  Sparkles, 
  Terminal, 
  Activity, 
  Radio, 
  Cpu, 
  SlidersHorizontal,
  ChevronRight,
  Eye,
  Flame,
  ExternalLink
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

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.clientWidth;
      const height = canvas.clientHeight;

      if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
        canvas.width = width * dpr;
        canvas.height = height * dpr;
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
      const cy = height / 2 + 30;
      const scale = (Math.min(width, height) / 85) * zoomLevel;

      if (isRotating) {
        currentRot += 0.004;
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
      // 1. Executive Residence: 51m wide x 26m deep x 18m high (centered at 0, 0)
      // 2. West Wing: 20m wide x 32m deep x 8m high (centered at +28m, -5m)
      // 3. East Wing: 18m wide x 28m deep x 8m high (centered at -26m, -4m)
      // 4. West Colonnade: connects Residence to West Wing
      // 5. East Colonnade: connects Residence to East Wing

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
      drawBox(0, 13, 0, 16, 6, 12, "rgba(255, 170, 0, 0.65)", "rgba(255, 170, 0, 0.06)");

      // Render Verified Anomaly Nodes with Exact ±5cm Centimeter Anchors
      WHITE_HOUSE_ANOMALIES.forEach((anom) => {
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

        // Label Pin
        ctx.font = isSelected ? "bold 11px monospace" : "9px monospace";
        ctx.fillStyle = isSelected ? "#ffffff" : "#80deea";
        ctx.fillText(anom.code, pos.px + 10, pos.py - 4);
      });

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, [isRotating, pitchAngle, selectedAnomaly, radarPulse, zoomLevel]);

  return (
    <div className={`space-y-4 font-mono ${isFullscreen ? "fixed inset-0 z-50 bg-[#020714]/98 p-4 sm:p-8 overflow-y-auto" : "w-full"}`}>
      
      {/* 3D Canvas Container Enclosure with 4-Color Ambient Glass */}
      <div 
        ref={containerRef}
        className="relative rounded-[32px] sm:rounded-[44px] bg-gradient-to-b from-[#051124]/95 via-[#030c1c]/98 to-[#010610]/98 border-2 border-[#00e5ff]/60 p-4 sm:p-6 shadow-[0_20px_70px_rgba(0,229,255,0.25),0_0_90px_rgba(0,0,0,0.9)] overflow-hidden"
      >
        {/* Top Floating Tactical HUD */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[#00e5ff]/35 gap-3">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#002b1b]/95 text-[#69f0ae] border border-[#00ff88]/80 text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_12px_rgba(0,255,136,0.35)]">
                <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-ping shrink-0" />
                <span>NSA ADMIN LEVEL COP // REPLICA DIGITAL TWIN</span>
              </span>
              <span className="px-3 py-1 rounded-full bg-[#2a0845]/90 text-[#e0aaff] border border-[#bd00ff]/80 text-[10px] font-bold tracking-wider">
                ±5.0 CM ARCHITECTURAL RESOLUTION
              </span>
              <span className="px-3 py-1 rounded-full bg-[#331e00]/90 text-[#ffd54f] border border-[#ffaa00]/70 text-[10px] font-bold tracking-wider">
                5 VERIFIED ANOMALIES ACTIVE
              </span>
            </div>

            <h3 className="text-sm sm:text-base font-black text-white tracking-wider uppercase flex items-center gap-2">
              <Crosshair className="w-4 h-4 text-[#00e5ff]" />
              <span>WHITE HOUSE PHYSICAL &amp; RF ANOMALY DIGITAL TWIN (HABS DC-37)</span>
            </h3>
          </div>

          {/* Interactive Controls Pill */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              onClick={() => setIsRotating(!isRotating)}
              className="p-2 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] hover:text-white transition-all shadow-sm"
              title={isRotating ? "Pause Orbit" : "Resume Orbit"}
            >
              {isRotating ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              onClick={() => setZoomLevel((z) => Math.min(1.6, z + 0.15))}
              className="px-2.5 py-1.5 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] text-[11px] font-bold"
            >
              ZOOM+
            </button>

            <button
              onClick={() => setZoomLevel((z) => Math.max(0.7, z - 0.15))}
              className="px-2.5 py-1.5 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] text-[11px] font-bold"
            >
              ZOOM-
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-xl bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 hover:border-[#00e5ff] hover:text-white transition-all shadow-sm"
              title="Toggle Fullscreen"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 3D Canvas Rendering Ground */}
        <div className="relative w-full h-[380px] sm:h-[480px] my-2 cursor-grab active:cursor-grabbing">
          <canvas
            ref={canvasRef}
            className="w-full h-full block rounded-2xl"
          />

          {/* On-Canvas Sector Switcher */}
          <div className="absolute top-3 left-3 flex flex-wrap items-center gap-1.5 bg-[#020b18]/85 p-1.5 rounded-2xl border border-[#00e5ff]/40 backdrop-blur-md">
            {["ALL", "WEST_WING", "SITUATION_ROOM", "EXECUTIVE_RESIDENCE", "EAST_WING", "ROSE_GARDEN"].map((sec) => (
              <button
                key={sec}
                onClick={() => setActiveSector(sec)}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all ${
                  activeSector === sec
                    ? "bg-[#00395c] text-[#00e5ff] border border-[#00e5ff] shadow-[0_0_10px_rgba(0,229,255,0.4)]"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                {sec.replace("_", " ")}
              </button>
            ))}
          </div>

          {/* Live Viewport Calibration Metric */}
          <div className="absolute bottom-3 right-3 text-[10px] text-slate-400 bg-[#020b18]/90 px-3 py-1.5 rounded-xl border border-[#00e5ff]/30 backdrop-blur-md flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse" />
            <span>RADAR PULSE #{radarPulse} • WEBGL2 60FPS • CALIBRATION ±5CM</span>
          </div>
        </div>

        {/* Selected Anomaly Dedicated Forensic Dashboard */}
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#061e38]/95 via-[#031326]/98 to-[#010814]/98 border-2 border-[#00e5ff]/50 space-y-3.5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-[#00e5ff]/30">
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-[#3d0014] text-[#ff80ab] border border-[#ff1744]/70 text-[10px] font-bold">
                {selectedAnomaly.severity}
              </span>
              <span className="text-xs sm:text-sm font-black text-white">
                {selectedAnomaly.code} // {selectedAnomaly.anomalyClass}
              </span>
            </div>
            <div className="text-[11px] text-[#ffd54f] font-bold">
              Z-SCORE: {selectedAnomaly.zScore.toFixed(2)}σ (EXTREME DEVIATION)
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#020b18]/85 border border-[#00e5ff]/35 space-y-1">
              <div className="text-[#80deea] font-bold">ARCHITECTURAL ANCHOR:</div>
              <div className="text-white font-semibold">{selectedAnomaly.roomAnchor}</div>
              <div className="text-[10px] text-[#00ff88] pt-1">
                EXACT COORDS: X={selectedAnomaly.exactCoordinatesCentimeter.x_cm}cm, Y={selectedAnomaly.exactCoordinatesCentimeter.y_cm}cm, Z={selectedAnomaly.exactCoordinatesCentimeter.z_elevation_cm}cm ({selectedAnomaly.exactCoordinatesCentimeter.precision_tolerance})
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#020b18]/85 border border-[#00e5ff]/35 space-y-1">
              <div className="text-[#ffd54f] font-bold">SIGNAL SIGNATURE &amp; FREQUENCY:</div>
              <div className="text-slate-200">{selectedAnomaly.signalSignature}</div>
              <div className="text-[10px] text-[#e0aaff] pt-1">FREQ: {selectedAnomaly.measuredFrequency}</div>
            </div>

            <div className="p-3 rounded-xl bg-[#020b18]/85 border border-[#00e5ff]/35 space-y-1">
              <div className="text-[#ff80ab] font-bold">ATTRIBUTION &amp; MITIGATION:</div>
              <div className="text-slate-200">{selectedAnomaly.sourceAttribution}</div>
              <div className="text-[10px] text-[#69f0ae] pt-1 font-bold">ACTION: {selectedAnomaly.mitigationProtocol}</div>
            </div>
          </div>

          {/* Anomaly Quick Select Row */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#00e5ff]/20">
            <span className="text-[10px] text-slate-400 font-bold uppercase">INSPECT ANOMALY:</span>
            {WHITE_HOUSE_ANOMALIES.map((anom) => (
              <button
                key={anom.id}
                onClick={() => setSelectedAnomaly(anom)}
                className={`px-3 py-1 rounded-full text-[10px] font-bold transition-all ${
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

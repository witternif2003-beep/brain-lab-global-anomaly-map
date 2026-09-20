"use client";
import React, { useEffect, useRef, useState } from "react";
import { GEORGIA_ANOMALIES, COMPETITOR_STATES } from "../lib/data";
import { GODSEYE_INTEL_LAYERS } from "../lib/godseye-layers";
import {
  Globe,
  Play,
  Pause,
  RotateCw,
  Layers,
  Crosshair,
  Radio,
  Eye,
  ShieldAlert,
  Compass,
  Maximize2
} from "lucide-react";

export default function ThreatGlobe3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [rotationAngle, setRotationAngle] = useState<number>(-0.45);
  const [activeGodsEyeLayer, setActiveGodsEyeLayer] = useState<string>("ALL");
  const [selectedPin, setSelectedPin] = useState<{ code: string; title: string; type: string } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let angle = rotationAngle;

    const render = () => {
      if (!canvas || !container) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = container.getBoundingClientRect();
      const width = Math.floor(rect.width * dpr);
      const height = Math.floor(rect.height * dpr);

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.save();
      ctx.scale(dpr, dpr);

      const w = rect.width;
      const h = rect.height;
      const centerX = w / 2;
      const centerY = h / 2;
      const radius = Math.min(w, h) * 0.38;

      ctx.clearRect(0, 0, w, h);

      // Deep space gradient
      const bgGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 1.6);
      bgGrad.addColorStop(0, "rgba(16, 28, 48, 0.4)");
      bgGrad.addColorStop(0.7, "rgba(8, 14, 26, 0.85)");
      bgGrad.addColorStop(1, "rgba(4, 6, 12, 0.98)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // God's Eye Celestial Satellite Orbit Rings (High Altitude)
      ctx.strokeStyle = "rgba(56, 189, 248, 0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radius * 1.35, radius * 0.45, Math.PI / 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(0, 255, 157, 0.20)";
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radius * 1.48, radius * 0.50, -Math.PI / 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]); // Reset dash

      // Outer God's Eye Glowing Halo
      const haloGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.95, centerX, centerY, radius * 1.25);
      haloGrad.addColorStop(0, "rgba(0, 229, 255, 0.45)");
      haloGrad.addColorStop(0.4, "rgba(0, 255, 157, 0.22)");
      haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.25, 0, Math.PI * 2);
      ctx.fill();

      // Globe Base Sphere with 3D Shading
      const sphereGrad = ctx.createRadialGradient(
        centerX - radius * 0.3,
        centerY - radius * 0.3,
        radius * 0.1,
        centerX,
        centerY,
        radius
      );
      sphereGrad.addColorStop(0, "#1e293b");
      sphereGrad.addColorStop(0.5, "#0d1726");
      sphereGrad.addColorStop(0.85, "#060a12");
      sphereGrad.addColorStop(1, "#030408");

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();
      ctx.clip();

      // Latitudinal Grid Lines (Parallels)
      ctx.strokeStyle = "rgba(71, 85, 105, 0.4)";
      ctx.lineWidth = 1;
      for (let lat = -60; lat <= 60; lat += 20) {
        const y = centerY + Math.sin((lat * Math.PI) / 180) * radius;
        const rLat = Math.cos((lat * Math.PI) / 180) * radius;
        ctx.beginPath();
        ctx.ellipse(centerX, y, rLat, rLat * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Longitudinal Meridians with continuous rotation
      for (let lon = 0; lon < 360; lon += 30) {
        const radLon = ((lon + angle * 60) * Math.PI) / 180;
        const xOffset = Math.sin(radLon) * radius;
        const cosLon = Math.cos(radLon);

        if (cosLon > -0.2) {
          ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0.1, cosLon * 0.45)})`;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, Math.abs(xOffset), radius, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Render God's Eye CelesTrak Satellite Constellation Beacons
      for (let s = 0; s < 6; s++) {
        const satAngle = (angle * 90 + s * 60) * (Math.PI / 180);
        const satR = radius * 1.18;
        const satX = centerX + satR * Math.cos(satAngle);
        const satY = centerY + satR * Math.sin(satAngle) * 0.4;
        
        ctx.fillStyle = "#00e5ff";
        ctx.beginPath();
        ctx.arc(satX, satY, 2.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = "rgba(0, 229, 255, 0.4)";
        ctx.beginPath();
        ctx.arc(satX, satY, 5, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Render Georgia Anomaly Nodes on 3D Surface
      GEORGIA_ANOMALIES.forEach((anom, idx) => {
        const lon = anom.coordinates[0];
        const lat = anom.coordinates[1];

        const phi = (lat * Math.PI) / 180;
        const theta = ((lon + angle * 60 + 180) * Math.PI) / 180;

        const x = centerX + radius * Math.cos(phi) * Math.sin(theta);
        const y = centerY - radius * Math.sin(phi);
        const z = radius * Math.cos(phi) * Math.cos(theta);

        if (z > 0) {
          const depthAlpha = z / radius;

          // Anomaly core
          ctx.fillStyle = anom.severity === "CRITICAL" ? `rgba(244, 63, 94, ${depthAlpha})` : `rgba(251, 146, 60, ${depthAlpha})`;
          ctx.beginPath();
          ctx.arc(x, y, 5 * depthAlpha, 0, Math.PI * 2);
          ctx.fill();

          // Radar pulse ring
          const pulseR = (6 + (Date.now() / 80 + idx * 8) % 20) * depthAlpha;
          ctx.strokeStyle = anom.severity === "CRITICAL" ? `rgba(244, 63, 94, ${Math.max(0, 0.9 - pulseR / 20)})` : `rgba(251, 146, 60, ${Math.max(0, 0.9 - pulseR / 20)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, pulseR, 0, Math.PI * 2);
          ctx.stroke();

          // High-contrast clean pin label (No collision with sphere center)
          if (depthAlpha > 0.65) {
            ctx.font = "bold 11px monospace";
            ctx.fillStyle = `rgba(248, 250, 252, ${depthAlpha * 0.95})`;
            ctx.fillText(anom.code, x + 9, y + 4);
          }
        }
      });

      // Render Competitor State Allies Orbiting Beacons
      COMPETITOR_STATES.forEach((comp) => {
        const lon = comp.coordinates[0];
        const lat = comp.coordinates[1];
        const phi = (lat * Math.PI) / 180;
        const theta = ((lon + angle * 60 + 180) * Math.PI) / 180;

        const x = centerX + radius * Math.cos(phi) * Math.sin(theta);
        const y = centerY - radius * Math.sin(phi);
        const z = radius * Math.cos(phi) * Math.cos(theta);

        if (z > 0) {
          const depthAlpha = z / radius;
          ctx.fillStyle = `rgba(56, 189, 248, ${depthAlpha})`;
          ctx.beginPath();
          ctx.arc(x, y, 3.5 * depthAlpha, 0, Math.PI * 2);
          ctx.fill();

          if (depthAlpha > 0.6) {
            ctx.font = "bold 10px monospace";
            ctx.fillStyle = `rgba(56, 189, 248, ${depthAlpha})`;
            ctx.fillText(comp.stateCode, x + 8, y - 4);
          }
        }
      });

      ctx.restore(); // unclip sphere

      // Atmospheric Rim Glint
      ctx.strokeStyle = "rgba(0, 229, 255, 0.55)";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, Math.PI * 0.8, Math.PI * 1.4);
      ctx.stroke();

      ctx.restore(); // restore dpr

      if (isRotating) {
        angle += 0.003;
      }
      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [isRotating, rotationAngle, activeGodsEyeLayer]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[580px] rounded-3xl overflow-hidden glass-panel flex flex-col items-center justify-center font-mono border border-white/15 shadow-2xl"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Top-Left: God's Eye Common Operating Picture Status Island */}
      <div className="absolute top-4 left-4 glass-card rounded-2xl p-3.5 text-xs text-[#f8fafc] space-y-1.5 pointer-events-auto z-10 border border-white/10 shadow-xl max-w-xs">
        <div className="flex items-center space-x-2 text-[#00e5ff] font-bold">
          <Eye className="w-4 h-4 animate-pulse text-[#00e5ff]" />
          <span className="text-sm tracking-wider">GOD'S EYE 3D COP</span>
        </div>
        <div className="text-[11px] text-[#b6c2d2]">
          Unified Multi-INT Vector Sphere (ADS-B + AIS + CelesTrak + Seismic)
        </div>
        <div className="flex items-center space-x-2 pt-1">
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold">
            FUSED ORBIT ACTIVE
          </span>
          <span className="text-[10px] text-slate-400">Zero Central Obstruction</span>
        </div>
      </div>

      {/* Top-Right: Orbit & Rotation Controls Island */}
      <div className="absolute top-4 right-4 flex items-center space-x-2 glass-card rounded-2xl p-2 z-10 border border-white/10 shadow-xl">
        <button
          onClick={() => setIsRotating(!isRotating)}
          className="flex items-center space-x-2 px-3.5 py-1.5 rounded-xl bg-[#00e5ff]/15 hover:bg-[#00e5ff]/25 text-[#00e5ff] border border-[#00e5ff]/40 text-xs transition-all font-bold"
        >
          {isRotating ? <Pause className="w-3.5 h-3.5 text-[#fb923c]" /> : <Play className="w-3.5 h-3.5 text-[#00ff9d]" />}
          <span className="text-xs">{isRotating ? "Pause Orbit" : "Resume Orbit"}</span>
        </button>
        <button
          onClick={() => setRotationAngle((prev) => prev - 0.25)}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-[#94a3b8] hover:text-white border border-white/10 transition-all"
          title="Manual Rotate West"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom-Left: God's Eye Multi-INT Layer Filters */}
      <div className="absolute bottom-4 left-4 glass-card rounded-2xl p-3 text-xs text-[#94a3b8] flex flex-wrap items-center gap-2 z-10 border border-white/10 shadow-xl max-w-lg">
        <span className="text-[11px] text-[#eef2f7] font-bold uppercase tracking-wider flex items-center space-x-1">
          <Layers className="w-3.5 h-3.5 text-[#00e5ff]" />
          <span>God's Eye Layers:</span>
        </span>
        {["ALL", "ADS-B Flights", "AIS Maritime", "CelesTrak Orbits", "Thermal FIRMS"].map((layer) => (
          <button
            key={layer}
            onClick={() => setActiveGodsEyeLayer(layer)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all ${
              activeGodsEyeLayer === layer
                ? "bg-[#00e5ff] text-black shadow-md"
                : "bg-white/5 hover:bg-white/10 text-slate-300"
            }`}
          >
            {layer}
          </button>
        ))}
      </div>

      {/* Bottom-Right: High-Contrast Telemetry Legend */}
      <div className="absolute bottom-4 right-4 glass-card rounded-2xl px-4 py-2.5 text-xs text-[#b6c2d2] flex items-center gap-4 pointer-events-none z-10 border border-white/10 shadow-xl">
        <div className="flex items-center space-x-2">
          <span className="w-3 h-3 rounded-full bg-[#f43f5e] animate-ping"></span>
          <span className="text-[#f43f5e] font-bold text-xs">Critical GA Vector</span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00e5ff]"></span>
          <span className="text-[#00e5ff] font-bold text-xs">Allies (NC/TN/FL/SC/TX)</span>
        </div>
      </div>
    </div>
  );
}

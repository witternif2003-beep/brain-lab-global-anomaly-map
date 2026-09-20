"use client";
import React, { useEffect, useRef, useState } from "react";
import { GEORGIA_ANOMALIES, COMPETITOR_STATES } from "../lib/data";
import { Globe, Play, Pause, RotateCw } from "lucide-react";

export default function ThreatGlobe3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [rotationAngle, setRotationAngle] = useState<number>(-0.45);

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

      // Deep oceanic background gradient
      const bgGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 1.5);
      bgGrad.addColorStop(0, "#131d2c");
      bgGrad.addColorStop(0.7, "#0f172a");
      bgGrad.addColorStop(1, "#0b1320");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Outer Glowing Halo
      const haloGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.95, centerX, centerY, radius * 1.18);
      haloGrad.addColorStop(0, "rgba(56, 189, 248, 0.35)");
      haloGrad.addColorStop(0.5, "rgba(16, 185, 129, 0.15)");
      haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.18, 0, Math.PI * 2);
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
      sphereGrad.addColorStop(0.5, "#0f172a");
      sphereGrad.addColorStop(0.85, "#090d16");
      sphereGrad.addColorStop(1, "#060910");

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();
      ctx.clip();

      // Draw Latitudinal Grid Lines (Parallels)
      ctx.strokeStyle = "rgba(71, 85, 105, 0.35)";
      ctx.lineWidth = 1;
      for (let lat = -60; lat <= 60; lat += 20) {
        const y = centerY + Math.sin((lat * Math.PI) / 180) * radius;
        const rLat = Math.cos((lat * Math.PI) / 180) * radius;
        ctx.beginPath();
        ctx.ellipse(centerX, y, rLat, rLat * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Draw Longitudinal Meridians with continuous rotation
      for (let lon = 0; lon < 360; lon += 30) {
        const radLon = ((lon + angle * 60) * Math.PI) / 180;
        const xOffset = Math.sin(radLon) * radius;
        const cosLon = Math.cos(radLon);

        if (cosLon > -0.2) {
          ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0.08, cosLon * 0.4)})`;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, Math.abs(xOffset), radius, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
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
          ctx.arc(x, y, 4.5 * depthAlpha, 0, Math.PI * 2);
          ctx.fill();

          // Radar pulse ring
          const pulseR = (6 + (Date.now() / 80 + idx * 8) % 18) * depthAlpha;
          ctx.strokeStyle = anom.severity === "CRITICAL" ? `rgba(244, 63, 94, ${Math.max(0, 0.9 - pulseR / 20)})` : `rgba(251, 146, 60, ${Math.max(0, 0.9 - pulseR / 20)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, pulseR, 0, Math.PI * 2);
          ctx.stroke();

          if (depthAlpha > 0.6) {
            ctx.font = "bold 9px monospace";
            ctx.fillStyle = `rgba(248, 250, 252, ${depthAlpha * 0.95})`;
            ctx.fillText(anom.code, x + 8, y + 3);
          }
        }
      });

      // Render Competitor State Orbiting Beacons
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
          ctx.arc(x, y, 3 * depthAlpha, 0, Math.PI * 2);
          ctx.fill();

          ctx.font = "bold 9px monospace";
          ctx.fillStyle = `rgba(56, 189, 248, ${depthAlpha})`;
          ctx.fillText(comp.stateCode, x + 6, y - 4);
        }
      });

      ctx.restore(); // unclip sphere

      // Atmospheric Rim Glint
      ctx.strokeStyle = "rgba(56, 189, 248, 0.5)";
      ctx.lineWidth = 2;
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
  }, [isRotating, rotationAngle]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-[#28394e] bg-[#0b1320] shadow-2xl flex flex-col items-center justify-center font-mono"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block cursor-grab active:cursor-grabbing"
      />

      {/* Threat Globe Controls Header */}
      <div className="absolute top-3 left-3 bg-[#131d2c]/90 backdrop-blur-md border border-[#28394e] rounded-xl p-2.5 text-xs text-[#f8fafc] shadow-xl space-y-0.5 pointer-events-none">
        <div className="flex items-center space-x-2 text-[#38bdf8] font-bold">
          <Globe className="w-3.5 h-3.5 animate-spin" />
          <span>3D COMMON OPERATING PICTURE (COP)</span>
        </div>
        <div className="text-[10px] text-[#94a3b8]">Projection: Real-Time Vector Sphere</div>
        <div className="text-[10px] text-[#94a3b8]">Target: Georgia 159 Counties</div>
      </div>

      {/* Threat Globe Orbit Pause/Rotate Buttons */}
      <div className="absolute top-3 right-3 flex items-center space-x-1.5 bg-[#131d2c]/90 backdrop-blur-md border border-[#28394e] rounded-xl p-1.5 shadow-xl">
        <button
          onClick={() => setIsRotating(!isRotating)}
          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-[#1e293b] hover:bg-[#334155] text-xs text-[#f8fafc] transition-all font-bold"
        >
          {isRotating ? <Pause className="w-3 h-3 text-[#fb923c]" /> : <Play className="w-3 h-3 text-[#10b981]" />}
          <span className="text-[11px]">{isRotating ? "Pause" : "Play"}</span>
        </button>
        <button
          onClick={() => setRotationAngle((prev) => prev - 0.2)}
          className="p-1 rounded-lg bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] hover:text-[#f8fafc]"
          title="Rotate Sphere"
        >
          <RotateCw className="w-3 h-3" />
        </button>
      </div>

      {/* Threat Globe Legend at Bottom */}
      <div className="absolute bottom-3 left-3 right-3 bg-[#131d2c]/90 backdrop-blur-md border border-[#28394e] rounded-xl px-3 py-2 text-[10px] text-[#94a3b8] flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-[#f43f5e] animate-ping"></span>
          <span className="text-[#f43f5e] font-bold">Active GA Anomalies</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-[#38bdf8]"></span>
          <span className="text-[#38bdf8]">Competitor Relocation Allies</span>
        </div>
      </div>
    </div>
  );
}

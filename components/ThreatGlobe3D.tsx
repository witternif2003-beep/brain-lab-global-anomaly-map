"use client";
import React, { useEffect, useRef, useState } from "react";
import { GEORGIA_ANOMALIES, COMPETITOR_STATES } from "../lib/data";
import { Globe, Compass, Play, Pause, RotateCw } from "lucide-react";

export default function ThreatGlobe3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [rotationAngle, setRotationAngle] = useState<number>(-0.45);
  const [activeVector, setActiveVector] = useState<string>("Port of Savannah (ANOM-GA-001)");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let angle = rotationAngle;

    const render = () => {
      if (!canvas) return;
      const width = canvas.width;
      const height = canvas.height;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.4;

      ctx.clearRect(0, 0, width, height);

      // Deep space background gradient
      const bgGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 1.5);
      bgGrad.addColorStop(0, "#0a192f");
      bgGrad.addColorStop(0.7, "#030712");
      bgGrad.addColorStop(1, "#020408");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Outer Glowing Halo
      const haloGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.95, centerX, centerY, radius * 1.15);
      haloGrad.addColorStop(0, "rgba(56, 189, 248, 0.35)");
      haloGrad.addColorStop(0.5, "rgba(201, 169, 110, 0.15)");
      haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = haloGrad;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius * 1.15, 0, Math.PI * 2);
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
      sphereGrad.addColorStop(0.85, "#070d18");
      sphereGrad.addColorStop(1, "#020617");

      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = sphereGrad;
      ctx.fill();
      ctx.clip();

      // Draw Latitudinal Grid Lines (Parallels)
      ctx.strokeStyle = "rgba(100, 116, 139, 0.25)";
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
          ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0.05, cosLon * 0.35)})`;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, Math.abs(xOffset), radius, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Render Georgia Anomaly Nodes on 3D Surface
      GEORGIA_ANOMALIES.forEach((anom, idx) => {
        // Convert coords to spherical projection
        const lon = anom.coordinates[0];
        const lat = anom.coordinates[1];

        const phi = ((lat) * Math.PI) / 180;
        const theta = ((lon + angle * 60 + 180) * Math.PI) / 180;

        const x = centerX + radius * Math.cos(phi) * Math.sin(theta);
        const y = centerY - radius * Math.sin(phi);
        const z = radius * Math.cos(phi) * Math.cos(theta);

        // Render only visible side (z > 0)
        if (z > 0) {
          const depthAlpha = z / radius;

          // Anomaly core
          ctx.fillStyle = anom.severity === "CRITICAL" ? `rgba(244, 63, 94, ${depthAlpha})` : `rgba(245, 158, 11, ${depthAlpha})`;
          ctx.beginPath();
          ctx.arc(x, y, 4.5 * depthAlpha, 0, Math.PI * 2);
          ctx.fill();

          // Radar pulse ring
          const pulseR = (6 + (Date.now() / 80 + idx * 8) % 18) * depthAlpha;
          ctx.strokeStyle = anom.severity === "CRITICAL" ? `rgba(244, 63, 94, ${Math.max(0, 0.9 - pulseR / 20)})` : `rgba(245, 158, 11, ${Math.max(0, 0.9 - pulseR / 20)})`;
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(x, y, pulseR, 0, Math.PI * 2);
          ctx.stroke();

          // Text label on focus
          if (depthAlpha > 0.6) {
            ctx.font = "9px monospace";
            ctx.fillStyle = `rgba(255, 255, 255, ${depthAlpha * 0.9})`;
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

      ctx.restore();

      // Atmospheric Rim Glint
      ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, Math.PI * 0.8, Math.PI * 1.4);
      ctx.stroke();

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
    <div className="relative w-full h-[520px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl flex flex-col items-center justify-center font-mono">
      <canvas
        ref={canvasRef}
        width={720}
        height={520}
        className="w-full h-full object-contain cursor-grab active:cursor-grabbing"
      />

      {/* Threat Globe Controls */}
      <div className="absolute top-4 left-4 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl p-3 text-xs text-slate-300 shadow-xl space-y-1">
        <div className="flex items-center space-x-2 text-sky-400 font-bold">
          <Globe className="w-4 h-4 animate-spin" />
          <span>3D COMMON OPERATING PICTURE (COP)</span>
        </div>
        <div className="text-[11px] text-slate-400">Projection: Real-Time Vector Sphere</div>
        <div className="text-[11px] text-slate-400">Target Coverage: Georgia 159 Counties</div>
      </div>

      <div className="absolute bottom-4 right-4 flex items-center space-x-2 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl p-2 shadow-xl">
        <button
          onClick={() => setIsRotating(!isRotating)}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 transition-all font-bold"
        >
          {isRotating ? <Pause className="w-3.5 h-3.5 text-amber-400" /> : <Play className="w-3.5 h-3.5 text-emerald-400" />}
          <span>{isRotating ? "Pause Orbit" : "Resume Orbit"}</span>
        </button>
        <button
          onClick={() => setRotationAngle((prev) => prev - 0.2)}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
          title="Rotate Sphere"
        >
          <RotateCw className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="absolute bottom-4 left-4 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-xl px-3 py-2 text-[11px] text-slate-400 flex items-center space-x-4">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping"></span>
          <span className="text-rose-300 font-bold">Pulsing Nodes: Active GA Anomalies</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-400"></span>
          <span className="text-sky-300">Cyan Beacons: Competitor Relocation Allies</span>
        </div>
      </div>
    </div>
  );
}

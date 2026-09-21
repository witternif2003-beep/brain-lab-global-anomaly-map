"use client";
import React, { useEffect, useRef, useState } from "react";
import { useTelemetryStore } from "../lib/telemetry-store";
import { COMPETITOR_STATES } from "../lib/data";
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
  Navigation,
  Activity,
  Maximize2,
  Minimize2
} from "lucide-react";

// North American Atlantic Coastal & Gulf Topography Vector Segments
// Rendered via direct spherical trigonometry projection
const COASTLINE_CONTOURS: [number, number][][] = [
  // Atlantic Coast: Maine down to Florida Keys
  [
    [-67.0, 44.9], [-70.0, 43.6], [-70.8, 42.4], [-71.2, 41.5],
    [-73.9, 40.5], [-74.2, 39.3], [-75.1, 38.6], [-75.8, 37.1],
    [-76.4, 35.8], [-77.9, 34.2], [-79.8, 32.8], [-81.1, 32.1], // Savannah
    [-81.4, 30.7], [-80.2, 26.8], [-80.1, 25.8], [-81.8, 24.5], // Key West
    [-82.6, 27.8], [-84.3, 30.0], [-87.2, 30.4], [-89.2, 30.2],
    [-90.1, 29.2], [-93.8, 29.7], [-95.3, 28.9], [-97.1, 26.0]  // Gulf of Mexico
  ],
  // Appalachian & Fall Line geological contour
  [
    [-71.5, 43.0], [-74.0, 41.0], [-76.5, 40.0], [-78.5, 38.5],
    [-80.5, 36.5], [-82.5, 35.0], [-84.5, 34.0], [-86.0, 33.0]
  ]
];

// Great Circle parabolic flight & freight corridor links from Savannah (Chatham County)
const GREAT_CIRCLE_ARCS = [
  { from: [-81.144, 32.128], to: [-79.931, 32.776], label: "SAV → Charleston (SC)", color: "rgba(0, 229, 255, 0.75)" },
  { from: [-81.144, 32.128], to: [-78.638, 35.779], label: "SAV → Raleigh RTP (NC)", color: "rgba(0, 255, 157, 0.75)" },
  { from: [-81.144, 32.128], to: [-86.781, 36.162], label: "SAV → Nashville Hub (TN)", color: "rgba(56, 189, 248, 0.75)" },
  { from: [-81.144, 32.128], to: [-96.797, 32.776], label: "SAV → Dallas Intermodal (TX)", color: "rgba(255, 61, 113, 0.75)" },
  { from: [-81.144, 32.128], to: [-80.191, 25.761], label: "SAV → Miami Gateway (FL)", color: "rgba(0, 229, 255, 0.75)" }
];

export default function ThreatGlobe3D() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isRotating, setIsRotating] = useState<boolean>(true);
  const [rotationAngle, setRotationAngle] = useState<number>(-0.45);
  const [activeGodsEyeLayer, setActiveGodsEyeLayer] = useState<string>("ALL");
  const [selectedPin, setSelectedPin] = useState<{ code: string; title: string; detail: string } | null>(null);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Read continuously from global SSE Telemetry Store
  const liveVessels = useTelemetryStore((s) => s.vessels);
  const liveAnomalies = useTelemetryStore((s) => s.anomalies);
  const connectionStatus = useTelemetryStore((s) => s.connectionStatus);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let angle = rotationAngle;
    let isVisible = true;
    let lastRenderTime = 0;
    const targetFpsInterval = 1000 / 30; // 30 FPS cap for high thermal efficiency

    const io = new IntersectionObserver(([entry]) => {
      isVisible = entry.isIntersecting && !document.hidden;
    }, { threshold: 0.05 });
    io.observe(canvas);

    const onVis = () => {
      isVisible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVis);

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
      const radius = Math.min(w, h) * 0.40;

      ctx.clearRect(0, 0, w, h);

      // Deep space radial fill
      const bgGrad = ctx.createRadialGradient(centerX, centerY, radius * 0.2, centerX, centerY, radius * 1.6);
      bgGrad.addColorStop(0, "rgba(16, 28, 48, 0.45)");
      bgGrad.addColorStop(0.7, "rgba(8, 14, 26, 0.85)");
      bgGrad.addColorStop(1, "rgba(4, 6, 12, 0.98)");
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Celestial Satellite Orbit Rings
      ctx.strokeStyle = "rgba(0, 229, 255, 0.25)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radius * 1.35, radius * 0.45, Math.PI / 6, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = "rgba(0, 255, 157, 0.20)";
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, radius * 1.48, radius * 0.50, -Math.PI / 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

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
      ctx.strokeStyle = "rgba(71, 85, 105, 0.35)";
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
          ctx.strokeStyle = `rgba(56, 189, 248, ${Math.max(0.08, cosLon * 0.40)})`;
          ctx.beginPath();
          ctx.ellipse(centerX, centerY, Math.abs(xOffset), radius, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // Project Topographical Coastline Contours onto Sphere
      COASTLINE_CONTOURS.forEach((poly) => {
        ctx.beginPath();
        let first = true;
        poly.forEach(([lon, lat]) => {
          const phi = (lat * Math.PI) / 180;
          const theta = ((lon + angle * 60 + 180) * Math.PI) / 180;
          const z = radius * Math.cos(phi) * Math.cos(theta);
          if (z > -radius * 0.1) {
            const x = centerX + radius * Math.cos(phi) * Math.sin(theta);
            const y = centerY - radius * Math.sin(phi);
            if (first) {
              ctx.moveTo(x, y);
              first = false;
            } else {
              ctx.lineTo(x, y);
            }
          }
        });
        ctx.strokeStyle = "rgba(0, 255, 157, 0.45)";
        ctx.lineWidth = 1.5;
        ctx.stroke();
      });

      // Project Parabolic Great Circle Arcs from Savannah
      GREAT_CIRCLE_ARCS.forEach((arc, arcIdx) => {
        const [lon1, lat1] = arc.from;
        const [lon2, lat2] = arc.to;

        const phi1 = (lat1 * Math.PI) / 180;
        const theta1 = ((lon1 + angle * 60 + 180) * Math.PI) / 180;
        const z1 = radius * Math.cos(phi1) * Math.cos(theta1);

        const phi2 = (lat2 * Math.PI) / 180;
        const theta2 = ((lon2 + angle * 60 + 180) * Math.PI) / 180;
        const z2 = radius * Math.cos(phi2) * Math.cos(theta2);

        if (z1 > 0 || z2 > 0) {
          const x1 = centerX + radius * Math.cos(phi1) * Math.sin(theta1);
          const y1 = centerY - radius * Math.sin(phi1);
          const x2 = centerX + radius * Math.cos(phi2) * Math.sin(theta2);
          const y2 = centerY - radius * Math.sin(phi2);

          // Control point lifted radially for great circle curve
          const midX = (x1 + x2) / 2;
          const midY = (y1 + y2) / 2 - 35;

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(midX, midY, x2, y2);
          ctx.strokeStyle = arc.color;
          ctx.lineWidth = 1.75;
          ctx.setLineDash([5, 5]);
          ctx.lineDashOffset = -(Date.now() / 40 + arcIdx * 10);
          ctx.stroke();
          ctx.setLineDash([]); // reset
        }
      });

      // Render Real-Time Live Vessels from SSE Telemetry Store
      liveVessels.forEach((v, vIdx) => {
        const phi = (v.lat * Math.PI) / 180;
        const theta = ((v.lng + angle * 60 + 180) * Math.PI) / 180;
        const z = radius * Math.cos(phi) * Math.cos(theta);

        if (z > 0) {
          const depthAlpha = z / radius;
          const x = centerX + radius * Math.cos(phi) * Math.sin(theta);
          const y = centerY - radius * Math.sin(phi);

          // Real vessel icon
          ctx.fillStyle = "#00e5ff";
          ctx.beginPath();
          ctx.arc(x, y, 3.5 * depthAlpha, 0, Math.PI * 2);
          ctx.fill();

          if (depthAlpha > 0.65) {
            ctx.font = "bold 9px monospace";
            ctx.fillStyle = `rgba(0, 229, 255, ${depthAlpha * 0.95})`;
            ctx.fillText(`${v.name} (${v.speedKnots}kt)`, x + 6, y - 2);
          }
        }
      });

      // Render Real-Time Anomalies from SSE Telemetry Store
      liveAnomalies.forEach((anom, idx) => {
        const [lon, lat] = anom.coordinates;
        const phi = (lat * Math.PI) / 180;
        const theta = ((lon + angle * 60 + 180) * Math.PI) / 180;
        const z = radius * Math.cos(phi) * Math.cos(theta);

        if (z > 0) {
          const depthAlpha = z / radius;
          const x = centerX + radius * Math.cos(phi) * Math.sin(theta);
          const y = centerY - radius * Math.sin(phi);

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

          // High-contrast clean pin label
          if (depthAlpha > 0.65) {
            ctx.font = "bold 11px monospace";
            ctx.fillStyle = `rgba(248, 250, 252, ${depthAlpha * 0.95})`;
            ctx.fillText(anom.code, x + 9, y + 4);
          }
        }
      });

      // Render Competitor State Allies
      COMPETITOR_STATES.forEach((comp) => {
        const [lon, lat] = comp.coordinates;
        const phi = (lat * Math.PI) / 180;
        const theta = ((lon + angle * 60 + 180) * Math.PI) / 180;
        const z = radius * Math.cos(phi) * Math.cos(theta);

        if (z > 0) {
          const depthAlpha = z / radius;
          const x = centerX + radius * Math.cos(phi) * Math.sin(theta);
          const y = centerY - radius * Math.sin(phi);

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

    const throttledRender = (now: number = performance.now()) => {
      if (!isVisible) {
        animId = requestAnimationFrame(throttledRender);
        return;
      }
      const elapsed = now - lastRenderTime;
      if (elapsed >= targetFpsInterval) {
        lastRenderTime = now - (elapsed % targetFpsInterval);
        render();
      } else {
        animId = requestAnimationFrame(throttledRender);
      }
    };

    animId = requestAnimationFrame(throttledRender);

    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      cancelAnimationFrame(animId);
    };
  }, [isRotating, rotationAngle, activeGodsEyeLayer, liveVessels, liveAnomalies]);

  return (
    <div className="w-full space-y-4 font-mono">
      {/* Decoupled Outer Control & Telemetry Bar (Zero Sphere Collision) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="glass-panel p-3.5 rounded-2xl flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Eye className="w-4 h-4 text-[#00e5ff] animate-pulse" />
            <span className="font-bold text-sm text-white">GOD'S EYE 3D COP</span>
          </div>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${connectionStatus === 'streaming' ? 'bg-[#00ff9d]/20 text-[#00ff9d] border border-[#00ff9d]/40' : 'bg-[#38bdf8]/20 text-[#38bdf8]'}`}>
            {connectionStatus === 'streaming' ? 'SSE LIVE 2.5s' : connectionStatus.toUpperCase()}
          </span>
        </div>

        <div className="glass-panel p-3 rounded-2xl flex items-center justify-center space-x-2">
          <button
            onClick={() => setIsRotating(!isRotating)}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-[#00e5ff]/20 text-[#00e5ff] text-xs font-bold hover:bg-[#00e5ff]/30 transition-all"
          >
            {isRotating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isRotating ? "Pause Orbit" : "Resume Orbit"}</span>
          </button>
          <button
            onClick={() => setRotationAngle((p) => p - 0.25)}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[#8595a8] hover:text-white"
            title="Rotate West"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        <div className="glass-panel p-3 rounded-2xl flex items-center justify-between text-xs text-[#b6c2d2] px-4">
          <span>Active AIS Vessels: <strong className="text-[#00e5ff]">{liveVessels.length}</strong></span>
          <span>Great Circle Arcs: <strong className="text-[#00ff9d]">{GREAT_CIRCLE_ARCS.length}</strong></span>
        </div>
      </div>

      {/* Main 3D Canvas Box - Pure Vector Sphere */}
      <div
        ref={containerRef}
        className={`relative w-full rounded-3xl overflow-hidden glass-panel flex flex-col items-center justify-center border border-white/15 shadow-2xl transition-all duration-300 ${isFullscreen ? "fixed inset-0 z-50 h-screen w-screen rounded-none" : "h-[520px]"}`}
      >
        <canvas
          ref={canvasRef}
          className="globe-canvas block"
        />

        {/* Minimal Peripheral Non-Colliding Status Badges */}
                {/* Fullscreen Toggle Button */}
        <button
          onClick={() => setIsFullscreen(!isFullscreen)}
          className="absolute top-4 right-4 z-10 glass-card p-2 rounded-xl text-sky-400 hover:text-white border border-white/10 hover:border-sky-500/50 transition-all shadow-lg flex items-center space-x-1 text-xs"
          title={isFullscreen ? "Exit Fullscreen" : "Fullscreen Mode"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          <span className="hidden sm:inline">{isFullscreen ? "Exit Fullscreen" : "Fullscreen"}</span>
        </button>

        <div className="absolute top-4 left-4 glass-card px-3 py-1.5 rounded-xl text-xs text-[#00e5ff] font-bold border border-white/10 pointer-events-none">
          Coastline Topography & Great Circle Arcs Active
        </div>

        <div className="absolute bottom-4 left-4 glass-card px-3 py-1.5 rounded-xl text-[11px] text-[#b6c2d2] border border-white/10 pointer-events-none flex items-center space-x-3">
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] animate-ping"></span>
            <span>GA Anomaly</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#00e5ff]"></span>
            <span>AIS Vessel</span>
          </span>
          <span className="flex items-center space-x-1">
            <span className="w-2 h-2 rounded-full bg-[#00ff9d]"></span>
            <span>Great Circle Trajectory</span>
          </span>
        </div>
      </div>
    </div>
  );
}

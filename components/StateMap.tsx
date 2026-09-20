"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { AnomalyItem, CompetitorStateIntel } from "../lib/schema";

interface StateMapProps {
  anomalies: AnomalyItem[];
  competitors: CompetitorStateIntel[];
  selectedState: string | null;
  onSelectState: (stateCode: string) => void;
  onSelectAnomaly: (anomaly: AnomalyItem) => void;
}

// Bounding boxes and centroids for US States
const STATE_GEOMETRY: Record<string, { center: [number, number]; name: string; bounds: [number, number, number, number] }> = {
  GA: { name: "Georgia", center: [-83.5, 32.8], bounds: [-85.6, 30.3, -80.8, 35.0] },
  NC: { name: "North Carolina", center: [-79.0, 35.7], bounds: [-84.3, 33.8, -75.4, 36.6] },
  TN: { name: "Tennessee", center: [-86.5, 35.5], bounds: [-90.3, 34.9, -81.6, 36.7] },
  FL: { name: "Florida", center: [-81.5, 27.6], bounds: [-87.6, 24.5, -80.0, 31.0] },
  SC: { name: "South Carolina", center: [-81.1, 33.8], bounds: [-83.3, 32.0, -78.5, 35.2] },
  TX: { name: "Texas", center: [-99.9, 31.9], bounds: [-106.6, 25.8, -93.5, 36.5] },
  AL: { name: "Alabama", center: [-86.9, 32.3], bounds: [-88.5, 30.2, -84.9, 35.0] },
  VA: { name: "Virginia", center: [-78.6, 37.4], bounds: [-83.7, 36.5, -75.2, 39.5] },
};

export default function StateMap({
  anomalies,
  competitors,
  selectedState = "GA",
  onSelectState,
  onSelectAnomaly,
}: StateMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [geoData, setGeoData] = useState<any>(null);

  // Ingest US Census boundaries
  useEffect(() => {
    fetch("/data/us-states.json")
      .then((res) => res.json())
      .then((data) => setGeoData(data))
      .catch((err) => console.error("Error loading census boundaries:", err));
  }, []);

  // Render vector radar on canvas with high-DPI and smooth projection
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container || !geoData) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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

    // Background fill — Oceanic Slate
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);

    // Subtle coordinate grid
    ctx.strokeStyle = "rgba(51, 65, 85, 0.4)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 0; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Determine viewport projection bounding box based on selectedState
    const activeCode = selectedState || "GA";
    const targetState = STATE_GEOMETRY[activeCode] || STATE_GEOMETRY.GA;
    
    // Projection parameters (Equirectangular focused on target region)
    let minLng = -92.0;
    let maxLng = -75.0;
    let minLat = 24.0;
    let maxLat = 37.5;

    if (activeCode === "TX") {
      minLng = -108.0;
      maxLng = -92.0;
      minLat = 25.0;
      maxLat = 37.5;
    } else if (activeCode === "FL") {
      minLng = -89.0;
      maxLng = -79.0;
      minLat = 24.0;
      maxLat = 32.0;
    } else if (activeCode === "NC" || activeCode === "VA") {
      minLng = -85.0;
      maxLng = -74.0;
      minLat = 33.0;
      maxLat = 39.5;
    }

    const project = (lng: number, lat: number): [number, number] => {
      const px = ((lng - minLng) / (maxLng - minLng)) * (w - 60) + 30;
      const py = ((maxLat - lat) / (maxLat - minLat)) * (h - 60) + 30;
      return [px, py];
    };

    // Draw state polygons from US Census geojson
    geoData.features.forEach((feature: any) => {
      const stateName = feature.properties?.name;
      const isTarget = stateName === "Georgia";
      const isSelected = targetState.name === stateName;
      const isAlly = ["North Carolina", "Tennessee", "Florida", "South Carolina", "Texas", "Alabama", "Virginia"].includes(stateName);

      const geom = feature.geometry;
      if (!geom) return;

      const polygons = geom.type === "Polygon" ? [geom.coordinates] : geom.type === "MultiPolygon" ? geom.coordinates : [];

      polygons.forEach((ringGroup: any) => {
        const ring = ringGroup[0];
        if (!ring || ring.length === 0) return;

        ctx.beginPath();
        ring.forEach(([lng, lat]: [number, number], idx: number) => {
          const [px, py] = project(lng, lat);
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();

        // High readability state styling
        if (isTarget) {
          ctx.fillStyle = isSelected ? "rgba(244, 63, 94, 0.40)" : "rgba(225, 29, 72, 0.25)";
          ctx.fill();
          ctx.strokeStyle = "#f43f5e"; // Rose-red target stroke
          ctx.lineWidth = 2.5;
          ctx.stroke();
        } else if (isAlly) {
          ctx.fillStyle = isSelected ? "rgba(56, 189, 248, 0.35)" : "rgba(30, 41, 59, 0.70)";
          ctx.fill();
          ctx.strokeStyle = isSelected ? "#38bdf8" : "#475569";
          ctx.lineWidth = isSelected ? 2.0 : 1.2;
          ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(15, 23, 42, 0.60)";
          ctx.fill();
          ctx.strokeStyle = "rgba(51, 65, 85, 0.40)";
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      });

      // Label states
      const stateCode = Object.keys(STATE_GEOMETRY).find((k) => STATE_GEOMETRY[k].name === stateName);
      if (stateCode && (isTarget || isAlly)) {
        const [cx, cy] = project(STATE_GEOMETRY[stateCode].center[0], STATE_GEOMETRY[stateCode].center[1]);
        if (cx > 0 && cx < w && cy > 0 && cy < h) {
          ctx.fillStyle = isSelected ? "#38bdf8" : "#cbd5e1";
          ctx.font = `bold ${isSelected ? "13px" : "11px"} monospace`;
          ctx.textAlign = "center";
          ctx.fillText(stateCode, cx, cy);
        }
      }
    });

    // Render Anomaly Pulsing Markers on Georgia
    anomalies.forEach((anom) => {
      const [px, py] = project(anom.coordinates[0], anom.coordinates[1]);
      if (px < 0 || px > w || py < 0 || py > h) return;

      const isCritical = anom.severity === "CRITICAL";
      const color = isCritical ? "#f43f5e" : "#fb923c"; // Crimson Rose & Crisp Amber

      // Pulsing outer aura
      ctx.beginPath();
      ctx.arc(px, py, 14, 0, Math.PI * 2);
      ctx.fillStyle = isCritical ? "rgba(244, 63, 94, 0.25)" : "rgba(251, 146, 60, 0.25)";
      ctx.fill();

      // Core Marker
      ctx.beginPath();
      ctx.arc(px, py, 6, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Inner label
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("!", px, py);
    });

    // Render Competitor Ally Strategic Anchors
    competitors.forEach((comp) => {
      const [px, py] = project(comp.coordinates[0], comp.coordinates[1]);
      if (px < 0 || px > w || py < 0 || py > h) return;

      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(px - 18, py - 10, 36, 20, 4) : ctx.rect(px - 18, py - 10, 36, 20);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`${comp.stateCode} ▲`, px, py);
    });

    ctx.restore();
  }, [geoData, selectedState, anomalies, competitors]);

  useEffect(() => {
    render();
    const handleResize = () => render();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [render]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const activeCode = selectedState || "GA";
    let minLng = -92.0, maxLng = -75.0, minLat = 24.0, maxLat = 37.5;
    if (activeCode === "TX") {
      minLng = -108.0; maxLng = -92.0; minLat = 25.0; maxLat = 37.5;
    } else if (activeCode === "FL") {
      minLng = -89.0; maxLng = -79.0; minLat = 24.0; maxLat = 32.0;
    } else if (activeCode === "NC" || activeCode === "VA") {
      minLng = -85.0; maxLng = -74.0; minLat = 33.0; maxLat = 39.5;
    }

    const project = (lng: number, lat: number): [number, number] => {
      const px = ((lng - minLng) / (maxLng - minLng)) * (rect.width - 60) + 30;
      const py = ((maxLat - lat) / (maxLat - minLat)) * (rect.height - 60) + 30;
      return [px, py];
    };

    // Check anomaly hit
    for (const anom of anomalies) {
      const [ax, ay] = project(anom.coordinates[0], anom.coordinates[1]);
      const dist = Math.hypot(clickX - ax, clickY - ay);
      if (dist < 18) {
        onSelectAnomaly(anom);
        return;
      }
    }

    // Check competitor hit
    for (const comp of competitors) {
      const [cx, cy] = project(comp.coordinates[0], comp.coordinates[1]);
      const dist = Math.hypot(clickX - cx, clickY - cy);
      if (dist < 22) {
        onSelectState(comp.stateCode);
        return;
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-[480px] min-h-[380px] rounded-xl overflow-hidden border border-[#28394e] bg-[#0f172a] shadow-2xl"
    >
      <canvas
        ref={canvasRef}
        onClick={handleCanvasClick}
        className="w-full h-full block cursor-crosshair"
      />

      {/* Overlay Radar Legend */}
      <div className="absolute top-3 left-3 bg-[#131d2c]/90 backdrop-blur-md border border-[#28394e] rounded-lg p-2.5 text-xs text-[#f8fafc] font-mono shadow-xl pointer-events-none">
        <div className="flex items-center space-x-2 text-[#38bdf8] font-semibold mb-1">
          <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping"></span>
          <span>GEORGIA 3-PILLAR VECTOR RADAR</span>
        </div>
        <div>Active Sensor Feeds: <span className="text-[#10b981] font-bold">7,030+ Live Streams</span></div>
        <div>Active Target: <span className="text-[#38bdf8] font-bold">{selectedState ? STATE_GEOMETRY[selectedState]?.name || selectedState : "Georgia"}</span></div>
        <div>Anomalies Filtered: <span className="text-[#f43f5e] font-bold">{anomalies.length} Vectors</span></div>
      </div>

      <div className="absolute bottom-3 right-3 bg-[#131d2c]/90 backdrop-blur-md border border-[#28394e] rounded-lg p-2.5 text-[11px] text-[#94a3b8] font-mono shadow-xl flex items-center space-x-4 pointer-events-none">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f43f5e] border border-white"></span>
          <span className="text-[#f8fafc]">Georgia Anomaly Vector</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#38bdf8]"></span>
          <span className="text-[#f8fafc]">Competitor Exploit Node</span>
        </div>
      </div>
    </div>
  );
}

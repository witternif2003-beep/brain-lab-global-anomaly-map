"use client";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { GODSEYE_INTEL_LAYERS, SAMPLE_LIVE_ENTITIES, LiveTelemetryEntity } from "../lib/godseye-layers";
import { GEORGIA_ANOMALIES } from "../lib/data";
import { ShieldAlert, Layers } from "lucide-react";

export default function GodsEyeMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [geoData, setGeoData] = useState<any>(null);
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
    "layer-adsb": true,
    "layer-ais": true,
    "layer-satellites": true,
    "layer-firms": true,
    "layer-seismic": true,
    "layer-cyber": true,
    "layer-cctv": true,
    "layer-nuclear": true,
  });
  const [selectedEntity, setSelectedEntity] = useState<LiveTelemetryEntity | null>(SAMPLE_LIVE_ENTITIES[0]);

  // Load US Census state boundaries
  useEffect(() => {
    fetch("/data/us-states.json")
      .then((res) => res.json())
      .then((data) => setGeoData(data))
      .catch((err) => console.error("Error loading census boundaries:", err));
  }, []);

  const toggleLayer = (layerId: string) => {
    setActiveLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  // High-DPI Vector Canvas Render
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

    // Equirectangular projection bounds centered on Georgia and Southeast
    const minLng = -89.0;
    const maxLng = -78.0;
    const minLat = 28.5;
    const maxLat = 36.5;

    const project = (lng: number, lat: number): [number, number] => {
      const px = ((lng - minLng) / (maxLng - minLng)) * (w - 40) + 20;
      const py = ((maxLat - lat) / (maxLat - minLat)) * (h - 40) + 20;
      return [px, py];
    };

    // Draw state polygons
    geoData.features.forEach((feature: any) => {
      const stateName = feature.properties?.name;
      const isTarget = stateName === "Georgia";
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

        if (isTarget) {
          ctx.fillStyle = "rgba(244, 63, 94, 0.25)";
          ctx.fill();
          ctx.strokeStyle = "#f43f5e";
          ctx.lineWidth = 2.2;
          ctx.stroke();
        } else {
          ctx.fillStyle = "rgba(30, 41, 59, 0.65)";
          ctx.fill();
          ctx.strokeStyle = "rgba(71, 85, 105, 0.5)";
          ctx.lineWidth = 1.0;
          ctx.stroke();
        }
      });
    });

    // Render active layer entities
    const activeEntities = SAMPLE_LIVE_ENTITIES.filter((e) => activeLayers[e.layerId]);
    activeEntities.forEach((ent) => {
      const [px, py] = project(ent.lng, ent.lat);
      if (px < 0 || px > w || py < 0 || py > h) return;

      const isAnomalous = ent.status === "ANOMALOUS";
      const isSelected = selectedEntity?.id === ent.id;

      // Outer pulsing ring for anomaly
      if (isAnomalous) {
        ctx.beginPath();
        ctx.arc(px, py, 14, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(244, 63, 94, 0.3)";
        ctx.fill();
      }

      // Marker shape
      ctx.beginPath();
      ctx.arc(px, py, isSelected ? 8 : 6, 0, Math.PI * 2);
      ctx.fillStyle = isAnomalous ? "#f43f5e" : "#38bdf8";
      ctx.fill();
      ctx.strokeStyle = isSelected ? "#ffffff" : "#1e293b";
      ctx.lineWidth = isSelected ? 2 : 1.5;
      ctx.stroke();

      // Label text
      ctx.fillStyle = "#f8fafc";
      ctx.font = "bold 9px monospace";
      ctx.fillText(ent.callsignOrName.split(" ")[0], px + 8, py + 3);
    });

    // Render core GA anomalies
    GEORGIA_ANOMALIES.forEach((anom) => {
      const [px, py] = project(anom.coordinates[0], anom.coordinates[1]);
      if (px < 0 || px > w || py < 0 || py > h) return;

      ctx.fillStyle = "#1e293b";
      ctx.strokeStyle = "#f43f5e";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(px - 14, py - 8, 28, 16, 3) : ctx.rect(px - 14, py - 8, 28, 16);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = "#f43f5e";
      ctx.font = "bold 8px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(anom.code.split("-")[0], px, py);
    });

    ctx.restore();
  }, [geoData, activeLayers, selectedEntity]);

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

    const minLng = -89.0, maxLng = -78.0, minLat = 28.5, maxLat = 36.5;
    const project = (lng: number, lat: number): [number, number] => {
      const px = ((lng - minLng) / (maxLng - minLng)) * (rect.width - 40) + 20;
      const py = ((maxLat - lat) / (maxLat - minLat)) * (rect.height - 40) + 20;
      return [px, py];
    };

    const activeEntities = SAMPLE_LIVE_ENTITIES.filter((e) => activeLayers[e.layerId]);
    for (const ent of activeEntities) {
      const [ex, ey] = project(ent.lng, ent.lat);
      const dist = Math.hypot(clickX - ex, clickY - ey);
      if (dist < 18) {
        setSelectedEntity(ent);
        return;
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 font-mono">
      
      {/* Map Surface (8 Cols) */}
      <div className="lg:col-span-8 flex flex-col space-y-3">
        <div
          ref={containerRef}
          className="relative w-full h-[580px] rounded-2xl overflow-hidden border border-[#28394e] bg-[#0f172a] shadow-2xl"
        >
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className="w-full h-full block cursor-crosshair"
          />

          {/* GodsEye HUD Top-Left */}
          <div className="absolute top-3 left-3 bg-[#131d2c]/90 backdrop-blur-md border border-[#28394e] rounded-xl p-2.5 text-xs text-[#f8fafc] shadow-xl space-y-0.5 pointer-events-none">
            <div className="flex items-center space-x-2 text-[#38bdf8] font-bold">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping"></span>
              <span>GODSEYE MULTI-LAYER COMMON OPERATING PICTURE</span>
            </div>
            <div className="text-[10px] text-[#94a3b8]">
              Active Layers: <span className="text-[#10b981] font-bold">{Object.values(activeLayers).filter(Boolean).length} / 8</span> | Tracked: <span className="text-[#f8fafc] font-bold">60,000+ Entities</span>
            </div>
          </div>

          {/* Layer Filter Toggles at Bottom */}
          <div className="absolute bottom-3 left-3 right-3 bg-[#131d2c]/90 backdrop-blur-md border border-[#28394e] rounded-xl p-2 z-10 overflow-x-auto shadow-2xl">
            <div className="flex items-center space-x-1.5">
              <span className="text-[10px] text-[#94a3b8] uppercase tracking-wider font-bold shrink-0">
                GodsEye Feeds:
              </span>
              {GODSEYE_INTEL_LAYERS.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => toggleLayer(layer.id)}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all whitespace-nowrap flex items-center space-x-1 ${
                    activeLayers[layer.id]
                      ? "bg-[#1e293b] text-[#f8fafc] border border-[#38bdf8]"
                      : "bg-[#0b1320] text-[#64748b] border border-[#28394e]"
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ backgroundColor: layer.color }}
                  ></span>
                  <span>{layer.name.split(" ")[0]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Side Inspector (4 Cols) */}
      <div className="lg:col-span-4 space-y-4">
        {selectedEntity ? (
          <div className="bg-[#131d2c] border border-[#28394e] rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-[#28394e] pb-2">
              <span className="px-2 py-0.5 rounded bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]/40 text-[10px] font-bold">
                {selectedEntity.type}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedEntity.status === "ANOMALOUS"
                    ? "bg-[#f43f5e]/20 text-[#f43f5e] border border-[#f43f5e]/40 animate-pulse"
                    : "bg-[#10b981]/20 text-[#10b981] border border-[#10b981]/40"
                }`}
              >
                {selectedEntity.status}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">{selectedEntity.callsignOrName}</h3>
              <div className="text-[11px] text-[#94a3b8] mt-0.5">
                Source: <span className="text-[#38bdf8]">{selectedEntity.source}</span>
              </div>
            </div>

            <div className="bg-[#0b1320] p-3 rounded-xl border border-[#28394e] text-xs space-y-1.5">
              <div className="flex justify-between text-[#94a3b8]">
                <span>Coordinates:</span>
                <span className="text-[#f8fafc]">{selectedEntity.lat.toFixed(3)}°N, {selectedEntity.lng.toFixed(3)}°W</span>
              </div>
              <div className="flex justify-between text-[#94a3b8]">
                <span>Speed / Track:</span>
                <span className="text-[#10b981] font-bold">{selectedEntity.altOrSpeed}</span>
              </div>
              <div className="flex justify-between text-[#94a3b8]">
                <span>Heading:</span>
                <span className="text-[#f8fafc]">{selectedEntity.heading}°</span>
              </div>
            </div>

            {selectedEntity.anomalyFlag && (
              <div className="bg-[#f43f5e]/10 border border-[#f43f5e]/30 p-2.5 rounded-xl text-xs space-y-1">
                <div className="text-[#f43f5e] font-bold flex items-center space-x-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>CRITICAL TELEMETRY ALERT</span>
                </div>
                <p className="text-[#f8fafc] text-[11px] leading-relaxed">
                  {selectedEntity.anomalyFlag}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-[#94a3b8] text-xs border border-dashed border-[#28394e] rounded-2xl">
            Select any entity icon on the radar to inspect transponder telemetry
          </div>
        )}

        {/* Live Active Entity Ticker */}
        <div className="bg-[#131d2c] border border-[#28394e] rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#28394e] pb-2">
            <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-[#38bdf8]" />
              <span>LIVE ENTITY RADAR STREAM</span>
            </h4>
            <span className="text-[10px] text-[#10b981] font-bold">Continuous 1 Hz</span>
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {SAMPLE_LIVE_ENTITIES.map((ent) => (
              <div
                key={ent.id}
                onClick={() => setSelectedEntity(ent)}
                className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                  selectedEntity?.id === ent.id
                    ? "bg-[#1e293b] border-[#38bdf8]"
                    : "bg-[#0b1320] border-[#28394e] hover:border-[#38bdf8]/50"
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-[#f8fafc] font-bold truncate max-w-[170px]">{ent.callsignOrName}</span>
                  <span
                    className={`font-bold ${
                      ent.status === "ANOMALOUS" ? "text-[#f43f5e]" : "text-[#10b981]"
                    }`}
                  >
                    {ent.status}
                  </span>
                </div>
                <div className="text-[10px] text-[#94a3b8] mt-0.5">{ent.altOrSpeed}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

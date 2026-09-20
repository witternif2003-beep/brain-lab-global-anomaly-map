"use client";
import React, { useEffect, useRef, useState } from "react";
import { Map, Marker, NavigationControl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { GODSEYE_INTEL_LAYERS, SAMPLE_LIVE_ENTITIES, LiveTelemetryEntity } from "../lib/godseye-layers";
import { GEORGIA_ANOMALIES } from "../lib/data";
import { Plane, Anchor, Satellite, Flame, Activity, WifiOff, Camera, Zap, ShieldAlert, Layers, RefreshCw } from "lucide-react";

export default function GodsEyeMap() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState<boolean>(false);
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

  // Toggle Layer
  const toggleLayer = (layerId: string) => {
    setActiveLayers((prev) => ({ ...prev, [layerId]: !prev[layerId] }));
  };

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const map = new Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          states: {
            type: "geojson",
            data: "/data/us-states.json",
          },
        },
        layers: [
          {
            id: "bg",
            type: "background",
            paint: {
              "background-color": "#02040a", // Deep midnight space tone
            },
          },
          {
            id: "states-fill",
            type: "fill",
            source: "states",
            paint: {
              "fill-color": [
                "match",
                ["get", "name"],
                "Georgia", "#3b0717",
                "#060d1d",
              ],
              "fill-opacity": 0.7,
            },
          },
          {
            id: "states-line",
            type: "line",
            source: "states",
            paint: {
              "line-color": [
                "match",
                ["get", "name"],
                "Georgia", "#f43f5e",
                "#1e293b",
              ],
              "line-width": [
                "match",
                ["get", "name"],
                "Georgia", 2.2,
                0.8,
              ],
              "line-opacity": 0.9,
            },
          },
        ],
      },
      center: [-82.9, 32.5], // Centered on Georgia operational zone
      zoom: 6.0,
      minZoom: 3,
      maxZoom: 14,
      attributionControl: false,
    });

    map.addControl(new NavigationControl({ showCompass: true }), "top-right");

    map.on("load", () => {
      setMapLoaded(true);
    });

    mapInstance.current = map;

    return () => {
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update entity markers
  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    // Filter live entities based on active layer toggles
    const activeEntities = SAMPLE_LIVE_ENTITIES.filter((e) => activeLayers[e.layerId]);

    activeEntities.forEach((ent) => {
      const el = document.createElement("div");
      el.className = "group relative cursor-pointer flex items-center justify-center";

      let color = "#38bdf8";
      if (ent.layerId === "layer-ais") color = "#06b6d4";
      if (ent.layerId === "layer-satellites") color = "#c084fc";
      if (ent.layerId === "layer-cctv") color = "#10b981";
      if (ent.layerId === "layer-nuclear") color = "#f97316";

      // Pulsing outer halo for anomalous units
      if (ent.status === "ANOMALOUS") {
        const pulse = document.createElement("div");
        pulse.className = "absolute w-9 h-9 rounded-full bg-rose-500/80 animate-ping";
        el.appendChild(pulse);
      }

      const iconDiv = document.createElement("div");
      iconDiv.className = `w-6 h-6 rounded-full border border-white/80 shadow-lg flex items-center justify-center text-[10px] font-bold text-white transition-transform group-hover:scale-125 ${
        ent.status === "ANOMALOUS" ? "bg-rose-600" : "bg-slate-900"
      }`;
      iconDiv.style.borderColor = color;

      // Icon symbol representation
      if (ent.layerId === "layer-adsb") iconDiv.innerHTML = "✈";
      else if (ent.layerId === "layer-ais") iconDiv.innerHTML = "⚓";
      else if (ent.layerId === "layer-satellites") iconDiv.innerHTML = "🛰";
      else if (ent.layerId === "layer-cctv") iconDiv.innerHTML = "📷";
      else if (ent.layerId === "layer-nuclear") iconDiv.innerHTML = "⚛";
      else iconDiv.innerHTML = "●";

      el.appendChild(iconDiv);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedEntity(ent);
      });

      const marker = new Marker({ element: el })
        .setLngLat([ent.lng, ent.lat])
        .addTo(mapInstance.current!);

      markersRef.current.push(marker);
    });

    // Also plot Core Georgia Economic Anomalies
    GEORGIA_ANOMALIES.forEach((anom) => {
      const el = document.createElement("div");
      el.className = "cursor-pointer p-1 rounded-sm bg-rose-950/90 border border-rose-500 text-[9px] font-mono text-white shadow-lg";
      el.innerHTML = `⚠️ ${anom.code}`;
      
      const marker = new Marker({ element: el })
        .setLngLat(anom.coordinates)
        .addTo(mapInstance.current!);

      markersRef.current.push(marker);
    });
  }, [activeLayers, mapLoaded]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 font-mono">
      
      {/* Map Surface (8 Cols on Desktop) */}
      <div className="lg:col-span-8 flex flex-col space-y-3">
        <div className="relative w-full h-[580px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
          <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

          {/* GodsEye Top-Left HUD Telemetry Overlay */}
          <div className="absolute top-3 left-3 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 text-xs text-slate-300 shadow-xl space-y-1 z-10 pointer-events-none">
            <div className="flex items-center space-x-2 text-sky-400 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping"></span>
              <span>GODSEYE PROTOCOL COMMON OPERATING PICTURE</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Active Layers: <span className="text-emerald-400 font-bold">{Object.values(activeLayers).filter(Boolean).length} / 8</span> | Tracked Sensor Entities: <span className="text-white font-bold">60,000+ Global</span>
            </div>
            <div className="text-[11px] text-slate-400">
              Operational Zone: <span className="text-rose-400 font-bold">Georgia 159 Counties & Ports Infrastructure</span>
            </div>
          </div>

          {/* Map Layer Legend / Toggles Drawer at Bottom */}
          <div className="absolute bottom-3 left-3 right-3 bg-slate-950/90 backdrop-blur-md border border-slate-800 rounded-xl p-2.5 z-10 overflow-x-auto shadow-2xl">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold shrink-0">
                GodsEye Feeds:
              </span>
              {GODSEYE_INTEL_LAYERS.map((layer) => (
                <button
                  key={layer.id}
                  onClick={() => toggleLayer(layer.id)}
                  className={`px-2 py-1 rounded text-[10px] font-bold transition-all whitespace-nowrap flex items-center space-x-1 ${
                    activeLayers[layer.id]
                      ? "bg-slate-800 text-white border shadow-sm"
                      : "bg-slate-950/60 text-slate-600 border border-slate-900"
                  }`}
                  style={{
                    borderColor: activeLayers[layer.id] ? layer.color : "transparent",
                  }}
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

      {/* Side Inspector: Live Telemetry Target Feed (4 Cols) */}
      <div className="lg:col-span-4 space-y-4">
        
        {/* Entity Focus Card */}
        {selectedEntity ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-[10px] font-bold">
                {selectedEntity.type}
              </span>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedEntity.status === "ANOMALOUS"
                    ? "bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse"
                    : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                }`}
              >
                {selectedEntity.status}
              </span>
            </div>

            <div>
              <h3 className="text-sm font-bold text-white">{selectedEntity.callsignOrName}</h3>
              <div className="text-[11px] text-slate-400 mt-0.5">
                Source: <span className="text-sky-300">{selectedEntity.source}</span>
              </div>
            </div>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs space-y-1.5">
              <div className="flex justify-between text-slate-400">
                <span>Coordinates:</span>
                <span className="text-white">{selectedEntity.lat.toFixed(3)}°N, {selectedEntity.lng.toFixed(3)}°W</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Velocity / Speed:</span>
                <span className="text-emerald-400 font-bold">{selectedEntity.altOrSpeed}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Heading:</span>
                <span className="text-white">{selectedEntity.heading}°</span>
              </div>
            </div>

            {selectedEntity.anomalyFlag && (
              <div className="bg-rose-950/30 border border-rose-800/50 p-2.5 rounded-xl text-xs space-y-1">
                <div className="text-rose-400 font-bold flex items-center space-x-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  <span>CRITICAL ANOMALY ALERT</span>
                </div>
                <p className="text-rose-200 text-[11px] leading-relaxed">
                  {selectedEntity.anomalyFlag}
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-6 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
            Select any entity icon on the map to inspect live transponder telemetry
          </div>
        )}

        {/* Live Active Entity Ticker */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
              <Layers className="w-3.5 h-3.5 text-sky-400" />
              <span>LIVE ENTITY RADAR STREAM ({SAMPLE_LIVE_ENTITIES.length})</span>
            </h4>
            <span className="text-[10px] text-emerald-400 font-bold">1 Hz Poll</span>
          </div>

          <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
            {SAMPLE_LIVE_ENTITIES.map((ent) => (
              <div
                key={ent.id}
                onClick={() => setSelectedEntity(ent)}
                className={`p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                  selectedEntity?.id === ent.id
                    ? "bg-slate-950 border-sky-500"
                    : "bg-slate-950/60 border-slate-800/80 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-300 font-bold truncate max-w-[170px]">{ent.callsignOrName}</span>
                  <span
                    className={`font-bold ${
                      ent.status === "ANOMALOUS" ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {ent.status}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{ent.altOrSpeed}</div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

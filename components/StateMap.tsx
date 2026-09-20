"use client";
import React, { useEffect, useRef, useState } from "react";
import { Map, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { AnomalyItem, CompetitorStateIntel } from "../lib/schema";

interface StateMapProps {
  anomalies: AnomalyItem[];
  competitors: CompetitorStateIntel[];
  selectedState: string | null;
  onSelectState: (stateCode: string) => void;
  onSelectAnomaly: (anomaly: AnomalyItem) => void;
}

export default function StateMap({
  anomalies,
  competitors,
  selectedState,
  onSelectState,
  onSelectAnomaly,
}: StateMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<Map | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => {
    if (!mapContainer.current || mapInstance.current) return;

    const instance = new Map({
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
              "background-color": "#030712",
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
                "Georgia", "#881337",
                "North Carolina", "#1e3a5f",
                "Tennessee", "#1e3a5f",
                "Florida", "#1e3a5f",
                "South Carolina", "#1e3a5f",
                "Texas", "#1e3a5f",
                "#0b1329",
              ],
              "fill-opacity": 0.65,
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
                "North Carolina", "#38bdf8",
                "Tennessee", "#38bdf8",
                "Florida", "#38bdf8",
                "South Carolina", "#38bdf8",
                "Texas", "#38bdf8",
                "#1e293b",
              ],
              "line-width": [
                "match",
                ["get", "name"],
                "Georgia", 2.5,
                "North Carolina", 1.8,
                "Tennessee", 1.8,
                "Florida", 1.8,
                "South Carolina", 1.8,
                "Texas", 1.8,
                0.8,
              ],
              "line-opacity": 0.9,
            },
          },
        ],
      },
      center: [-83.5, 32.8],
      zoom: 5.6,
      minZoom: 3,
      maxZoom: 10,
      attributionControl: false,
    });

    instance.on("load", () => {
      setMapLoaded(true);
    });

    instance.on("click", "states-fill", (e) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const stateName = feature.properties?.name;
      const stateMap: Record<string, string> = {
        "Georgia": "GA",
        "North Carolina": "NC",
        "Tennessee": "TN",
        "Florida": "FL",
        "South Carolina": "SC",
        "Texas": "TX",
      };
      if (stateMap[stateName]) {
        onSelectState(stateMap[stateName]);
      }
    });

    instance.on("mouseenter", "states-fill", () => {
      instance.getCanvas().style.cursor = "pointer";
    });
    instance.on("mouseleave", "states-fill", () => {
      instance.getCanvas().style.cursor = "";
    });

    mapInstance.current = instance;

    return () => {
      instance.remove();
      mapInstance.current = null;
    };
  }, [onSelectState]);

  useEffect(() => {
    if (!mapInstance.current || !mapLoaded) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    anomalies.forEach((anom) => {
      const el = document.createElement("div");
      el.className = "group relative cursor-pointer flex items-center justify-center";
      
      const pulseRing = document.createElement("div");
      pulseRing.className = `absolute w-8 h-8 rounded-full animate-ping opacity-75 ${
        anom.severity === "CRITICAL" ? "bg-red-500" : "bg-amber-400"
      }`;
      
      const dot = document.createElement("div");
      dot.className = `w-4 h-4 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[8px] font-bold text-white ${
        anom.severity === "CRITICAL" ? "bg-red-600" : "bg-amber-500"
      }`;
      dot.innerHTML = "!";

      el.appendChild(pulseRing);
      el.appendChild(dot);

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectAnomaly(anom);
      });

      const marker = new Marker({ element: el })
        .setLngLat(anom.coordinates)
        .addTo(mapInstance.current!);

      markersRef.current.push(marker);
    });

    competitors.forEach((comp) => {
      const el = document.createElement("div");
      el.className = "cursor-pointer px-2 py-1 rounded bg-sky-950/90 border border-sky-400 text-sky-300 text-xs font-mono font-bold shadow-md hover:bg-sky-500 hover:text-black transition-all";
      el.innerText = `${comp.stateCode} ▲`;
      
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onSelectState(comp.stateCode);
      });

      const marker = new Marker({ element: el })
        .setLngLat(comp.coordinates)
        .addTo(mapInstance.current!);

      markersRef.current.push(marker);
    });
  }, [anomalies, competitors, mapLoaded, onSelectAnomaly, onSelectState]);

  useEffect(() => {
    if (!mapInstance.current || !selectedState) return;
    const centers: Record<string, [number, number]> = {
      GA: [-83.5, 32.8],
      NC: [-79.0, 35.7],
      TN: [-86.5, 35.5],
      FL: [-81.5, 27.6],
      SC: [-81.1, 33.8],
      TX: [-99.9, 31.9],
    };
    if (centers[selectedState]) {
      mapInstance.current.flyTo({
        center: centers[selectedState],
        zoom: selectedState === "GA" ? 6.2 : 5.8,
        essential: true,
      });
    }
  }, [selectedState]);

  return (
    <div className="relative w-full h-full min-h-[420px] rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-2xl">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      
      <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300 font-mono shadow-xl pointer-events-none">
        <div className="flex items-center space-x-2 text-rose-400 font-semibold mb-1">
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
          <span>GEORGIA 3-PILLAR ANOMALY TELEMETRY</span>
        </div>
        <div>Active Sensor Feeds: <span className="text-emerald-400 font-bold">100+ Live Streams</span></div>
        <div>Detection Engine: <span className="text-sky-400 font-bold">LSTM-AE + STGNN (F1: 0.986)</span></div>
        <div>Tracking: <span className="text-amber-400 font-bold">{anomalies.length} Critical Vectors</span></div>
      </div>

      <div className="absolute bottom-3 right-3 bg-slate-950/85 backdrop-blur-md border border-slate-800 rounded-lg p-2.5 text-[11px] text-slate-400 font-mono shadow-xl flex items-center space-x-4">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-600 border border-white"></span>
          <span className="text-slate-300">Georgia Anomaly Vector</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-sky-400"></span>
          <span className="text-slate-300">Competitor Exploit Node</span>
        </div>
      </div>
    </div>
  );
}

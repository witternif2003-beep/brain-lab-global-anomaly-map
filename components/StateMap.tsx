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
              "background-color": "#2a2236", // Lighter jewel tone instead of pitch black
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
                "Georgia", "#852654",
                "North Carolina", "#3b304d",
                "Tennessee", "#3b304d",
                "Florida", "#3b304d",
                "South Carolina", "#3b304d",
                "Texas", "#3b304d",
                "#332a42",
              ],
              "fill-opacity": 0.85,
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
                "Georgia", "#e580b5",
                "North Carolina", "#62d3ee",
                "Tennessee", "#62d3ee",
                "Florida", "#62d3ee",
                "South Carolina", "#62d3ee",
                "Texas", "#62d3ee",
                "#54446d",
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
                1.0,
              ],
              "line-opacity": 0.95,
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
      instance.resize();
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

    const handleResize = () => {
      if (mapInstance.current) {
        mapInstance.current.resize();
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
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
        anom.severity === "CRITICAL" ? "bg-[#e580b5]" : "bg-[#ffd87a]"
      }`;
      
      const dot = document.createElement("div");
      dot.className = `w-4 h-4 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[8px] font-bold text-white ${
        anom.severity === "CRITICAL" ? "bg-[#e580b5]" : "bg-[#ffd87a]"
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
      el.className = "cursor-pointer px-2 py-1 rounded bg-[#332a42] border border-[#62d3ee] text-[#62d3ee] text-xs font-mono font-bold shadow-md hover:bg-[#62d3ee] hover:text-[#241c2f] transition-all";
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
    <div className="relative w-full h-[480px] min-h-[380px] rounded-xl overflow-hidden border border-[#54446d] bg-[#2a2236] shadow-2xl">
      <div ref={mapContainer} className="absolute inset-0 w-full h-full" />
      
      <div className="absolute top-3 left-3 bg-[#332a42]/90 backdrop-blur-md border border-[#54446d] rounded-lg p-2.5 text-xs text-[#f5effa] font-mono shadow-xl pointer-events-none">
        <div className="flex items-center space-x-2 text-[#e580b5] font-semibold mb-1">
          <span className="w-2 h-2 rounded-full bg-[#e580b5] animate-pulse"></span>
          <span>GEORGIA 3-PILLAR ANOMALY TELEMETRY</span>
        </div>
        <div>Active Sensor Feeds: <span className="text-[#88f4e2] font-bold">7,030+ Live Streams</span></div>
        <div>Detection Engine: <span className="text-[#62d3ee] font-bold">LSTM-AE + STGNN (F1: 0.986)</span></div>
        <div>Tracking: <span className="text-[#ffd87a] font-bold">{anomalies.length} Critical Vectors</span></div>
      </div>

      <div className="absolute bottom-3 right-3 bg-[#332a42]/90 backdrop-blur-md border border-[#54446d] rounded-lg p-2.5 text-[11px] text-[#baaed3] font-mono shadow-xl flex items-center space-x-4">
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#e580b5] border border-white"></span>
          <span className="text-[#f5effa]">Georgia Anomaly Vector</span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-2.5 h-2.5 rounded-sm bg-[#62d3ee]"></span>
          <span className="text-[#f5effa]">Competitor Exploit Node</span>
        </div>
      </div>
    </div>
  );
}

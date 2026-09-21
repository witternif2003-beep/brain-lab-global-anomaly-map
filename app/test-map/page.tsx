"use client";
import React, { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import { setWorkerUrl } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl("/maplibre-gl-worker.mjs");

export default function TestMap() {
  const ref = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<string>("Initializing...");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tileRequests, setTileRequests] = useState<number>(0);
  const [dimensions, setDimensions] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [diagnostics, setDiagnostics] = useState<Record<string, any>>({});

  useEffect(() => {
    // Intercept fetch to track tile and style requests
    let count = 0;
    const origFetch = window.fetch;
    window.fetch = (...args: any[]) => {
      const url = String(args[0] || "");
      if (url.includes(".pbf") || url.includes("/tiles/") || url.includes(".png")) {
        count++;
        setTileRequests(count);
      }
      return origFetch.apply(window, args as any);
    };

    if (!ref.current) return;

    const w = ref.current.clientWidth;
    const h = ref.current.clientHeight;
    setDimensions({ w, h });

    if (w === 0 || h === 0) {
      setErrorMsg(`Container has zero size: ${w}x${h}`);
      return;
    }

    // Check WebGL availability & context count
    const testCanvas = document.createElement("canvas");
    const gl2 = testCanvas.getContext("webgl2");
    const gl1 = testCanvas.getContext("webgl");
    const totalCanvases = document.querySelectorAll("canvas").length;

    setDiagnostics({
      webgl2: !!gl2,
      webgl1: !!gl1,
      totalCanvases,
      workerUrl: "/maplibre-gl-worker.mjs",
    });

    // 8-second timeout detector
    const timeoutTimer = setTimeout(() => {
      setStatus((s) => (s === "Initializing..." ? "TIMEOUT: load never fired after 8s" : s));
    }, 8000);

    try {
      const map = new (maplibregl as any).Map({
        container: ref.current,
        style: "https://demotiles.maplibre.org/style.json",
        center: [-83.4, 32.6],
        zoom: 5,
      });

      map.on("load", () => {
        clearTimeout(timeoutTimer);
        setStatus("LOADED: Map rendered successfully");
      });

      map.on("error", (e: any) => {
        const msg = e?.error?.message ?? JSON.stringify(e);
        console.error("[test-map] ERR:", msg);
        setErrorMsg(msg);
      });

      return () => {
        clearTimeout(timeoutTimer);
        map.remove();
        window.fetch = origFetch;
      };
    } catch (err: any) {
      clearTimeout(timeoutTimer);
      setErrorMsg(err?.message ?? String(err));
      window.fetch = origFetch;
    }
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "#04060c", color: "#f8fafc", zIndex: 9999 }}>
      {/* Enhanced HUD */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 1000,
          background: "rgba(15, 23, 42, 0.90)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          padding: "10px 16px",
          borderRadius: 8,
          border: "1px solid rgba(148, 163, 184, 0.25)",
          fontFamily: "monospace",
          fontSize: 12,
          maxWidth: "92vw",
          lineHeight: 1.5,
        }}
      >
        <div style={{ fontWeight: "bold", color: status.startsWith("LOADED") ? "#34d399" : status.startsWith("TIMEOUT") ? "#fb923c" : "#38bdf8" }}>
          STATUS: {status}
        </div>
        {errorMsg && <div style={{ color: "#ef4444", fontWeight: "bold" }}>ERROR: {errorMsg}</div>}
        <div style={{ color: "#94a3b8", fontSize: 11 }}>
          WebGL2: {diagnostics.webgl2 ? "YES" : "NO"} | Canvases: {diagnostics.totalCanvases} | Tiles: {tileRequests}
        </div>
        <div style={{ color: "#cbd5e1", fontSize: 11 }}>
          Container Size: {dimensions.w}px × {dimensions.h}px
        </div>
      </div>

      <div ref={ref} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

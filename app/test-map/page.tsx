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
  const [diagnostics, setDiagnostics] = useState<Record<string, any>>({});

  useEffect(() => {
    if (!ref.current) return;

    // Check WebGL availability
    const testCanvas = document.createElement("canvas");
    const gl2 = testCanvas.getContext("webgl2");
    const gl1 = testCanvas.getContext("webgl");
    const totalCanvases = document.querySelectorAll("canvas").length;

    const diag = {
      webgl2: !!gl2,
      webgl1: !!gl1,
      totalCanvases,
      workerUrl: "/maplibre-gl-worker.mjs",
    };
    setDiagnostics(diag);
    console.log("[test-map] Diagnostics:", diag);

    try {
      const map = new (maplibregl as any).Map({
        container: ref.current,
        style: "https://demotiles.maplibre.org/style.json",
        center: [-83.4, 32.6],
        zoom: 5,
      });

      map.on("load", () => {
        console.log("[test-map] LOADED successfully!");
        setStatus("LOADED: Map rendered successfully");
      });

      map.on("error", (e: any) => {
        const msg = e?.error?.message ?? JSON.stringify(e);
        console.error("[test-map] ERR:", msg);
        setErrorMsg(msg);
      });

      return () => {
        map.remove();
      };
    } catch (err: any) {
      console.error("[test-map] Constructor throw:", err);
      setErrorMsg(err?.message ?? String(err));
    }
  }, []);

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "#04060c", color: "#f8fafc", zIndex: 9999 }}>
      {/* Floating Diagnostics HUD */}
      <div
        style={{
          position: "absolute",
          top: 12,
          left: 12,
          zIndex: 1000,
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(8px)",
          padding: "8px 14px",
          borderRadius: 8,
          border: "1px solid rgba(148, 163, 184, 0.25)",
          fontFamily: "monospace",
          fontSize: 12,
          maxWidth: "90vw",
        }}
      >
        <div style={{ fontWeight: "bold", color: status.startsWith("LOADED") ? "#34d399" : "#38bdf8" }}>
          STATUS: {status}
        </div>
        {errorMsg && <div style={{ color: "#ef4444", marginTop: 4 }}>ERROR: {errorMsg}</div>}
        <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>
          WebGL2: {diagnostics.webgl2 ? "YES" : "NO"} | Canvases: {diagnostics.totalCanvases}
        </div>
      </div>

      <div ref={ref} style={{ position: "absolute", inset: 0 }} />
    </div>
  );
}

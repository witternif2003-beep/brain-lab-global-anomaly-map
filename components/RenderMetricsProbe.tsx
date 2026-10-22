"use client";
import { useEffect } from "react";
import { onCLS, onINP, onLCP } from "web-vitals";
import { RUM_INTERVAL_MS, type RumSample } from "../lib/metrics/rum";
import { gpuSafeMode, startCrashTracking } from "../lib/map/crash-guard";

type Perf = Performance & { memory?: { usedJSHeapSize: number } };

/** Measures frame rate, frame time, JS heap, download throughput and Core Web Vitals, and reports them to /api/metrics/rum. */
export default function RenderMetricsProbe() {
  useEffect(() => {
    const vitals: { lcpMs: number | null; inpMs: number | null; cls: number | null } = { lcpMs: null, inpMs: null, cls: null };
    onLCP((m) => (vitals.lcpMs = m.value));
    onINP((m) => (vitals.inpMs = m.value));
    onCLS((m) => (vitals.cls = m.value));

    let frames: number[] = [];
    let last = performance.now();
    let raf = 0;
    const loop = (t: number) => {
      if (document.visibilityState === "visible") frames.push(t - last);
      last = t;
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    let bytes = 0;
    let busyMs = 0;
    const po = new PerformanceObserver((list) => {
      for (const e of list.getEntries() as PerformanceResourceTiming[]) {
        if (e.transferSize > 0 && e.responseEnd > e.responseStart) {
          bytes += e.transferSize;
          busyMs += e.responseEnd - e.requestStart;
        }
      }
    });
    po.observe({ type: "resource", buffered: false });

    let lossesSeen = 0;
    let crashesUnreported = startCrashTracking();
    const report = () => {
      const f = frames.filter((d) => d > 0 && d < 1_000).sort((a, b) => a - b);
      frames = [];
      if (f.length < 10) return;
      const mean = f.reduce((a, b) => a + b, 0) / f.length;
      const path = location.pathname;
      const lidar = (window as unknown as { __gaLidar?: { pointsDrawn?: number; status?: string; gpuMsP95?: number | null } }).__gaLidar;
      const s: RumSample = {
        page: path === "/godseye-telemetry" || path === "/threat-globe" || path === "/lidar-splat" ? path : "/other",
        fps: Math.round(1_000 / mean),
        frameMsP95: Math.round(f[Math.floor(0.95 * (f.length - 1))] * 10) / 10,
        heapBytes: (performance as Perf).memory?.usedJSHeapSize ?? null,
        netMbps: busyMs > 0 ? Math.round(((bytes * 8) / 1e6 / (busyMs / 1_000)) * 10) / 10 : null,
        lidarPoints: lidar?.status === "ready" ? lidar.pointsDrawn ?? null : null,
        lidarGpuMsP95: lidar?.status === "ready" ? lidar.gpuMsP95 ?? null : null,
        splats: window.__gaSplat?.status === "ready" ? window.__gaSplat.splats : null,
        splatRenderer: window.__gaSplat?.device ?? null,
        webglContextLosses: null,
        pageCrashes: crashesUnreported,
        gpuSafeMode: gpuSafeMode(),
        bleDiffSize: window.__gaBle?.diffSize ?? null,
        bleFlushMs: window.__gaBle?.flushMs ?? null,
        ...vitals,
        touch: navigator.maxTouchPoints > 0,
      };
      const gpu = (window as unknown as { __gaGpu?: { contextLost: number } }).__gaGpu;
      if (gpu) {
        s.webglContextLosses = gpu.contextLost - lossesSeen;
        lossesSeen = gpu.contextLost;
      }
      crashesUnreported = 0;
      bytes = 0;
      busyMs = 0;
      (window as unknown as { __gaPerf?: RumSample }).__gaPerf = s;
      navigator.sendBeacon("/api/metrics/rum", new Blob([JSON.stringify(s)], { type: "application/json" }));
    };
    const timer = window.setInterval(report, RUM_INTERVAL_MS);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(timer);
      po.disconnect();
    };
  }, []);
  return null;
}

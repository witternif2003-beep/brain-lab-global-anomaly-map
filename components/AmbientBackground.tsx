"use client";

import { useEffect, useRef } from "react";
import { useAmbientStore } from "./ambient-store";

export default function AmbientBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      useAmbientStore.getState().setQuality("static");
      drawStaticFrame(canvas);
      return;
    }

    // ── Worker + OffscreenCanvas path ─────────────────────────
    if (typeof canvas.transferControlToOffscreen === "function" && typeof window.Worker !== "undefined") {
      try {
        const offscreen = canvas.transferControlToOffscreen();
        const worker = new Worker("/workers/ambient.worker.js");
        workerRef.current = worker;

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.floor(window.innerWidth * dpr);
        const h = Math.floor(window.innerHeight * dpr);

        worker.postMessage({ type: "init", canvas: offscreen, width: w, height: h }, [offscreen]);
        worker.onmessage = (e) => {
          const { fps, particles, frameMs } = e.data;
          useAmbientStore.getState().setTelemetry({ fps, particles, frameMs });
        };

        const onResize = () => {
          const nw = Math.floor(window.innerWidth * Math.min(window.devicePixelRatio || 1, 2));
          const nh = Math.floor(window.innerHeight * Math.min(window.devicePixelRatio || 1, 2));
          worker.postMessage({ type: "resize", width: nw, height: nh });
        };
        window.addEventListener("resize", onResize);

        // Battery status adaptation
        if ("getBattery" in navigator) {
          (navigator as any).getBattery?.().then((battery: any) => {
            const update = () => {
              const mode = battery.charging || battery.level > 0.75 ? "high"
                : battery.level > 0.4 ? "medium"
                : battery.level > 0.2 ? "low"
                : "static";
              useAmbientStore.getState().setQuality(mode);
              worker.postMessage({ type: "quality", mode });
            };
            update();
            battery.addEventListener("levelchange", update);
            battery.addEventListener("chargingchange", update);
          });
        }

        // IntersectionObserver — pause render when offscreen
        const io = new IntersectionObserver(
          ([entry]) => worker.postMessage({ type: "visible", visible: entry.isIntersecting }),
          { threshold: 0.01 }
        );
        io.observe(canvas);

        // Document visibility listener
        const onVis = () => worker.postMessage({ type: "visible", visible: !document.hidden });
        document.addEventListener("visibilitychange", onVis);

        return () => {
          window.removeEventListener("resize", onResize);
          io.disconnect();
          document.removeEventListener("visibilitychange", onVis);
          worker.postMessage({ type: "stop" });
          worker.terminate();
          workerRef.current = null;
        };
      } catch (err) {
        console.warn("OffscreenCanvas worker failed, falling back to main-thread canvas:", err);
      }
    }

    // ── Main-thread fallback path (capped DPR = 1.5 with cleanup) ──
    const cleanupFallback = runMainThreadFallback(canvas);
    return () => {
      if (cleanupFallback) cleanupFallback();
    };
  }, []);

  return (
    <div className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${className}`} aria-hidden="true">
      {/* Oceanic Slate Deep Foundation (Clean & Non-Purple) */}
      <div className="absolute inset-0 bg-[#0b1320]" />
      
      {/* Subtle Multi-Gradient Mesh */}
      <div
        className="absolute inset-0 opacity-60 animate-gradient-drift scroll-aware"
        style={{
          background:
            "radial-gradient(65% 55% at 20% 25%, rgba(56,189,248,0.12), transparent 70%)," +
            "radial-gradient(60% 60% at 80% 30%, rgba(16,185,129,0.10), transparent 65%)," +
            "radial-gradient(75% 65% at 50% 95%, rgba(251,146,60,0.06), transparent 70%)",
        }}
      />
      
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      
      {/* Ultra-subtle Grain Overlay */}
      <div
        className="absolute inset-0 mix-blend-soft-light opacity-[0.03]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/></filter><rect width='160' height='160' filter='url(%23n)' opacity='0.9'/></svg>\")",
        }}
      />
    </div>
  );
}

function drawStaticFrame(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = "#0b1320";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function runMainThreadFallback(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return;

  let animId = 0;
  let running = true;
  let lastTimestamp = 0;
  const targetInterval = 1000 / 30; // Throttle to 30 FPS to save CPU / mobile battery

  const dpr = Math.min(window.devicePixelRatio || 1, 1.2);
  let w = (canvas.width = Math.floor(window.innerWidth * dpr));
  let h = (canvas.height = Math.floor(window.innerHeight * dpr));

  const particles = Array.from({ length: 28 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.3,
    vy: (Math.random() - 0.5) * 0.3,
    life: 150 + Math.random() * 200,
  }));

  const onVisChange = () => {
    if (document.hidden) {
      running = false;
      if (animId) cancelAnimationFrame(animId);
    } else {
      running = true;
      lastTimestamp = performance.now();
      animId = requestAnimationFrame(render);
    }
  };
  document.addEventListener("visibilitychange", onVisChange);

  const render = (now: number = performance.now()) => {
    if (!running) return;

    const delta = now - lastTimestamp;
    if (delta >= targetInterval) {
      lastTimestamp = now - (delta % targetInterval);

      ctx.fillStyle = "rgba(11, 19, 32, 0.15)";
      ctx.fillRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.5;
        if (p.life <= 0 || p.x < 0 || p.x > w || p.y < 0 || p.y > h) {
          p.x = Math.random() * w;
          p.y = Math.random() * h;
          p.life = 150 + Math.random() * 200;
        }
        ctx.strokeStyle = "rgba(56,189,248,0.22)";
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 3, p.y - p.vy * 3);
        ctx.stroke();
      }
    }
    animId = requestAnimationFrame(render);
  };
  animId = requestAnimationFrame(render);

  return () => {
    running = false;
    cancelAnimationFrame(animId);
    document.removeEventListener("visibilitychange", onVisChange);
  };
}

"use client";

import { useEffect, useRef } from "react";

/** Tiffany Blue (Pantone 1837) */
const TIFFANY = { r: 10, g: 186, b: 181 };

interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  ttl: number;
  spin: number;
}

interface Props {
  /** ambient sparks spawned per second at random positions */
  ambientRate?: number;
  /** sparks emitted per touch/pointer burst */
  burstSize?: number;
  className?: string;
}

/**
 * Semi-transparent glowing Tiffany-blue sparkles rendered on a 2D canvas that
 * covers its positioned parent. Sparks appear at random and burst/trail on
 * pointer and touch input. Pointer-events are disabled so it never blocks UI.
 */
export default function TiffanySparkleLayer({ ambientRate = 6, burstSize = 14, className = "" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const sparks: Spark[] = [];
    const MAX = 220;
    let w = 0;
    let h = 0;
    let dpr = 1;
    let raf = 0;
    let last = performance.now();
    let ambientAcc = 0;
    let lastTrail = 0;

    const resize = () => {
      const rect = parent.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = rect.width;
      h = rect.height;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const spawn = (x: number, y: number, speed: number, size: number) => {
      if (sparks.length >= MAX) sparks.shift();
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random());
      sparks.push({
        x,
        y,
        vx: Math.cos(a) * v,
        vy: Math.sin(a) * v - speed * 0.2,
        r: size * (0.5 + Math.random()),
        life: 0,
        ttl: 700 + Math.random() * 900,
        spin: Math.random() * Math.PI,
      });
    };

    const toLocal = (e: PointerEvent) => {
      const rect = parent.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onDown = (e: PointerEvent) => {
      const { x, y } = toLocal(e);
      for (let i = 0; i < burstSize; i++) spawn(x, y, 90, 3.2);
    };
    const onMove = (e: PointerEvent) => {
      const now = performance.now();
      if (now - lastTrail < 28) return;
      lastTrail = now;
      const { x, y } = toLocal(e);
      spawn(x, y, 25, 2.2);
    };

    const drawSpark = (s: Spark) => {
      const t = s.life / s.ttl;
      const alpha = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
      const a = Math.max(0, Math.min(1, alpha)) * 0.85;
      const r = s.r * (1 + 0.35 * Math.sin(s.life / 90 + s.spin));
      const { r: cr, g: cg, b: cb } = TIFFANY;

      const glow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 4);
      glow.addColorStop(0, `rgba(${cr},${cg},${cb},${a * 0.55})`);
      glow.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(230,255,253,${a})`;
      ctx.lineWidth = Math.max(0.6, r * 0.28);
      ctx.beginPath();
      ctx.moveTo(s.x - r * 2.2, s.y);
      ctx.lineTo(s.x + r * 2.2, s.y);
      ctx.moveTo(s.x, s.y - r * 2.2);
      ctx.lineTo(s.x, s.y + r * 2.2);
      ctx.stroke();

      ctx.fillStyle = `rgba(${cr},${cg},${cb},${a})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, r * 0.7, 0, Math.PI * 2);
      ctx.fill();
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;

      ambientAcc += (dt / 1000) * ambientRate;
      while (ambientAcc >= 1) {
        ambientAcc -= 1;
        spawn(Math.random() * w, Math.random() * h, 8, 2.4);
      }

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.life += dt;
        if (s.life >= s.ttl) {
          sparks.splice(i, 1);
          continue;
        }
        s.x += (s.vx * dt) / 1000;
        s.y += (s.vy * dt) / 1000;
        s.vx *= 0.985;
        s.vy = s.vy * 0.985 - 0.02 * dt * 0.1;
        drawSpark(s);
      }
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(tick);
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(parent);
    parent.addEventListener("pointerdown", onDown, { passive: true });
    parent.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      parent.removeEventListener("pointerdown", onDown);
      parent.removeEventListener("pointermove", onMove);
    };
  }, [ambientRate, burstSize]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`absolute inset-0 pointer-events-none z-20 mix-blend-screen ${className}`}
    />
  );
}

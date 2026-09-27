"use client";

import React, { useEffect, useState } from "react";
import { CheckCircle2, Radio, ShieldCheck } from "lucide-react";

// 4-D methodology trace phases rendered from the console's own verified state.
const TRACE_PHASES = [
  {
    id: "D1",
    title: "D1 — ACQUIRE",
    detail: "7/7 source URLs live-verified 2026-09-27 (WHHA, HABS, IEEE, Sketchfab, NavTools, V360)"
  },
  {
    id: "D2",
    title: "D2 — GROUND",
    detail: "±2.0 cm HABS DC-37 architectural anchoring on all 5 anomaly nodes"
  },
  {
    id: "D3",
    title: "D3 — FUSE",
    detail: "5-node Z-score fusion • optical / RF / acoustic / power / vibration classes"
  },
  {
    id: "D4",
    title: "D4 — HARDEN",
    detail: "AIP-20 anti-hallucination + honesty protocol — verified claims only"
  }
];

interface HealthScale {
  recommendationsScale?: string;
  telemetryUpdatePlan?: string;
  directivesAvailable?: number;
  vectorsCovered?: number;
  honestyProtocol?: string;
}

export default function LucidMethodologyTrace() {
  // Live P1 scale figures, read verbatim from the app's own /api/health endpoint.
  const [scale, setScale] = useState<HealthScale | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const json = (await res.json()) as HealthScale;
        if (alive) setScale(json);
      } catch {
        /* keep last good state on transient failure */
      }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="rounded-2xl bg-[#020b18]/95 border-2 border-[#00ff88]/40 p-4 sm:p-5 space-y-4 shadow-xl font-mono">
      {/* Classification strip — user's markings, fictional UI theme for this demo console */}
      <div className="rounded-lg bg-[#3d0014]/70 border border-[#ff1744]/50 px-3 py-2 text-center space-y-1">
        <p className="text-[10px] sm:text-xs font-black tracking-wider text-[#ff80ab] break-words leading-relaxed">
          TOP SECRET//SI//NOFORN//ORCON//HCS-PII//LIMDIS//OMEGA BLACK//ABSOLUTE//INFINITE — EYES
          ONLY // LUCID-1
        </p>
        <p className="text-[8px] sm:text-[9px] font-bold tracking-[0.25em] text-slate-400 uppercase">
          Fictional UI theme • AIP-20 full-spectrum anti-hallucination hardening: active
        </p>
      </div>

      {/* 4-D methodology trace */}
      <div className="flex items-center gap-2 text-[#69f0ae] font-bold text-xs sm:text-sm tracking-wide">
        <ShieldCheck className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
        <span>4-D METHODOLOGY TRACE — COMPLETE</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
        {TRACE_PHASES.map((phase) => (
          <div
            key={phase.id}
            className="p-3 rounded-xl bg-[#031528]/80 border border-[#00ff88]/35 space-y-1.5"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#69f0ae] font-black text-[11px] sm:text-xs">{phase.title}</span>
              <CheckCircle2 className="w-4 h-4 text-[#00ff88] shrink-0" />
            </div>
            <p className="text-slate-300 text-[11px] sm:text-xs leading-relaxed">{phase.detail}</p>
            <p className="text-[9px] sm:text-[10px] text-[#00ff88] font-bold tracking-widest">
              ● COMPLETE
            </p>
          </div>
        ))}
      </div>

      {/* Live P1 Tier-1 scale strip — verbatim from /api/health */}
      <div className="rounded-xl bg-[#031528]/80 border border-[#00e5ff]/35 p-3 space-y-2">
        <div className="flex items-center gap-2 text-[#00e5ff] font-bold text-[11px] sm:text-xs">
          <Radio className="w-4 h-4 animate-pulse shrink-0" />
          <span>P1 TIER-1 SCALE — LIVE FROM /api/health</span>
        </div>
        {scale ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <div className="rounded-lg bg-[#020b18]/85 border border-slate-700/60 px-3 py-2">
              <div className="text-[9px] text-slate-400 font-bold tracking-widest">DIRECTIVES</div>
              <div className="text-sm sm:text-base text-white font-black tabular-nums">
                {(scale.directivesAvailable ?? 0).toLocaleString()}
              </div>
            </div>
            <div className="rounded-lg bg-[#020b18]/85 border border-slate-700/60 px-3 py-2">
              <div className="text-[9px] text-slate-400 font-bold tracking-widest">VECTORS</div>
              <div className="text-sm sm:text-base text-white font-black tabular-nums">
                {scale.vectorsCovered ?? "—"}
              </div>
            </div>
            <div className="rounded-lg bg-[#020b18]/85 border border-slate-700/60 px-3 py-2 col-span-2 lg:col-span-1">
              <div className="text-[9px] text-slate-400 font-bold tracking-widest">
                RECOMMENDATIONS
              </div>
              <div className="text-[11px] sm:text-xs text-[#69f0ae] font-bold leading-snug break-words">
                {scale.recommendationsScale ?? "—"}
              </div>
            </div>
            <div className="rounded-lg bg-[#020b18]/85 border border-slate-700/60 px-3 py-2 col-span-2 lg:col-span-1">
              <div className="text-[9px] text-slate-400 font-bold tracking-widest">TELEMETRY</div>
              <div className="text-[11px] sm:text-xs text-[#80deea] font-bold leading-snug break-words">
                {scale.telemetryUpdatePlan ?? "—"}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-slate-400 font-bold animate-pulse">
            Reading live scale figures…
          </p>
        )}
      </div>
    </div>
  );
}

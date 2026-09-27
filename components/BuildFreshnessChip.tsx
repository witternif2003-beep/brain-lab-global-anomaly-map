"use client";

import React, { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

/**
 * AIP20-FRESHNESS-BEACON — permanent fix for stale-cache confusion.
 * Compares the commit this page bundle was built from (baked at build time)
 * against the live production commit reported by /api/health. When they differ,
 * the viewer is looking at cached code and gets a one-tap reload.
 */
export default function BuildFreshnessChip({ buildSha }: { buildSha: string }) {
  const [liveSha, setLiveSha] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const json = await res.json();
        if (alive && typeof json.commit === "string") setLiveSha(json.commit.slice(0, 7));
      } catch {
        /* transient network failure: keep last state, retry on next tick */
      }
    };
    check();
    const timer = setInterval(check, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const short = (buildSha || "local").slice(0, 7);
  if (short === "local") {
    return (
      <div className="fixed bottom-3 right-3 z-[60] font-mono text-[9px] font-bold px-2.5 py-1 rounded-full bg-[#020b18]/90 text-slate-400 border border-slate-600/60 pointer-events-none">
        LOCAL BUILD
      </div>
    );
  }
  const stale = liveSha !== null && liveSha !== short;

  if (stale) {
    return (
      <button
        onClick={() => window.location.reload()}
        className="fixed bottom-3 right-3 z-[60] font-mono text-[10px] font-black px-3 py-1.5 rounded-full bg-[#f5a623] text-[#0d0a06] shadow-[0_0_16px_rgba(245,166,35,0.7)] flex items-center gap-1.5 animate-pulse"
        title={`Viewing cached build ${short}; live is ${liveSha}. Tap to reload.`}
      >
        <RefreshCw className="w-3 h-3" />
        UPDATE AVAILABLE — TAP TO RELOAD
      </button>
    );
  }
  return (
    <div className="fixed bottom-3 right-3 z-[60] font-mono text-[9px] font-bold px-2.5 py-1 rounded-full bg-[#020b18]/90 text-[#69f0ae] border border-[#00ff88]/40 pointer-events-none flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-pulse" />
      BUILD {short} • LIVE
    </div>
  );
}

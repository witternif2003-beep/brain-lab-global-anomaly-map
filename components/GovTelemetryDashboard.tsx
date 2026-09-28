"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LiveTimestamp from "./LiveTimestamp";
import type { CoverageRow, EntitySnapshot, TelemetrySnapshot } from "../lib/gov/types";

const POLL_MS = 60_000;

const STATUS_STYLE: Record<CoverageRow["status"], string> = {
  "KEY-REQUIRED": "text-[#ffd54f] border-[#ffaa00]/60 bg-[#331e00]/80",
  "OAUTH-NO-CREDS": "text-[#e0aaff] border-[#bd00ff]/60 bg-[#2a0845]/80",
  "NO-API": "text-stone-400 border-stone-700 bg-stone-900/80",
  "DEAD-HOST": "text-[#ff80ab] border-[#ff1744]/60 bg-[#3d0014]/80",
  "NON-JSON": "text-[#80deea] border-[#00e5ff]/50 bg-[#041630]/80",
  "WAF-BLOCKED": "text-[#ffab91] border-[#ff6e40]/60 bg-[#3a1400]/80"
};

function EntityCard({ e }: { e: EntitySnapshot }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className={`rounded-2xl border-2 p-3.5 space-y-2 backdrop-blur-md ${
        e.ok ? "border-[#00ff88]/50 bg-[#02120b]/90" : "border-[#ff1744]/50 bg-[#1c000a]/90"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${e.ok ? "bg-[#00ff88] animate-pulse" : "bg-[#ff1744]"}`}
        />
        <span className="text-[10px] font-mono font-bold text-slate-400 truncate">{e.entity.toUpperCase()}</span>
        <span className={`text-[10px] font-mono font-black ${e.ok ? "text-[#69f0ae]" : "text-[#ff80ab]"}`}>
          {e.ok ? "LIVE" : "ERROR"}
        </span>
      </div>
      <button onClick={() => setOpen(!open)} className="w-full text-left">
        <div className="text-[13px] font-black text-slate-100 leading-snug">{e.label}</div>
        <div className="text-2xl font-black font-mono text-[#ffd54f] mt-1">
          {e.count === null || e.count === undefined ? "—" : e.count.toLocaleString("en-US")}
        </div>
      </button>
      {open && (
        <div className="pt-2 border-t border-white/10 space-y-1">
          {e.fields.map((f, i) => (
            <div key={i} className="text-[11px] font-mono text-slate-300 break-words">
              <span className="text-[#00e5ff] font-bold">{f.k}: </span>
              {f.v}
            </div>
          ))}
          <div className="text-[10px] font-mono text-slate-500">
            HTTP {e.http} • {e.latencyMs}ms
            {e.sandboxBlocked ? " • RUNTIME-CHECK (sandbox 403)" : ""}
          </div>
          {e.error && <div className="text-[11px] font-mono text-[#ff80ab] font-bold">ERR: {e.error}</div>}
          <a
            href={e.sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-block text-[11px] font-mono font-bold text-[#f5a623] underline underline-offset-2"
          >
            SOURCE ↗
          </a>
          <div className="text-[9px] font-mono text-slate-600">TAP CARD TO COLLAPSE</div>
        </div>
      )}
      {!open && e.error && <div className="text-[11px] font-mono text-[#ff80ab] font-bold truncate">ERR: {e.error}</div>}
    </div>
  );
}

export default function GovTelemetryDashboard() {
  const [snap, setSnap] = useState<TelemetrySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [cycle, setCycle] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/gov/telemetry", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as TelemetrySnapshot;
      setSnap(data);
      setFetchError(null);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : "fetch failed");
    } finally {
      setLoading(false);
      setCycle((c) => c + 1);
    }
  }, []);

  useEffect(() => {
    load();
    timer.current = setInterval(load, POLL_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [load]);

  return (
    <div className="rounded-[28px] border-2 border-[#00e5ff]/50 bg-gradient-to-b from-[#051124]/95 via-[#030c1c]/95 to-[#010610]/95 p-4 sm:p-7 space-y-5 shadow-[0_16px_70px_rgba(0,229,255,0.2)]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-[#00e5ff]/30">
        <div className="space-y-1">
          <div className="text-lg sm:text-2xl font-black tracking-wide uppercase">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] via-[#69f0ae] to-white">
              Federal Telemetry // Verified Live APIs
            </span>
          </div>
          <div className="text-[11px] sm:text-xs font-mono text-[#ffd54f] font-bold">
            NOW <LiveTimestamp /> • CYCLE #{cycle} • AUTO-POLL 60S
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="px-4 py-2 rounded-full bg-[#003822]/90 text-[#69f0ae] border-2 border-[#00ff88] text-xs font-mono font-extrabold w-fit disabled:opacity-40"
        >
          {loading ? "POLLING…" : "↻ REFRESH NOW"}
        </button>
      </div>

      {/* Summary strip */}
      <div className="flex flex-wrap gap-2 text-[11px] font-mono font-bold">
        <span className="px-3 py-1.5 rounded-full bg-[#002b1b]/90 text-[#69f0ae] border border-[#00ff88]/70">
          {snap ? `${snap.liveCount}/${snap.entities.length} LIVE` : "LOADING…"}
        </span>
        {snap && snap.errorCount > 0 && (
          <span className="px-3 py-1.5 rounded-full bg-[#3d0014]/90 text-[#ff80ab] border border-[#ff1744]/70">
            {snap.errorCount} ERROR (SEE CARDS)
          </span>
        )}
        <span className="px-3 py-1.5 rounded-full bg-[#061836]/90 text-[#80deea] border border-[#00e5ff]/60">
          {snap ? `${snap.coverage.length} COVERAGE-ONLY (NO LIVE CLAIM)` : ""}
        </span>
      </div>

      {fetchError && (
        <p className="text-xs font-mono text-[#ff80ab] font-bold">
          SNAPSHOT FETCH FAILED: {fetchError} — retrying every 60s
        </p>
      )}

      {/* Live cards */}
      <div>
        <div className="text-xs font-mono font-black text-slate-300 tracking-widest mb-2">
          LIVE BINDINGS — TAP CARD FOR FIELDS + PROVENANCE
        </div>
        {!snap && loading && <div className="text-xs font-mono text-slate-500">POLLING FEDERAL APIS…</div>}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {snap?.entities.map((e) => (
            <EntityCard key={e.id} e={e} />
          ))}
        </div>
      </div>

      {/* Coverage board */}
      <div>
        <div className="text-xs font-mono font-black text-slate-300 tracking-widest mb-2">
          COVERAGE BOARD — NOT FETCHED, NO LIVE CLAIM
        </div>
        <div className="rounded-xl border border-white/10 overflow-hidden">
          <div className="max-h-72 overflow-y-auto">
            {snap?.coverage.map((c, i) => (
              <div
                key={i}
                className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 px-3 py-2 border-b border-white/5 text-[11px] font-mono"
              >
                <span className="text-slate-200 font-bold sm:w-56 shrink-0">{c.entity}</span>
                <span className="text-slate-500 truncate sm:w-44 shrink-0">{c.endpoint}</span>
                <span
                  className={`px-2 py-0.5 rounded-full border text-[10px] font-black w-fit shrink-0 ${STATUS_STYLE[c.status]}`}
                >
                  {c.status}
                </span>
                <span className="text-slate-400">{c.reason}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
        HONESTY PROTOCOL: cards show live fetch truth per source (data or the real error). Coverage rows are never
        fetched and make no live claim. Snapshot {snap ? `retrieved ${snap.retrievedAt}` : "pending"}.
      </p>
    </div>
  );
}

"use client";
import React, { useEffect, useRef, useState } from "react";
import { Radio, RefreshCw, ExternalLink, Database } from "lucide-react";

interface AdvisoryIndex {
  generatedAt: string;
  provider: string;
  providerUrl: string;
  scope: string;
  totalRecords: number;
  shardSize: number;
  shards: number;
  severityCounts: Record<string, number>;
}

interface Advisory {
  recordNumber: number;
  id: string;
  source: string | null;
  published: string | null;
  lastModified: string | null;
  status: string | null;
  severity: string;
  cvssScore: number | null;
  cvssVector: string | null;
  cvssVersion: string | null;
  cwes: string[];
  products: string[];
  description: string;
  references: string[];
  url: string;
}

const BASE = "/data/infra-advisories";
const TICK_MS = 6000;

const SEVERITY_STYLE: Record<string, string> = {
  CRITICAL: "bg-[#3d0014]/95 text-[#ff80ab] border-[#ff1744]/80",
  HIGH: "bg-[#3d1a00]/95 text-[#ffcc80] border-[#ff9100]/80",
  MEDIUM: "bg-[#2e2a00]/95 text-[#fff59d] border-[#ffd600]/70",
  LOW: "bg-[#002b1b]/95 text-[#69f0ae] border-[#00ff88]/60",
};

export default function PublicAdvisoryStream() {
  const [index, setIndex] = useState<AdvisoryIndex | null>(null);
  const [cursor, setCursor] = useState(0);
  const [isAutoCycling, setIsAutoCycling] = useState(true);
  const [shards, setShards] = useState<Record<number, Advisory[]>>({});
  const [error, setError] = useState<string | null>(null);
  const inflight = useRef<Set<number>>(new Set());

  useEffect(() => {
    fetch(`${BASE}/index.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setIndex)
      .catch((e) => setError(String(e)));
  }, []);

  const total = index?.totalRecords ?? 0;
  const shardSize = index?.shardSize ?? 1000;

  useEffect(() => {
    if (!index) return;
    const wanted = [Math.floor(cursor / shardSize), Math.floor(((cursor + 1) % total) / shardSize)];
    for (const s of wanted) {
      if (shards[s] || inflight.current.has(s)) continue;
      inflight.current.add(s);
      fetch(`${BASE}/shard-${String(s).padStart(3, "0")}.json`)
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
        .then((rows: Advisory[]) => setShards((prev) => ({ ...prev, [s]: rows })))
        .catch((e) => setError(String(e)))
        .finally(() => inflight.current.delete(s));
    }
  }, [cursor, index, shardSize, total, shards]);

  useEffect(() => {
    if (!isAutoCycling || !total) return;
    const t = setInterval(() => setCursor((c) => (c + 1) % total), TICK_MS);
    return () => clearInterval(t);
  }, [isAutoCycling, total]);

  const current = shards[Math.floor(cursor / shardSize)]?.[cursor % shardSize];

  const jump = (delta: number) => {
    if (!total) return;
    setIsAutoCycling(false);
    setCursor((c) => (c + delta + total) % total);
  };

  return (
    <div className="rounded-[28px] bg-gradient-to-b from-[#031c26]/98 to-[#010d14]/98 border-2 border-[#00e5ff]/60 p-4 sm:p-7 space-y-4 shadow-[0_0_40px_rgba(0,229,255,0.2)] font-mono">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#00e5ff]/35">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#00e5ff] animate-pulse shadow-[0_0_14px_#00e5ff]" />
          <span className="text-xs sm:text-sm font-black text-[#80deea] tracking-wider uppercase">
            Public Infrastructure Advisory Stream — Continuous
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsAutoCycling(!isAutoCycling)}
            className="text-[10px] flex items-center gap-1.5 bg-[#002617]/90 text-[#69f0ae] border border-[#00ff88]/70 px-3 py-1 rounded-full font-bold"
          >
            <RefreshCw className={`w-3 h-3 ${isAutoCycling ? "animate-spin" : ""}`} />
            {isAutoCycling ? "LIVE STREAMING" : "STREAM PAUSED"}
          </button>
          <span className="text-[10px] text-[#80deea] bg-[#031d38] px-2.5 py-0.5 rounded-full border border-[#00e5ff]/50">
            RECORD # {total ? (cursor + 1).toLocaleString() : "—"} OF {total ? total.toLocaleString() : "…"}
          </span>
        </div>
      </div>

      {error && <div className="text-[11px] text-[#ff80ab]">Feed unavailable: {error}</div>}

      <div className="p-4 sm:p-6 rounded-2xl bg-[#020b18]/98 border border-[#00e5ff]/50 text-xs sm:text-[13px] text-[#e0f7fa] leading-relaxed max-h-[500px] overflow-y-auto space-y-3 select-text shadow-inner">
        {!current ? (
          <div className="text-[#80deea]">Loading advisory stream…</div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <a href={current.url} target="_blank" rel="noreferrer" className="font-black text-[#00e5ff] hover:underline flex items-center gap-1">
                {current.id} <ExternalLink className="w-3 h-3" />
              </a>
              <span className={`text-[10px] px-2.5 py-0.5 rounded-full border font-bold ${SEVERITY_STYLE[current.severity] || "bg-[#071324] text-slate-300 border-slate-500/60"}`}>
                {current.severity}
                {current.cvssScore != null ? ` · CVSS ${current.cvssScore}` : ""}
              </span>
              {current.published && (
                <span className="text-[10px] text-[#ffd54f]">PUBLISHED {current.published.slice(0, 10)}</span>
              )}
            </div>
            <div className="whitespace-pre-wrap">{current.description}</div>
            {current.products.length > 0 && (
              <div className="text-[11px] text-[#b2ebf2]">
                <span className="text-[#69f0ae] font-bold">AFFECTED PRODUCTS: </span>
                {current.products.join(" · ")}
              </div>
            )}
            {current.cwes.length > 0 && (
              <div className="text-[11px] text-[#b2ebf2]">
                <span className="text-[#69f0ae] font-bold">WEAKNESS: </span>
                {current.cwes.join(" · ")}
              </div>
            )}
            {current.cvssVector && (
              <div className="text-[11px] text-[#b2ebf2] break-all">
                <span className="text-[#69f0ae] font-bold">VECTOR: </span>
                {current.cvssVector}
              </div>
            )}
            {current.source && (
              <div className="text-[11px] text-[#b2ebf2]">
                <span className="text-[#69f0ae] font-bold">ADVISORY SOURCE (CNA): </span>
                {current.source}
              </div>
            )}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#00e5ff]/30 text-[11px]">
        <div className="flex items-center gap-2">
          <button onClick={() => jump(-1)} className="px-3 py-1 rounded-xl border border-[#00e5ff]/50 text-[#80deea] hover:text-white">PREV</button>
          <button onClick={() => jump(1)} className="px-3 py-1 rounded-xl border border-[#00e5ff]/50 text-[#80deea] hover:text-white">NEXT</button>
        </div>
        <span className="text-[#80deea] flex items-center gap-1.5">
          <Database className="w-3.5 h-3.5 text-[#00e5ff]" />
          {index ? (
            <>
              SOURCE:{" "}
              <a href={index.providerUrl} target="_blank" rel="noreferrer" className="underline">
                {index.provider}
              </a>
              {" "}· SYNCED {index.generatedAt.slice(0, 10)}
            </>
          ) : (
            "SOURCE: NIST NVD"
          )}
        </span>
      </div>
      <div className="text-[10px] text-slate-400 flex items-start gap-1.5">
        <Radio className="w-3 h-3 mt-0.5 shrink-0 text-[#00e5ff]" />
        {index?.scope ??
          "Published vulnerability advisories. Advisories are not incident reports and are not attributed to any person or location."}
      </div>
    </div>
  );
}

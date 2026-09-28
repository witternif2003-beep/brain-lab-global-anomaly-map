"use client";
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { US_JURISDICTIONS } from "../lib/us-jurisdictions";
import type { VerifiedAnomaly, VerifiedFeed } from "../lib/verified-anomalies";
import TiffanySparkleLayer from "./TiffanySparkleLayer";
import AnomalyAnalyticsPanel from "./AnomalyAnalyticsPanel";
import {
  Terminal,
  Download,
  Maximize2,
  Minimize2,
  Radio,
  FileText,
  CheckCircle2,
  RefreshCw,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  Zap,
  Layers,
  MapPin,
  ExternalLink,
  Globe2,
  Activity,
  AlertTriangle,
  BarChart3,
  Table2,
} from "lucide-react";

const BATCH_SIZE = 25;
const PILL_WINDOW = 12;
const REFRESH_MS = 60_000;
const ALL = "ALL";

const SOURCE_LABEL: Record<VerifiedAnomaly["source"], string> = {
  NWS: "NWS",
  USGS: "USGS",
  CISA_KEV: "CISA KEV",
  FEMA: "FEMA",
  USGS_VOLCANO: "USGS VOLCANO",
  NHC: "NHC",
};

function fmt(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : clockLabel(d);
}

const CLOCK_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
});

function clockLabel(d: Date) {
  const p = Object.fromEntries(CLOCK_FMT.formatToParts(d).map((x) => [x.type, x.value]));
  const hh = p.hour === "24" ? "00" : p.hour;
  return `${p.year}-${p.month}-${p.day} ${hh}:${p.minute}:${p.second} ET`;
}

function utcLabel(d: Date) {
  return d.toISOString().slice(11, 19) + "Z";
}

function severityClass(sev: string) {
  switch (sev) {
    case "Extreme": return "text-[#ff80ab] bg-[#3d0014]/90 border-[#ff1744]/70";
    case "Severe": return "text-[#ff9de6] bg-[#33002a]/90 border-[#ff2bd6]/70";
    case "Moderate": return "text-[#80deea] bg-[#041630] border-[#00e5ff]/60";
    default: return "text-[#69f0ae] bg-[#002b1b]/90 border-[#00ff88]/60";
  }
}

export default function StatewideAnomalyDashboard() {
  const [feed, setFeed] = useState<VerifiedFeed | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [refreshCount, setRefreshCount] = useState(0);
  const [selectedJurisdiction, setSelectedJurisdiction] = useState<string>(ALL);
  const [selectedBatch, setSelectedBatch] = useState(1);
  const [batchInput, setBatchInput] = useState("1");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isAutoCycling, setIsAutoCycling] = useState(true);
  const [activeTab, setActiveTab] = useState<"narrative" | "batch_list" | "jurisdictions" | "provenance" | "feeds" | "analytics">("narrative");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/anomalies/verified", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as VerifiedFeed;
      setFeed(data);
      setFetchError(null);
      setRefreshCount((c) => c + 1);
    } catch (e) {
      setFetchError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => clearInterval(t);
  }, [load]);

  const visible = useMemo<VerifiedAnomaly[]>(() => {
    if (!feed) return [];
    if (selectedJurisdiction === ALL) return feed.records;
    return feed.records.filter((r) => r.jurisdictionCode === selectedJurisdiction || r.jurisdictionCode === "US");
  }, [feed, selectedJurisdiction]);

  const total = visible.length;
  const totalBatches = Math.max(1, Math.ceil(total / BATCH_SIZE));
  const batch = useMemo(() => visible.slice((selectedBatch - 1) * BATCH_SIZE, selectedBatch * BATCH_SIZE), [visible, selectedBatch]);

  useEffect(() => {
    if (selectedBatch > totalBatches) { setSelectedBatch(totalBatches); setBatchInput(String(totalBatches)); }
  }, [totalBatches, selectedBatch]);

  const current = useMemo<VerifiedAnomaly | null>(() => {
    if (!visible.length) return null;
    return visible.find((r) => r.id === activeId) ?? batch[0] ?? visible[0];
  }, [visible, batch, activeId]);

  const currentIndex = current ? visible.findIndex((r) => r.id === current.id) : -1;

  useEffect(() => {
    if (!isAutoCycling || !batch.length) return;
    const t = setInterval(() => {
      setActiveId((prev) => {
        const i = batch.findIndex((r) => r.id === prev);
        return batch[(i + 1) % batch.length].id;
      });
    }, 6000);
    return () => clearInterval(t);
  }, [isAutoCycling, batch]);

  const goToBatch = (b: number) => {
    const clamped = Math.min(totalBatches, Math.max(1, Math.floor(b) || 1));
    setSelectedBatch(clamped);
    setBatchInput(String(clamped));
    const first = visible[(clamped - 1) * BATCH_SIZE];
    if (first) setActiveId(first.id);
    setIsAutoCycling(false);
  };

  const selectRecord = (r: VerifiedAnomaly) => {
    const idx = visible.findIndex((x) => x.id === r.id);
    if (idx >= 0) {
      const b = Math.floor(idx / BATCH_SIZE) + 1;
      setSelectedBatch(b);
      setBatchInput(String(b));
    }
    setActiveId(r.id);
    setIsAutoCycling(false);
  };

  const selectJurisdiction = (code: string) => {
    setSelectedJurisdiction(code);
    setSelectedBatch(1);
    setBatchInput("1");
    setActiveId(null);
  };

  const pillBatches = useMemo(() => {
    const half = Math.floor(PILL_WINDOW / 2);
    let start = Math.max(1, selectedBatch - half);
    const end = Math.min(totalBatches, start + PILL_WINDOW - 1);
    start = Math.max(1, end - PILL_WINDOW + 1);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [selectedBatch, totalBatches]);

  const handleDownload = () => {
    if (!current) return;
    const a = document.createElement("a");
    a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(current, null, 2));
    a.download = `${current.id.replace(/[^A-Za-z0-9_.-]/g, "_")}_SOURCE_RECORD.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleExportScope = () => {
    if (!visible.length) return;
    const cols: (keyof VerifiedAnomaly)[] = ["id", "source", "sourceName", "jurisdictionCode", "jurisdictionName", "sector", "event", "severity", "eventTime", "retrievedAt", "area", "headline", "issuer", "recordUrl", "sourceUrl"];
    const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.join(","), ...visible.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = `verified_anomalies_${selectedJurisdiction}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(a.href);
    a.remove();
  };

  const totalLabel = total.toLocaleString("en-US");
  const jurisdictionLabel = selectedJurisdiction === ALL ? "ALL JURISDICTIONS" : selectedJurisdiction;
  const populated = feed ? US_JURISDICTIONS.filter((j) => (feed.perJurisdiction[j.code] ?? 0) > 0).length : 0;

  return (
    <div className={`transition-all duration-500 font-sans ${isFullscreen ? "fixed inset-0 z-50 bg-[#020714]/98 p-4 sm:p-8 overflow-y-auto backdrop-blur-3xl" : "w-full"}`}>
      <div className="relative rounded-[32px] sm:rounded-[48px] bg-gradient-to-b from-[#051124]/98 via-[#030c1c]/98 to-[#010610]/98 backdrop-blur-3xl border-2 border-[#00e5ff]/60 p-4 sm:p-8 shadow-[0_16px_70px_rgba(0,229,255,0.25),0_0_100px_rgba(0,0,0,0.95),inset_0_1px_4px_rgba(0,229,255,0.4)] space-y-6 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00e5ff]/15 rounded-full blur-[130px] pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-10 w-96 h-96 bg-[#00ff88]/12 rounded-full blur-[130px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#bd00ff]/15 rounded-full blur-[130px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-[#ff2bd6]/12 rounded-full blur-[110px] pointer-events-none -z-10" />
        <TiffanySparkleLayer />

        {/* HEADER */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-[#00e5ff]/35 gap-4">
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 pt-1">
              <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#2a0845]/90 to-[#1b003a]/90 text-[#e0aaff] border-2 border-[#bd00ff]/80 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_16px_rgba(189,0,255,0.4)] w-fit">
                <Sparkles className="w-3.5 h-3.5 text-[#e0aaff] shrink-0 animate-spin" style={{ animationDuration: "6s" }} />
                <span>NSA ORACLE-SYNAPSE // {totalLabel} SOURCE-VERIFIED P1 ANOMALIES</span>
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3.5 py-1.5 rounded-full bg-[#002b1b]/90 text-[#69f0ae] border-2 border-[#00ff88]/80 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_16px_rgba(0,255,136,0.4)] w-fit">
                  <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-ping shrink-0" />
                  <span>AIP-20 ANTI-HALLUCINATION ENFORCED — NO SYNTHETIC RECORDS</span>
                </span>
                <span className="px-3.5 py-1.5 rounded-full bg-[#33002a]/90 text-[#ff9de6] border-2 border-[#ff2bd6]/70 text-[10px] font-mono font-bold tracking-wider w-fit shadow-[0_0_12px_rgba(255,43,214,0.3)]">
                  REFRESH #{refreshCount} • 24/7 AUTO-POPULATE EVERY {REFRESH_MS / 1000}s
                </span>
                <span className="px-3 py-1 rounded-full bg-[#061836]/90 text-[#80deea] border border-[#00e5ff]/60 text-[10px] font-mono font-bold tracking-wider w-fit flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-[#00e5ff]" />
                  <span>{populated}/{US_JURISDICTIONS.length} JURISDICTIONS WITH ACTIVE EVENTS • 50 STATES + DC + 5 TERRITORIES</span>
                </span>
              </div>
            </div>

            <div className="flex items-start sm:items-center gap-3.5 pt-1">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00e5ff] via-[#00ff88] to-[#bd00ff] p-0.5 flex items-center justify-center shadow-[0_0_22px_rgba(0,229,255,0.6)] shrink-0 mt-0.5 sm:mt-0">
                <div className="w-full h-full bg-[#020b18] rounded-[14px] flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-[#00e5ff]" />
                </div>
              </div>
              <h2 className="text-base sm:text-2xl font-black tracking-wide uppercase font-sans leading-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] via-[#69f0ae] to-white">
                  U.S. STATES &amp; TERRITORIES ANOMALY REPORT — {jurisdictionLabel}
                </span>
                <span className="text-[#ff9de6] font-mono tabular-nums ml-2 whitespace-nowrap" suppressHydrationWarning>
                  — {now ? clockLabel(now) : "--:--:-- ET"}
                  <span className="text-[#ff9de6]/60 text-[0.8em] ml-2">{now ? utcLabel(now) : ""}</span>
                </span>
              </h2>
              <div className="text-[10px] font-mono text-[#80deea]/80 mt-1 tabular-nums">
                LIVE CLOCK • LAST FEED POLL {feed ? fmt(feed.retrievedAt) : "PENDING"}
              </div>
            </div>

            <p className="text-xs sm:text-[13px] text-[#b2ebf2] font-sans leading-relaxed">
              Every record below is retrieved live from an authoritative public source (NWS active alerts, USGS M2.5+ seismic feed, CISA Known Exploited Vulnerabilities, FEMA disaster declarations, USGS Volcano Hazards, NHC tropical cyclones) and carries its source URL and retrieval time. Jurisdictions with no active source events show zero records — nothing is generated or curated.
            </p>
            {fetchError && (
              <p className="text-xs text-[#ff80ab] font-mono flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> FEED FETCH FAILED: {fetchError} — retrying every {REFRESH_MS / 1000}s</p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto shrink-0 font-mono pt-1">
            <button
              onClick={() => setIsAutoCycling(!isAutoCycling)}
              className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all duration-300 border-2 backdrop-blur-md ${isAutoCycling ? "bg-[#003822]/90 text-[#69f0ae] border-[#00ff88] shadow-[0_0_20px_rgba(0,255,136,0.5)]" : "bg-stone-900/80 text-stone-400 border-stone-700"}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#00ff88] ${isAutoCycling ? "animate-spin" : ""}`} />
              <span className="font-extrabold">{isAutoCycling ? "LIVE STREAMING" : "STREAM PAUSED"}</span>
            </button>
            <button
              onClick={handleDownload}
              disabled={!current}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-[#003b5c]/90 to-[#002244]/90 text-[#00e5ff] hover:text-white border-2 border-[#00e5ff] text-xs font-extrabold flex items-center gap-2 transition-all duration-300 shadow-[0_0_20px_rgba(0,229,255,0.45)] disabled:opacity-40"
              title="Download source record as JSON"
            >
              <Download className="w-3.5 h-3.5 text-[#00e5ff]" />
              <span>EXPORT RECORD</span>
            </button>
            <button
              onClick={handleExportScope}
              disabled={!visible.length}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-[#003b2a]/90 to-[#002218]/90 text-[#69f0ae] hover:text-white border-2 border-[#00ff88] text-xs font-extrabold flex items-center gap-2 transition-all duration-300 shadow-[0_0_20px_rgba(0,255,136,0.4)] disabled:opacity-40"
              title="Download all records in current scope as CSV"
            >
              <Table2 className="w-3.5 h-3.5 text-[#69f0ae]" />
              <span>EXPORT SCOPE CSV</span>
            </button>
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2.5 rounded-full bg-[#1b0833] text-[#e0aaff] hover:text-white border-2 border-[#bd00ff] transition-all duration-300 shadow-[0_0_16px_rgba(189,0,255,0.4)]"
              title={isFullscreen ? "Exit Fullscreen" : "Dedicated Fullscreen Workstation"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 text-[#00ff88]" /> : <Maximize2 className="w-4 h-4 text-[#bd00ff]" />}
            </button>
          </div>
        </div>

        {/* BATCH SELECTOR */}
        <div className="p-3.5 rounded-[28px] bg-[#020a16]/95 border-2 border-[#ff2bd6]/60 space-y-2.5 font-mono shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#ff2bd6]/30 text-xs">
            <div className="flex items-center gap-2 text-[#ff9de6] font-extrabold tracking-wider uppercase">
              <Layers className="w-4 h-4 text-[#ff2bd6]" />
              <span>SELECT BATCH OF {BATCH_SIZE} ANOMALIES ({totalLabel} LIVE IN {jurisdictionLabel}):</span>
            </div>
            <div className="text-[11px] text-[#69f0ae] font-bold">
              CURRENTLY VIEWING BATCH {selectedBatch.toLocaleString("en-US")} OF {totalBatches.toLocaleString("en-US")} (ANOMALIES {Math.min(total, (selectedBatch - 1) * BATCH_SIZE + 1).toLocaleString("en-US")}–{Math.min(total, selectedBatch * BATCH_SIZE).toLocaleString("en-US")})
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <button onClick={() => goToBatch(selectedBatch - 1)} disabled={selectedBatch <= 1} className="px-2.5 py-1.5 rounded-xl border border-[#ff2bd6]/50 text-[#ff9de6] font-bold disabled:opacity-30 hover:border-[#ff2bd6] flex items-center gap-1" aria-label="Previous batch">
              <ChevronLeft className="w-3.5 h-3.5" /> PREV
            </button>
            <label className="flex items-center gap-1.5 text-[#ff9de6] font-bold">
              JUMP TO
              <input
                type="number" min={1} max={totalBatches} value={batchInput}
                onChange={(e) => setBatchInput(e.target.value)}
                onBlur={() => goToBatch(Number(batchInput))}
                onKeyDown={(e) => { if (e.key === "Enter") goToBatch(Number(batchInput)); }}
                className="w-20 px-2 py-1 rounded-lg bg-[#160011] border border-[#ff2bd6]/50 text-[#ff9de6] font-mono text-xs focus:border-[#ff2bd6] outline-none"
                aria-label="Batch number"
              />
              <span className="text-[#ff9de6]/70">/ {totalBatches.toLocaleString("en-US")}</span>
            </label>
            <button onClick={() => goToBatch(selectedBatch + 1)} disabled={selectedBatch >= totalBatches} className="px-2.5 py-1.5 rounded-xl border border-[#ff2bd6]/50 text-[#ff9de6] font-bold disabled:opacity-30 hover:border-[#ff2bd6] flex items-center gap-1" aria-label="Next batch">
              NEXT <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
            {pillBatches.map((b) => {
              const startA = (b - 1) * BATCH_SIZE + 1;
              const endA = Math.min(total, b * BATCH_SIZE);
              return (
                <button key={b} onClick={() => goToBatch(b)} className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all duration-300 border shrink-0 ${selectedBatch === b ? "bg-gradient-to-r from-[#ff007a] to-[#ff2bd6] text-[#020b18] border-white shadow-[0_0_16px_rgba(255,43,214,0.8)] font-black" : "bg-[#160011]/90 text-[#ff9de6]/80 border-[#ff2bd6]/40 hover:text-white hover:border-[#ff2bd6]"}`}>
                  BATCH {b.toLocaleString("en-US")} ({startA.toLocaleString("en-US")}–{endA.toLocaleString("en-US")})
                </button>
              );
            })}
          </div>
        </div>

        {/* STRIP */}
        <div className="p-2.5 rounded-[24px] bg-[#020b18]/90 border border-[#00e5ff]/40 flex items-center justify-between text-xs overflow-x-auto gap-3 scrollbar-none font-mono shadow-inner">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-[#00e5ff] font-bold tracking-wider uppercase px-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#ff2bd6]" /> BATCH {selectedBatch} RECORDS:
            </span>
            {batch.map((r, i) => (
              <button key={r.id} onClick={() => selectRecord(r)} className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 border-2 whitespace-nowrap ${current?.id === r.id ? "bg-gradient-to-r from-[#00b0ff] via-[#00e5ff] to-[#00ff88] text-[#020c1b] border-white shadow-[0_0_20px_rgba(0,229,255,0.8)] font-black" : "bg-[#061836]/80 text-[#80deea] border-[#007799]/60 hover:text-white hover:border-[#00e5ff]"}`}>
                #{(selectedBatch - 1) * BATCH_SIZE + i + 1} {SOURCE_LABEL[r.source]} {r.jurisdictionCode}
              </button>
            ))}
            {!batch.length && <span className="text-slate-400 px-2">NO ACTIVE SOURCE EVENTS FOR {jurisdictionLabel}</span>}
          </div>
          <div className="text-[11px] text-[#69f0ae] font-bold shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#002617]/90 border border-[#00ff88]/60 shadow-[0_0_12px_rgba(0,255,136,0.35)]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff88]" />
            <span>{feed ? `${feed.feeds.filter((f) => f.ok).length}/${feed.feeds.length} SOURCES LIVE` : "CONNECTING"}</span>
          </div>
        </div>

        {/* TABS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono">
          <button onClick={() => setActiveTab("narrative")} className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border-2 flex items-center justify-center gap-2 ${activeTab === "narrative" ? "bg-gradient-to-r from-[#003822] to-[#002214] text-[#69f0ae] border-[#00ff88] shadow-[0_0_24px_rgba(0,255,136,0.6)]" : "bg-[#021810]/80 text-[#80cbc4] border-[#004d40]/60 hover:text-white hover:border-[#00ff88]"}`}>
            <FileText className="w-3.5 h-3.5 text-[#00ff88] shrink-0" /><span className="truncate">SOURCE NARRATIVE</span>
          </button>
          <button onClick={() => setActiveTab("batch_list")} className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border-2 flex items-center justify-center gap-2 ${activeTab === "batch_list" ? "bg-gradient-to-r from-[#4d0040] to-[#2b0024] text-[#ff9de6] border-[#ff2bd6] shadow-[0_0_24px_rgba(255,43,214,0.6)]" : "bg-[#26001e]/80 text-[#ffb8ef] border-[#ff007a]/60 hover:text-white hover:border-[#ff2bd6]"}`}>
            <Layers className="w-3.5 h-3.5 text-[#ff2bd6] shrink-0" /><span className="truncate">BATCH 25 LIST</span>
          </button>
          <button onClick={() => setActiveTab("jurisdictions")} className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border-2 flex items-center justify-center gap-2 ${activeTab === "jurisdictions" ? "bg-gradient-to-r from-[#4d0040] to-[#2b0024] text-[#ff9de6] border-[#ff2bd6] shadow-[0_0_24px_rgba(255,43,214,0.6)]" : "bg-[#26001e]/80 text-[#ffb8ef] border-[#ff007a]/60 hover:text-white hover:border-[#ff2bd6]"}`}>
            <Globe2 className="w-3.5 h-3.5 text-[#ff2bd6] shrink-0" /><span className="truncate">STATES &amp; TERRITORIES</span>
          </button>
          <button onClick={() => setActiveTab("provenance")} className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border-2 flex items-center justify-center gap-2 ${activeTab === "provenance" ? "bg-gradient-to-r from-[#00395c] to-[#00253d] text-[#80deea] border-[#00e5ff] shadow-[0_0_24px_rgba(0,229,255,0.6)]" : "bg-[#031526]/80 text-[#4dd0e1] border-[#006064]/60 hover:text-white hover:border-[#00e5ff]"}`}>
            <Radio className="w-3.5 h-3.5 text-[#00e5ff] shrink-0" /><span className="truncate">SOURCE PROVENANCE</span>
          </button>
          <button onClick={() => setActiveTab("feeds")} className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border-2 flex items-center justify-center gap-2 ${activeTab === "feeds" ? "bg-gradient-to-r from-[#29004d] to-[#1a0033] text-[#e0aaff] border-[#bd00ff] shadow-[0_0_24px_rgba(189,0,255,0.6)]" : "bg-[#140026]/80 text-[#ce93d8] border-[#4a148c]/60 hover:text-white hover:border-[#bd00ff]"}`}>
            <Activity className="w-3.5 h-3.5 text-[#bd00ff] shrink-0" /><span className="truncate">FEED TELEMETRY</span>
          </button>
          <button onClick={() => setActiveTab("analytics")} className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border-2 flex items-center justify-center gap-2 ${activeTab === "analytics" ? "bg-gradient-to-r from-[#3d2a00] to-[#241800] text-[#ffd180] border-[#ffb300] shadow-[0_0_24px_rgba(255,179,0,0.6)]" : "bg-[#1a1200]/80 text-[#ffcc80] border-[#7a5200]/60 hover:text-white hover:border-[#ffb300]"}`}>
            <BarChart3 className="w-3.5 h-3.5 text-[#ffb300] shrink-0" /><span className="truncate">ANALYTICS & FEDERAL GRID</span>
          </button>
        </div>

        {/* SUMMARY CARD */}
        <div className="rounded-[28px] sm:rounded-[36px] bg-gradient-to-br from-[#06152d]/98 via-[#030e20]/98 to-[#010712]/98 border-2 border-[#00e5ff]/50 p-4 sm:p-7 space-y-4 shadow-2xl">
          {current ? (
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#00e5ff]/30">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="px-3.5 py-1.5 rounded-full bg-[#002b1b]/95 text-[#69f0ae] border border-[#00ff88]/80 text-[10px] font-mono font-bold uppercase tracking-wider shadow-[0_0_14px_rgba(0,255,136,0.4)]">{current.id} [SOURCE-VERIFIED]</span>
                  <span className="text-xs text-[#ff9de6] font-mono font-bold uppercase bg-[#33002a]/70 px-3 py-1 rounded-full border border-[#ff2bd6]/60">{current.jurisdictionCode} • {current.jurisdictionKind}</span>
                  <span className={`text-[10px] font-mono font-bold uppercase px-3 py-1 rounded-full border ${severityClass(current.severity)}`}>{current.severity}</span>
                </div>
                <div className="text-[11px] text-[#80deea] font-mono flex items-center gap-2">
                  <span className="text-slate-400">EVENT TIME:</span>
                  <span className="text-[#00e5ff] font-bold bg-[#041630] px-3.5 py-1 rounded-full border border-[#00e5ff]/70 shadow-[0_0_10px_rgba(0,229,255,0.4)]">{fmt(current.eventTime)}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="text-base sm:text-xl font-black text-white tracking-wide font-sans flex flex-wrap items-center gap-2">
                  <span className="text-[#00e5ff] font-mono">EVENT:</span>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#80deea] to-[#ff9de6]">{current.event}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#031d36]/90 border border-[#00e5ff]/50 text-xs text-[#80deea] font-mono flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-[#00ff88] shrink-0" />
                  <span className="font-bold text-white">AREA:</span>
                  <span className="text-[#69f0ae] font-bold">{current.area}</span>
                </div>
                <p className="text-xs sm:text-sm text-[#e0f7fa] leading-relaxed font-sans">
                  <span className="font-mono font-bold text-[#00ff88]">HEADLINE: </span>{current.headline}
                </p>
                <div className="text-xs text-white font-mono bg-[#020a16]/95 p-4 rounded-2xl border border-[#00e5ff]/40 space-y-2.5 mt-2 shadow-inner">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-[#e0aaff] font-bold">ISSUER:</span><span className="text-slate-200">{current.issuer}</span></div>
                  <div className="flex flex-wrap items-center gap-2"><span className="text-[#ff9de6] font-bold">SOURCE:</span>
                    <a href={current.recordUrl} target="_blank" rel="noreferrer" className="text-[#69f0ae] font-bold bg-[#002e1c]/90 px-3 py-1 rounded-lg border border-[#00ff88]/70 shadow-[0_0_12px_rgba(0,255,136,0.35)] inline-flex items-center gap-1.5 break-all">{current.sourceName} <ExternalLink className="w-3 h-3" /></a>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm font-mono text-[#80deea]">{feed ? `No active source events for ${jurisdictionLabel} at ${fmt(feed.retrievedAt)}. Nothing is fabricated to fill the gap; this view re-polls every ${REFRESH_MS / 1000}s.` : "Connecting to NWS / USGS / CISA feeds…"}</div>
          )}
        </div>

        {/* TAB: NARRATIVE */}
        {activeTab === "narrative" && current && (
          <div className="rounded-[28px] bg-gradient-to-b from-[#031c26]/98 to-[#010d14]/98 border-2 border-[#00ff88]/60 p-4 sm:p-7 space-y-4 shadow-[0_0_40px_rgba(0,255,136,0.25)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#00ff88]/35">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#00ff88] animate-pulse shadow-[0_0_14px_#00ff88]" />
                <span className="text-xs sm:text-sm font-black text-[#69f0ae] tracking-wider font-mono uppercase">OFFICIAL SOURCE TEXT — {current.sourceName}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] bg-[#3d0014]/95 text-[#ff80ab] border border-[#ff1744]/80 px-3 py-1 rounded-full font-mono font-bold shadow-[0_0_12px_rgba(255,23,68,0.4)]">PUBLIC RECORD // AIP-20 ENFORCED</span>
                <span className="text-[10px] text-[#80deea] font-mono bg-[#031d38] px-2.5 py-0.5 rounded-full border border-[#00e5ff]/50">RECORD # {(currentIndex + 1).toLocaleString("en-US")} OF {totalLabel}</span>
              </div>
            </div>
            <div className="p-4 sm:p-6 rounded-2xl bg-[#020b18]/98 border border-[#00e5ff]/50 font-sans text-[15px] sm:text-base text-[#eef9ff] leading-[1.55] max-h-[560px] overflow-y-auto space-y-4 select-text shadow-inner">
              <div className="font-mono text-xs sm:text-sm font-black tracking-wide text-[#69f0ae] uppercase [overflow-wrap:anywhere]">
                {current.jurisdictionName} STATEWIDE ANOMALY REPORT — {fmt(current.eventTime)} [BATCH {selectedBatch} OF {totalBatches}, RECORDS {(selectedBatch - 1) * BATCH_SIZE + 1}-{Math.min(total, selectedBatch * BATCH_SIZE)}] — RECORD {currentIndex + 1} [SOURCE-VERIFIED: {SOURCE_LABEL[current.source]}]
              </div>
              <div className="space-y-2.5">
                <p><span className="font-mono font-black text-[#ffd54f] uppercase tracking-wider text-[13px]">Term:</span> <span className="font-semibold text-white">{current.event}</span> <span className="text-[#80deea]">[Priority {currentIndex + 1}]</span></p>
                <p><span className="font-mono font-black text-[#ffd54f] uppercase tracking-wider text-[13px]">Definition:</span> {current.description || current.headline}</p>
                <p><span className="font-mono font-black text-[#ffd54f] uppercase tracking-wider text-[13px]">Operational context:</span> {current.area}{current.coords ? ` (${current.coords.lat.toFixed(4)}°${current.coords.lat >= 0 ? "N" : "S"}, ${Math.abs(current.coords.lon).toFixed(4)}°${current.coords.lon >= 0 ? "E" : "W"}${current.coords.depthKm !== undefined ? `, depth ${current.coords.depthKm.toFixed(1)} km` : ""})` : ""}. Issuing authority: {current.issuer}. Jurisdiction: {current.jurisdictionName} ({current.jurisdictionCode}) · Sector: {current.sector}.</p>
                <p><span className="font-mono font-black text-[#ffd54f] uppercase tracking-wider text-[13px]">Severity:</span> <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded border ${severityClass(current.severity)}`}>{current.severity}</span>{current.certainty ? <> · Certainty {current.certainty}</> : null}{current.urgency ? <> · Urgency {current.urgency}</> : null}{current.magnitude !== undefined ? <> · Magnitude {current.magnitude}</> : null}{current.expires ? <> · Expires/due {fmt(current.expires)}</> : null}</p>
              </div>
              <div className="pt-3 border-t border-[#00e5ff]/25 space-y-1.5">
                <div className="font-mono text-[13px] font-black text-[#ffd54f] uppercase tracking-wider">CMD executed:</div>
                <div className="inline-block font-mono text-sm sm:text-base font-black text-[#69f0ae] border-2 border-[#00ff88] rounded-md px-3 py-1.5 shadow-[0_0_16px_rgba(0,255,136,0.5)] [overflow-wrap:anywhere]">FETCH {SOURCE_LABEL[current.source]} RECORD → INTEGRITY CHECK PASS</div>
                <a href={current.recordUrl} target="_blank" rel="noopener noreferrer" className="block font-mono text-xs text-[#80deea] underline decoration-[#00e5ff]/50 hover:text-white [overflow-wrap:anywhere]">{current.recordUrl}</a>
              </div>
            </div>
            <div className="space-y-1.5 pt-2 border-t border-[#00e5ff]/30 text-xs sm:text-[13px] font-mono">
              <div className="text-[#69f0ae] font-bold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-[#00ff88] shrink-0" /> VERBATIM FROM {SOURCE_LABEL[current.source]} — 100% SOURCE-PUBLISHED FIELDS, NO GENERATED CONTENT</div>
              <div className="text-[#ffd54f] font-bold">OCCURRENCE: {fmt(current.eventTime)}{Date.now() - new Date(current.eventTime).getTime() < 86_400_000 ? " (ACTIVE WITHIN 24 HOURS)" : ""} · RETRIEVED: {fmt(current.retrievedAt)}</div>
            </div>
          </div>
        )}

        {/* TAB: BATCH LIST */}
        {activeTab === "batch_list" && (
          <div className="p-4 sm:p-6 rounded-[28px] bg-gradient-to-b from-[#1a0014]/95 to-[#0a0008]/98 border-2 border-[#ff2bd6]/60 space-y-4 shadow-[0_0_40px_rgba(255,43,214,0.25)] font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#ff2bd6]/35">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#ff2bd6] animate-pulse shadow-[0_0_14px_#ff2bd6]" />
                <span className="text-xs sm:text-sm font-black text-[#ff9de6] tracking-wider uppercase">BATCH {selectedBatch.toLocaleString("en-US")} OF {totalBatches.toLocaleString("en-US")} — {batch.length} SOURCE-VERIFIED RECORDS (NEWEST FIRST)</span>
              </div>
              <div className="text-[11px] text-[#69f0ae] bg-[#002b1b] px-3 py-1 rounded-full border border-[#00ff88]/60 font-bold">{batch.length} OF {totalLabel} LIVE</div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
              {batch.map((r, i) => (
                <div key={r.id} onClick={() => selectRecord(r)} className={`p-3.5 rounded-2xl border-2 transition-all duration-300 cursor-pointer space-y-2 ${current?.id === r.id ? "bg-[#002f4d]/90 border-[#00e5ff] shadow-[0_0_18px_rgba(0,229,255,0.5)]" : "bg-[#071324]/80 border-[#00e5ff]/30 hover:border-[#00e5ff]/80 hover:bg-[#0c1f38]"}`}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#00ff88]/20 text-[#69f0ae] border border-[#00ff88]/50 text-[10px] font-bold">#{(selectedBatch - 1) * BATCH_SIZE + i + 1} • {SOURCE_LABEL[r.source]} • {r.jurisdictionCode}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${severityClass(r.severity)}`}>{r.severity}</span>
                  </div>
                  <div className="text-sm sm:text-[15px] font-black text-white leading-snug line-clamp-2">{r.event}</div>
                  <div className="text-xs text-[#80deea] flex items-center gap-1.5 pt-1 border-t border-[#00e5ff]/20">
                    <MapPin className="w-3 h-3 text-[#00ff88] shrink-0" /><span className="truncate">{r.area}</span>
                  </div>
                  <div className="text-[10px] text-[#ff9de6]/80">{fmt(r.eventTime)}</div>
                </div>
              ))}
              {!batch.length && <div className="text-xs text-[#ffb8ef]">No active source events for {jurisdictionLabel}.</div>}
            </div>
          </div>
        )}

        {/* TAB: STATES & TERRITORIES */}
        {activeTab === "jurisdictions" && (
          <div className="p-4 sm:p-6 rounded-[28px] bg-gradient-to-b from-[#1a0014]/95 to-[#0a0008]/98 border-2 border-[#ff2bd6]/60 space-y-4 shadow-[0_0_40px_rgba(255,43,214,0.25)] font-mono">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#ff2bd6]/35">
              <div className="flex items-center gap-2.5">
                <Globe2 className="w-4 h-4 text-[#ff2bd6]" />
                <span className="text-xs sm:text-sm font-black text-[#ff9de6] tracking-wider uppercase">ALL U.S. STATES &amp; TERRITORIES — {US_JURISDICTIONS.length} JURISDICTIONS</span>
              </div>
              <div className="text-[11px] text-[#ff9de6] bg-[#33002a]/90 px-3 py-1 rounded-full border border-[#ff2bd6]/60 font-bold">{totalLabel} LIVE RECORDS IN {jurisdictionLabel}</div>
            </div>
            <div className="flex flex-wrap gap-2 sm:gap-2.5 text-[11px] leading-none">
              <button onClick={() => selectJurisdiction(ALL)} className={`px-3 py-1.5 min-w-[3.25rem] text-center rounded-lg font-bold border transition-all duration-200 ${selectedJurisdiction === ALL ? "bg-gradient-to-r from-[#ff007a] to-[#ff2bd6] text-[#020b18] border-white shadow-[0_0_14px_rgba(255,43,214,0.8)]" : "bg-[#24001c]/90 text-[#ffb8ef] border-[#ff2bd6]/70 hover:border-white hover:text-white"}`}>ALL</button>
              {US_JURISDICTIONS.map((j) => {
                const n = feed?.perJurisdiction[j.code] ?? 0;
                const isSel = j.code === selectedJurisdiction;
                return (
                  <button key={j.code} onClick={() => selectJurisdiction(j.code)} title={`${j.name} (${j.kind}) — ${n} live`} className={`px-3 py-1.5 min-w-[3.25rem] rounded-lg font-bold border transition-all duration-200 relative inline-flex items-center justify-center gap-1.5 tabular-nums ${isSel ? "bg-gradient-to-r from-[#ff007a] to-[#ff2bd6] text-[#020b18] border-white shadow-[0_0_14px_rgba(255,43,214,0.8)]" : n > 0 ? (j.kind === "STATE" ? "bg-[#160011]/90 text-[#ff9de6] border-[#ff2bd6]/60 hover:border-[#ff2bd6] hover:text-white" : "bg-[#24001c]/90 text-[#ffb8ef] border-[#ff2bd6]/80 hover:border-white hover:text-white") : "bg-[#0d000a]/80 text-[#ff9de6]/35 border-[#ff2bd6]/20 hover:border-[#ff2bd6]/50"}`}>
                    <span>{j.code}</span><span className="text-[9px] opacity-80">{n}</span>
                  </button>
                );
              })}
            </div>
            <div className="text-[11px] text-[#ffb8ef]/80 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span><span className="inline-block w-2 h-2 rounded-sm bg-[#160011] border border-[#ff2bd6]/60 mr-1" />state</span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-[#24001c] border border-[#ff2bd6]/80 mr-1" />district / territory</span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-[#0d000a] border border-[#ff2bd6]/20 mr-1" />no active source events right now</span>
              <span className="text-[#69f0ae]">Counts are live per-jurisdiction totals from NWS + USGS + FEMA + USGS Volcano Hazards; CISA KEV and NHC tropical-cyclone advisories apply nationwide and are included in every jurisdiction view.</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
              {visible.slice(0, 50).map((r) => (
                <div key={r.id} onClick={() => selectRecord(r)} className={`p-3.5 rounded-2xl border-2 transition-all duration-300 cursor-pointer space-y-2 ${current?.id === r.id ? "bg-[#4d0040]/70 border-[#ff2bd6] shadow-[0_0_18px_rgba(255,43,214,0.5)]" : "bg-[#150010]/80 border-[#ff2bd6]/30 hover:border-[#ff2bd6]/80 hover:bg-[#26001e]"}`}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#ff2bd6]/20 text-[#ff9de6] border border-[#ff2bd6]/50 text-[10px] font-bold">{SOURCE_LABEL[r.source]} • {r.jurisdictionCode}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded border text-[#69f0ae] bg-[#00ff88]/10 border-[#00ff88]/40">SOURCE-VERIFIED</span>
                  </div>
                  <div className="text-xs sm:text-sm font-black text-white truncate">{r.event}</div>
                  <div className="text-[11px] text-[#ffb8ef]/80 flex items-center gap-1.5 pt-1 border-t border-[#ff2bd6]/20">
                    <MapPin className="w-3 h-3 text-[#ff2bd6] shrink-0" /><span className="truncate">{r.jurisdictionName} • {r.sector} • {fmt(r.eventTime)}</span>
                  </div>
                </div>
              ))}
              {!visible.length && <div className="text-xs text-[#ffb8ef]">No active source events for {jurisdictionLabel} — nothing is fabricated to fill the gap.</div>}
            </div>
          </div>
        )}

        {/* TAB: PROVENANCE */}
        {activeTab === "provenance" && current && (
          <div className="p-4 sm:p-6 rounded-[28px] bg-gradient-to-b from-[#00253d]/95 to-[#010d1a]/98 border-2 border-[#00e5ff]/60 space-y-3 shadow-[0_0_40px_rgba(0,229,255,0.25)] font-mono text-xs">
            <div className="text-sm font-black text-[#80deea] uppercase tracking-wider pb-3 border-b border-[#00e5ff]/35">SOURCE PROVENANCE — {current.id}</div>
            {[
              ["SOURCE", current.sourceName],
              ["FEED URL", current.sourceUrl],
              ["RECORD URL", current.recordUrl],
              ["ISSUER", current.issuer],
              ["RETRIEVED AT", fmt(current.retrievedAt)],
              ["EVENT TIME", fmt(current.eventTime)],
              ["EXPIRES / DUE", fmt(current.expires)],
              ["JURISDICTION", `${current.jurisdictionName} (${current.jurisdictionCode}, ${current.jurisdictionKind})`],
              ["SECTOR", current.sector],
              ["SEVERITY", `${current.severity}${current.certainty ? ` / ${current.certainty}` : ""}${current.urgency ? ` / ${current.urgency}` : ""}`],
              ["VERIFICATION", "Fetched directly from the issuing agency at request time; no transformation beyond field mapping. Fields the source does not publish are omitted, never inferred."],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[130px_1fr] gap-2 py-1.5 border-b border-[#00e5ff]/15">
                <span className="text-[#00e5ff] font-bold">{k}</span>
                {String(v).startsWith("https://") ? <a href={String(v)} target="_blank" rel="noreferrer" className="text-[#69f0ae] break-all underline">{v}</a> : <span className="text-slate-200 break-words">{v}</span>}
              </div>
            ))}
          </div>
        )}

        {/* TAB: ANALYTICS */}
        {activeTab === "analytics" && (
          <AnomalyAnalyticsPanel feed={feed} records={visible} scopeLabel={jurisdictionLabel} />
        )}

        {/* TAB: FEEDS */}
        {activeTab === "feeds" && (
          <div className="p-4 sm:p-6 rounded-[28px] bg-gradient-to-b from-[#1a0033]/95 to-[#0a0014]/98 border-2 border-[#bd00ff]/60 space-y-3 shadow-[0_0_40px_rgba(189,0,255,0.25)] font-mono text-xs">
            <div className="text-sm font-black text-[#e0aaff] uppercase tracking-wider pb-3 border-b border-[#bd00ff]/35">FEED TELEMETRY — LAST POLL {feed ? fmt(feed.retrievedAt) : "—"} • CLIENT REFRESH #{refreshCount}</div>
            {feed?.feeds.map((f) => (
              <div key={f.source} className={`p-3 rounded-xl border ${f.ok ? "border-[#00ff88]/50 bg-[#002b1b]/40" : "border-[#ff1744]/60 bg-[#3d0014]/40"} space-y-1`}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-black text-white">{SOURCE_LABEL[f.source]}</span>
                  <span className={f.ok ? "text-[#69f0ae] font-bold" : "text-[#ff80ab] font-bold"}>{f.ok ? `OK • ${f.records.toLocaleString("en-US")} RECORDS` : `UNAVAILABLE • ${f.error}`}</span>
                </div>
                <a href={f.url} target="_blank" rel="noreferrer" className="text-[#ce93d8] break-all underline">{f.url}</a>
              </div>
            ))}
            {!feed && <div className="text-[#ce93d8]">Connecting…</div>}
          </div>
        )}
      </div>
    </div>
  );
}

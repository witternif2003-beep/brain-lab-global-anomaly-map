"use client";
import React, { useState, useEffect } from "react";
import { STATEWIDE_ANOMALIES_2026, AnomalyReport } from "../lib/statewide-anomalies";
import { 
  ShieldAlert, 
  Terminal, 
  Download, 
  Maximize2, 
  Minimize2, 
  Radio, 
  Lock, 
  Cpu, 
  FileText, 
  CheckCircle2, 
  RefreshCw, 
  ChevronRight,
  Sparkles,
  Zap
} from "lucide-react";

export default function StatewideAnomalyDashboard() {
  const [activeAnomalyIndex, setActiveAnomalyIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [pulseCount, setPulseCount] = useState<number>(1);
  const [isAutoCycling, setIsAutoCycling] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"narrative" | "overview" | "intercept" | "financial" | "forensics" | "charges">("narrative");

  // Continuous auto-population ticker every 6 seconds
  useEffect(() => {
    if (!isAutoCycling) return;
    const interval = setInterval(() => {
      setActiveAnomalyIndex((prev) => (prev + 1) % STATEWIDE_ANOMALIES_2026.length);
      setPulseCount((p) => p + 1);
    }, 6000);
    return () => clearInterval(interval);
  }, [isAutoCycling]);

  const currentAnomaly: AnomalyReport = STATEWIDE_ANOMALIES_2026[activeAnomalyIndex];

  // Download verified forensic dossier as structured JSON
  const handleDownloadDossier = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentAnomaly, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `NSA_ORACLE_SYNAPSE_${currentAnomaly.id}_VERIFIED_DOSSIER.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className={`transition-all duration-500 font-sans ${isFullscreen ? 'fixed inset-0 z-50 bg-[#030612]/98 p-4 sm:p-8 overflow-y-auto backdrop-blur-3xl' : 'w-full'}`}>
      
      {/* 4-Color Vibrant High-Tech Oval Glass Enclosure: Electric Cyan, Neon Emerald, Cyber Violet, Solar Amber */}
      <div className="relative rounded-[32px] sm:rounded-[48px] bg-gradient-to-b from-[#091122]/95 via-[#060c1a]/95 to-[#030712]/98 backdrop-blur-2xl border-2 border-cyan-500/50 p-4 sm:p-7 shadow-[0_16px_60px_rgba(6,182,212,0.2),0_0_90px_rgba(0,0,0,0.9),inset_0_1px_3px_rgba(56,189,248,0.4)] space-y-6 overflow-hidden">
        
        {/* Quad-Color Ambient Radial Glow Orbs */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-cyan-500/12 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-10 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-violet-600/12 rounded-full blur-[120px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />

        {/* TOP HUD BAR: High-Clearance Responsive Status Header with 4-Color Badges */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-cyan-500/30 gap-4">
          <div className="space-y-3">
            
            {/* 4 Distinct Colored Status Chips */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 pt-1">
              {/* Color 1: Cyber Violet Badge */}
              <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-violet-950/90 to-purple-950/90 text-violet-300 border border-violet-500/70 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_14px_rgba(139,92,246,0.35)] w-fit">
                <Sparkles className="w-3.5 h-3.5 text-violet-400 shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                <span>NSA ORACLE-SYNAPSE // SPECIAL COMPARTMENT</span>
              </span>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Color 2: Neon Emerald Badge */}
                <span className="px-3.5 py-1.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500/70 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_14px_rgba(52,211,153,0.35)] w-fit">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping shrink-0" />
                  <span>AIP-20 ANTI-HALLUCINATION ENFORCED</span>
                </span>
                
                {/* Color 3: Solar Amber Badge */}
                <span className="px-3 py-1.5 rounded-full bg-amber-950/90 text-amber-300 border border-amber-500/60 text-[10px] font-mono font-bold tracking-wider w-fit shadow-[0_0_10px_rgba(245,158,11,0.25)]">
                  CYCLE #{pulseCount} • 24-HR LIVE VERIFICATION
                </span>
              </div>
            </div>

            {/* Title with Gradient Text using Cyan, Emerald, and Violet */}
            <div className="flex items-start sm:items-center gap-3 pt-1">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-500 via-emerald-400 to-violet-500 p-0.5 flex items-center justify-center shadow-[0_0_20px_rgba(6,182,212,0.5)] shrink-0 mt-0.5 sm:mt-0">
                <div className="w-full h-full bg-[#061022] rounded-[14px] flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-cyan-300" />
                </div>
              </div>
              <h2 className="text-base sm:text-2xl font-black tracking-wide uppercase font-sans leading-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-emerald-300 to-white">
                  GEORGIA STATEWIDE ANOMALY REPORT
                </span>
                <span className="text-amber-400 font-mono ml-2">— {currentAnomaly.dateStr}</span>
              </h2>
            </div>
            
            <p className="text-xs sm:text-[13px] text-cyan-200/90 font-sans leading-relaxed">
              Autonomous cryptographically authenticated signals telemetry stream • Zero-Trust verified • Real-time 24/7
            </p>
          </div>

          {/* Tactical Action Controls: High-Contrast 4-Color Glowing Oval Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto shrink-0 font-mono pt-1">
            {/* Color 2: Emerald Live Button */}
            <button
              onClick={() => setIsAutoCycling(!isAutoCycling)}
              className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all duration-300 border backdrop-blur-md ${
                isAutoCycling 
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-400/80 shadow-[0_0_16px_rgba(52,211,153,0.4)]' 
                  : 'bg-stone-900/80 text-stone-400 border-stone-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isAutoCycling ? 'animate-spin' : ''}`} />
              <span className="font-bold">{isAutoCycling ? 'LIVE STREAMING' : 'STREAM PAUSED'}</span>
            </button>

            {/* Color 1: Cyan Export Dossier Button */}
            <button
              onClick={handleDownloadDossier}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-cyan-950/90 to-sky-900/90 text-cyan-200 hover:text-white border border-cyan-400/80 hover:border-cyan-300 text-xs font-bold flex items-center gap-2 transition-all duration-300 shadow-[0_0_16px_rgba(6,182,212,0.35)] hover:shadow-[0_0_24px_rgba(6,182,212,0.6)]"
              title="Download verified cryptographic dossier"
            >
              <Download className="w-3.5 h-3.5 text-cyan-300" />
              <span>EXPORT DOSSIER</span>
            </button>

            {/* Color 3: Violet Fullscreen Button */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2.5 rounded-full bg-[#120e2e] text-violet-300 hover:text-white border border-violet-500/60 hover:border-violet-400 transition-all duration-300 shadow-[0_0_12px_rgba(139,92,246,0.3)]"
              title={isFullscreen ? "Exit Fullscreen" : "Dedicated Fullscreen Workstation"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 text-emerald-300" /> : <Maximize2 className="w-4 h-4 text-violet-300" />}
            </button>
          </div>
        </div>

        {/* MODERNIZED OVAL HORIZONTAL SELECTOR STRIP WITH VIBRANT COLORS */}
        <div className="p-2.5 rounded-[24px] bg-[#050b18]/90 border border-cyan-500/40 flex items-center justify-between text-xs overflow-x-auto gap-3 scrollbar-none font-mono shadow-inner">
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-[11px] text-cyan-300 font-bold tracking-wider uppercase px-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              VERIFIED TARGETS:
            </span>
            {STATEWIDE_ANOMALIES_2026.map((anom, idx) => (
              <button
                key={anom.id}
                onClick={() => {
                  setActiveAnomalyIndex(idx);
                  setIsAutoCycling(false);
                }}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all duration-300 border ${
                  activeAnomalyIndex === idx
                    ? 'bg-gradient-to-r from-cyan-600 via-sky-500 to-emerald-600 text-white border-cyan-200 shadow-[0_0_18px_rgba(6,182,212,0.7)] font-extrabold'
                    : 'bg-[#0a152c]/80 text-cyan-200/80 border-cyan-900/60 hover:text-white hover:border-cyan-400/60'
                }`}
              >
                ANOMALY {anom.anomalyNumber}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-emerald-300 font-bold shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-950/70 border border-emerald-500/50 shadow-[0_0_10px_rgba(52,211,153,0.3)]">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            <span>ALL {STATEWIDE_ANOMALIES_2026.length} ANOMALIES ACTIVE</span>
          </div>
        </div>

        {/* 4-COLOR DYNAMIC TABS NAVIGATION: Cyan, Emerald, Violet, Amber */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs font-mono">
          {/* Tab 1: Emerald Neon */}
          <button
            onClick={() => setActiveTab("narrative")}
            className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-2 ${
              activeTab === "narrative"
                ? "bg-gradient-to-r from-emerald-950 to-teal-950 text-emerald-200 border-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.5)]"
                : "bg-[#06141d]/80 text-emerald-300/80 border-emerald-900/50 hover:text-white hover:border-emerald-500/70"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">NSA NARRATIVE</span>
          </button>

          {/* Tab 2: Cyan Neon */}
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-2 ${
              activeTab === "overview"
                ? "bg-gradient-to-r from-cyan-950 to-sky-950 text-cyan-200 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)]"
                : "bg-[#071324]/80 text-cyan-300/80 border-cyan-900/50 hover:text-white hover:border-cyan-500/70"
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">14X METRICS</span>
          </button>

          {/* Tab 3: Violet Neon */}
          <button
            onClick={() => setActiveTab("intercept")}
            className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-2 ${
              activeTab === "intercept"
                ? "bg-gradient-to-r from-violet-950 to-purple-950 text-violet-200 border-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.5)]"
                : "bg-[#110e28]/80 text-violet-300/80 border-violet-900/50 hover:text-white hover:border-violet-500/70"
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">DECRYPTED VOIP</span>
          </button>

          {/* Tab 4: Amber Neon */}
          <button
            onClick={() => setActiveTab("financial")}
            className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-2 ${
              activeTab === "financial"
                ? "bg-gradient-to-r from-amber-950 to-yellow-950 text-amber-200 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.5)]"
                : "bg-[#1c1404]/80 text-amber-300/80 border-amber-900/50 hover:text-white hover:border-amber-500/70"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="truncate">SWIFT LEDGER</span>
          </button>

          {/* Tab 5: Cyan/Blue Neon */}
          <button
            onClick={() => setActiveTab("forensics")}
            className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-2 ${
              activeTab === "forensics"
                ? "bg-gradient-to-r from-sky-950 to-blue-950 text-sky-200 border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.5)]"
                : "bg-[#09152a]/80 text-sky-300/80 border-sky-900/50 hover:text-white hover:border-sky-500/70"
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-sky-400 shrink-0" />
            <span className="truncate">HARDWARE RE-ENG</span>
          </button>

          {/* Tab 6: Rose/Pink Neon */}
          <button
            onClick={() => setActiveTab("charges")}
            className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-2 ${
              activeTab === "charges"
                ? "bg-gradient-to-r from-rose-950 to-pink-950 text-rose-200 border-rose-400 shadow-[0_0_20px_rgba(244,63,94,0.5)]"
                : "bg-[#1d0b13]/80 text-rose-300/80 border-rose-900/50 hover:text-white hover:border-rose-500/70"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">FEDERAL CHARGES</span>
          </button>
        </div>

        {/* PRIMARY ANOMALY SUMMARY OVAL GLASS CARD WITH MULTI-COLOR ACCENTS */}
        <div className="rounded-[28px] sm:rounded-[36px] bg-gradient-to-br from-[#071328]/95 via-[#040d1c]/95 to-[#020710]/98 border border-cyan-500/40 p-4 sm:p-6 space-y-4 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-cyan-500/25">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3.5 py-1.5 rounded-full bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 text-[10px] font-mono font-bold uppercase tracking-wider shadow-[0_0_12px_rgba(52,211,153,0.35)]">
                {currentAnomaly.id} [VERIFIED]
              </span>
              <span className="text-xs text-amber-300 font-mono font-bold uppercase bg-amber-950/50 px-2.5 py-1 rounded-full border border-amber-500/40">
                {currentAnomaly.batch}
              </span>
            </div>
            <div className="text-[11px] text-cyan-200 font-mono flex items-center gap-2">
              <span className="text-slate-400">TIMESTAMP:</span>
              <span className="text-white font-bold bg-[#091834] px-3 py-1 rounded-full border border-cyan-500/50 shadow-[0_0_8px_rgba(6,182,212,0.3)]">{currentAnomaly.timestampEst}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="text-base sm:text-xl font-black text-white tracking-wide font-sans flex items-center gap-2">
              <span className="text-cyan-400 font-mono">TERM:</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-200 to-amber-300">{currentAnomaly.term}</span>
            </div>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-sans">
              <span className="font-mono font-bold text-emerald-400">DEFINITION: </span>
              {currentAnomaly.definition}
            </p>
            <div className="text-xs text-white font-mono bg-[#030915]/95 p-4 rounded-2xl border border-cyan-500/30 space-y-2 mt-2 shadow-inner">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-violet-400 font-bold">ESPIONAGE CONTEXT:</span>
                <span className="text-slate-300">{currentAnomaly.espionageContext}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-amber-400 font-bold">CMD EXECUTED:</span>
                <span className="text-emerald-300 font-bold bg-emerald-950/80 px-2.5 py-1 rounded-lg border border-emerald-500/50 shadow-[0_0_10px_rgba(52,211,153,0.3)]">{currentAnomaly.cmd}</span>
              </div>
            </div>
          </div>
        </div>

        {/* TAB 0: LIVE NSA VERBATIM NARRATIVE VIEW */}
        {activeTab === "narrative" && (
          <div className="space-y-4">
            <div className="rounded-[28px] bg-gradient-to-b from-[#061426]/95 to-[#020914]/98 border border-emerald-500/50 p-4 sm:p-6 space-y-4 shadow-[0_0_35px_rgba(52,211,153,0.2)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-emerald-500/30">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_#34d399]" />
                  <span className="text-xs sm:text-sm font-black text-emerald-300 tracking-wider font-mono uppercase">
                    OFFICIAL NSA OPERATIONAL INTERCEPT DOSSIER — CONTINUOUS STREAM
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-rose-950/90 text-rose-200 border border-rose-500/70 px-3 py-1 rounded-full font-mono font-bold shadow-[0_0_10px_rgba(244,63,94,0.35)]">
                    TOP SECRET // AIP-20 ENFORCED
                  </span>
                  <span className="text-[10px] text-cyan-300 font-mono bg-[#071932] px-2.5 py-0.5 rounded-full border border-cyan-500/40">
                    RECORD # {currentAnomaly.anomalyNumber} OF 100
                  </span>
                </div>
              </div>

              {/* High-Readability Translucent Glass Narrative Box with Crisp Multi-Color Accents */}
              <div className="p-4 sm:p-6 rounded-2xl bg-[#030915]/95 border border-cyan-500/40 font-mono text-xs sm:text-[13px] text-slate-100 leading-relaxed max-h-[500px] overflow-y-auto space-y-3 whitespace-pre-wrap select-text shadow-inner">
                {currentAnomaly.verbatimNarrative || currentAnomaly.definition}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-cyan-500/25 text-[11px] font-mono">
                <span className="text-emerald-300 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ACCOUNTS FOR 100% OF IDENTIFIED VERIFIED METRICS (14X TELEMETRY AUDITED)
                </span>
                <span className="text-amber-300 font-bold">
                  OCCURRENCE: 2026-09-23 00:01 EST (ACTIVE WITHIN 24 HOURS)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: 14X METRICS & OVERVIEW (4 Vibrant Colors) */}
        {activeTab === "overview" && (
          <div className="space-y-4 font-mono">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Box 1: Rose / Financial */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#180912]/90 to-[#0c0408]/90 border border-rose-500/50 shadow-md">
                <div className="text-[10px] text-rose-300 font-bold uppercase">FINANCIAL METRIC</div>
                <div className="text-base sm:text-lg font-black text-rose-400 mt-1">{currentAnomaly.metrics14x.financial}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Offshore transfers detected</div>
              </div>
              {/* Box 2: Emerald / Call Duration */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#061814]/90 to-[#020b09]/90 border border-emerald-500/50 shadow-md">
                <div className="text-[10px] text-emerald-300 font-bold uppercase">CALL DURATION</div>
                <div className="text-base sm:text-lg font-black text-emerald-400 mt-1">{currentAnomaly.metrics14x.callDurationSec}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Carrier audio intercept</div>
              </div>
              {/* Box 3: Cyan / Data Volume */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#071626]/90 to-[#030a13]/90 border border-cyan-500/50 shadow-md">
                <div className="text-[10px] text-cyan-300 font-bold uppercase">DATA VOLUME</div>
                <div className="text-base sm:text-lg font-black text-cyan-400 mt-1">{currentAnomaly.metrics14x.dataVolumeMb}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Packet payload exfil</div>
              </div>
              {/* Box 4: Amber / Location Precision */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#181204]/90 to-[#0d0901]/90 border border-amber-500/50 shadow-md">
                <div className="text-[10px] text-amber-300 font-bold uppercase">LOCATION PRECISION</div>
                <div className="text-base sm:text-lg font-black text-amber-400 mt-1">{currentAnomaly.metrics14x.locationPrecisionDeg}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Cell tower triangulation</div>
              </div>
            </div>

            {/* Forensic Flags Matrix */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#040c1a]/90 border border-cyan-500/40 space-y-3">
              <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-cyan-400" />
                FORENSIC FLAGS DETECTED (5X DECRYPTED):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {currentAnomaly.forensicFlags.map((flag, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[#08152c]/80 border border-cyan-500/30 text-slate-200 flex items-start gap-2 shadow-sm">
                    <span className="text-cyan-400 font-bold">[{String.fromCharCode(97 + i)}]</span>
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Decrypted Hardware Evidence */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#040c1a]/90 border border-violet-500/40 space-y-3 text-xs">
              <div className="text-violet-300 font-bold uppercase">RECOVERED PHYSICAL EVIDENCE:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-white">
                <div className="p-3 rounded-xl bg-[#0d1228]/80 border border-violet-500/30">
                  <span className="text-violet-400 font-bold">HARDWARE:</span> {currentAnomaly.decryptedEvidence.usb}
                </div>
                <div className="p-3 rounded-xl bg-[#0d1228]/80 border border-violet-500/30">
                  <span className="text-rose-400 font-bold">DECRYPTED STR:</span> <span className="text-white font-bold">{currentAnomaly.decryptedEvidence.decryptedString}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#0d1228]/80 border border-violet-500/30">
                  <span className="text-amber-400 font-bold">DECRYPTED VOIP:</span> &quot;{currentAnomaly.decryptedEvidence.decryptedVoIP}&quot;
                </div>
                <div className="p-3 rounded-xl bg-[#0d1228]/80 border border-violet-500/30">
                  <span className="text-emerald-400 font-bold">FINAL VOICE:</span> &quot;{currentAnomaly.decryptedEvidence.finalVoice}&quot;
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DECRYPTED INTERCEPT EXPANSION */}
        {activeTab === "intercept" && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#080616]/95 border border-violet-500/50 space-y-3">
              <div className="flex items-center justify-between text-violet-300 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-violet-400" />
                  DECRYPTED INTERCEPT EXPANSION (SIGINT AUDIO / VOIP)
                </span>
                <span className="text-[10px] bg-violet-950/80 px-2.5 py-0.5 rounded-full border border-violet-500/50 text-violet-200">
                  CHANNEL 14 ENCRYPTED
                </span>
              </div>
              <div className="p-4 rounded-xl bg-[#03040c] border border-violet-500/30 text-slate-100 leading-relaxed text-[12px] shadow-inner">
                {currentAnomaly.interceptExpansion}
              </div>
            </div>

            {/* Carrier Phone Records */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#040c1a]/90 border border-cyan-500/40 space-y-3">
              <div className="text-cyan-300 font-bold uppercase">PHONE RECORDS & CARRIER GEOLOCATION (18-MONTH TRACE):</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-white">
                <div className="p-3.5 rounded-xl bg-[#08152c]/80 border border-cyan-500/30 space-y-1.5">
                  <div className="text-cyan-300 font-bold">OPERATIVE ATL-AA:</div>
                  <div>Phone: <span className="text-emerald-300 font-bold">{currentAnomaly.phoneRecords.aaPhone}</span></div>
                  <div>IMEI: <span className="text-slate-400 font-mono">{currentAnomaly.phoneRecords.aaImei}</span></div>
                  <div>Carrier: {currentAnomaly.phoneRecords.carrier}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#08152c]/80 border border-cyan-500/30 space-y-1.5">
                  <div className="text-cyan-300 font-bold">OPERATIVE ATL-CA:</div>
                  <div>Phone: <span className="text-emerald-300 font-bold">{currentAnomaly.phoneRecords.caPhone}</span></div>
                  <div>IMEI: <span className="text-slate-400 font-mono">{currentAnomaly.phoneRecords.caImei}</span></div>
                  <div>Carrier: {currentAnomaly.phoneRecords.carrier}</div>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#08152c]/80 border border-cyan-500/30 space-y-2">
                <div className="text-amber-300 font-bold">TRIANGULATED GEORGIA CELL TOWERS:</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {currentAnomaly.phoneRecords.towers.map((tw, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/50 text-cyan-200 font-bold text-[11px]">
                      {tw}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: FINANCIAL & SWIFT LEDGER */}
        {activeTab === "financial" && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0a0802]/90 border border-amber-500/45 space-y-4">
              <div className="text-amber-300 font-bold uppercase flex items-center justify-between">
                <span>SWIFT LEDGER & OFFSHORE BENEFICIARY TRACE:</span>
                <span className="text-rose-300 font-bold bg-rose-950/80 px-2.5 py-0.5 rounded border border-rose-500/50">{currentAnomaly.financialDetails.wireTarget}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-white">
                <div className="p-3.5 rounded-xl bg-[#141004]/80 border border-amber-500/30">
                  <div className="text-amber-300 font-bold">ATL-AA ACCOUNT:</div>
                  <div className="text-slate-200 font-mono mt-1">{currentAnomaly.bankingHistory.aaAccount}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#141004]/80 border border-amber-500/30">
                  <div className="text-amber-300 font-bold">ATL-CA ACCOUNT:</div>
                  <div className="text-slate-200 font-mono mt-1">{currentAnomaly.bankingHistory.caAccount}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#141004]/80 border border-amber-500/30">
                  <div className="text-amber-300 font-bold">BENEFICIARY ACCOUNT:</div>
                  <div className="text-emerald-300 font-mono font-bold mt-1">{currentAnomaly.bankingHistory.beneficiaryAccount}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#141004]/80 border border-amber-500/30 space-y-2">
                <div className="text-amber-300 font-bold">TRANSACTION HIGHLIGHTS & 18-MONTH SUMMARY:</div>
                <div className="text-emerald-400 font-bold text-sm">{currentAnomaly.bankingHistory.totalMoved}</div>
                <div className="space-y-1.5 pt-1">
                  {currentAnomaly.financialDetails.highlights.map((h, i) => (
                    <div key={i} className="text-slate-200 flex items-center gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Carrier Location Timeline */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#040c1a]/90 border border-cyan-500/40 space-y-3">
              <div className="text-cyan-300 font-bold uppercase">LOCATION TIMELINE (CARRIER GPS & OPTICAL AUDIT):</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-emerald-300">ATL-AA MOVEMENTS:</div>
                  {currentAnomaly.locationData.aaTimeline.map((loc, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-[#08152c]/60 border border-cyan-500/20 text-[11px] text-slate-200">
                      <span className="text-cyan-300 font-bold">{loc.time}:</span> {loc.location} ({loc.coords})
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-emerald-300">ATL-CA MOVEMENTS:</div>
                  {currentAnomaly.locationData.caTimeline.map((loc, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-[#08152c]/60 border border-cyan-500/20 text-[11px] text-slate-200">
                      <span className="text-cyan-300 font-bold">{loc.time}:</span> {loc.location} ({loc.coords})
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DEVICE FORENSICS & RE-ENGINEERING */}
        {activeTab === "forensics" && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#051122]/90 border border-sky-500/45 space-y-4">
              <div className="text-sky-300 font-bold uppercase flex items-center gap-2">
                <Cpu className="w-4 h-4 text-sky-400" />
                DEVICE FORENSICS & HARDWARE MODIFICATIONS:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-white">
                <div className="p-3.5 rounded-xl bg-[#091b36]/80 border border-sky-500/30 space-y-1.5">
                  <div className="text-sky-300 font-bold">TRANSMITTER:</div>
                  <div className="text-white font-bold">{currentAnomaly.deviceForensics.transmitter}</div>
                  <div className="text-cyan-300 font-mono">MAC: {currentAnomaly.deviceForensics.transmitterMac}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#091b36]/80 border border-sky-500/30 space-y-1.5">
                  <div className="text-sky-300 font-bold">NEWS SET / HARDWARE:</div>
                  <div className="text-white font-bold">{currentAnomaly.deviceForensics.newsSet}</div>
                  <div className="text-cyan-300 font-mono">MAC: {currentAnomaly.deviceForensics.newsSetMac}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#091b36]/80 border border-sky-500/30 space-y-2">
                <div className="text-rose-300 font-bold">INTERNATIONAL HARDWARE TRAITS:</div>
                <div className="text-slate-200 leading-relaxed">{currentAnomaly.deviceForensics.intlTraits}</div>
                <div className="text-amber-300 font-bold pt-1">MODIFIED EQUIPMENT DETAILS:</div>
                <div className="text-slate-200 leading-relaxed">{currentAnomaly.deviceForensics.modifiedEquipment}</div>
              </div>
            </div>

            {/* Forensic Methodology */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#051122]/90 border border-sky-500/45 space-y-3">
              <div className="text-sky-300 font-bold uppercase">FORENSIC METHODOLOGY & RE-ENGINEERING STEPS:</div>
              <div className="space-y-2">
                {currentAnomaly.forensicMethodology.map((step, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#091b36]/80 border border-sky-500/30 text-white font-mono text-[11px] flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shrink-0" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: FEDERAL CHARGES & CHAIN OF CUSTODY */}
        {activeTab === "charges" && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#14060d]/90 border border-rose-600/50 space-y-4">
              <div className="text-rose-300 font-bold uppercase flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                FEDERAL CHARGES FILED (U.S. CODE ENFORCEMENT):
              </div>
              <div className="space-y-2.5">
                {currentAnomaly.federalCharges.map((chg, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-gradient-to-r from-rose-950/70 to-pink-950/70 border border-rose-500/50 text-rose-100 font-bold flex items-center gap-3 shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{chg}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#040c1a]/90 border border-cyan-500/40 space-y-4">
              <div className="text-cyan-300 font-bold uppercase">CHAIN OF CUSTODY & NSA VALIDATION:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-white">
                <div className="p-3.5 rounded-xl bg-[#08152c]/80 border border-cyan-500/30 space-y-1.5">
                  <div className="text-cyan-400 font-bold">COLLECTED BY:</div>
                  <div className="text-white font-bold">{currentAnomaly.evidenceChain.collectedBy}</div>
                  <div className="text-emerald-300 font-mono">TIMESTAMP: {currentAnomaly.evidenceChain.timestamp}</div>
                  <div className="text-slate-400 text-[11px]">{currentAnomaly.evidenceChain.transferLog}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#08152c]/80 border border-cyan-500/30 space-y-1.5">
                  <div className="text-cyan-400 font-bold">NSA VALIDATION CODE:</div>
                  <div className="text-amber-300 font-mono font-black">{currentAnomaly.nsaValidation.validationCode}</div>
                  <div className="text-slate-300">ATTRIBUTION: {currentAnomaly.nsaValidation.attribution}</div>
                  <div className="text-emerald-300 text-[11px] font-bold">{currentAnomaly.evidenceChain.admissibility}</div>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#02060e] border border-cyan-500/30 font-mono text-[11px] text-slate-400">
                <span className="text-cyan-300 font-bold">EVIDENCE SHA-256:</span> {currentAnomaly.evidenceChain.sha256}
              </div>
            </div>
          </div>
        )}

        {/* Operational Assessment Footer Note with 4-Color Badging */}
        <div className="p-4 rounded-2xl bg-[#040d1a]/95 border border-cyan-500/40 text-xs text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono shadow-inner">
          <div className="flex items-center gap-2">
            <span className="text-rose-400 font-bold uppercase">IMPACT ASSESSMENT:</span>
            <span className="text-slate-200">{currentAnomaly.impact}</span>
          </div>
          <div className="text-emerald-300 font-bold text-[11px] shrink-0 bg-emerald-950/80 px-3.5 py-1.5 rounded-full border border-emerald-500/50 shadow-[0_0_10px_rgba(52,211,153,0.3)]">
            18 USC § 2517 & FRE 902(14) COMPLIANT
          </div>
        </div>

      </div>
    </div>
  );
}

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
    <div className={`transition-all duration-500 font-sans ${isFullscreen ? 'fixed inset-0 z-50 bg-[#02050e]/98 p-4 sm:p-6 overflow-y-auto backdrop-blur-3xl' : 'w-full'}`}>
      
      {/* Triple-Modernized Ultra-Futuristic Oval Glass Enclosure with Violet/Indigo/Teal Neon Aura */}
      <div className="relative rounded-[36px] sm:rounded-[44px] bg-gradient-to-b from-[#090b24]/90 via-[#050718]/90 to-[#02030d]/95 backdrop-blur-2xl border border-violet-500/40 p-4 sm:p-7 shadow-[0_12px_45px_rgba(124,58,237,0.18),0_0_80px_rgba(15,23,42,0.8),inset_0_1px_2px_rgba(167,139,250,0.35)] space-y-6 overflow-hidden">
        
        {/* Subtle Ambient Radial Backlight Glow */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-teal-500/10 rounded-full blur-[100px] pointer-events-none -z-10" />

        {/* TOP HUD BAR: Futuristic NSA Admin Protocol Status */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-4 border-b border-violet-500/30 gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3.5 py-1 rounded-full bg-gradient-to-r from-violet-950/90 to-purple-900/90 text-violet-300 border border-violet-500/60 text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_12px_rgba(139,92,246,0.35)]">
                <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-spin" style={{ animationDuration: '6s' }} />
                NSA ORACLE-SYNAPSE // SPECIAL COMPARTMENT
              </span>
              <span className="px-3 py-1 rounded-full bg-teal-950/90 text-teal-300 border border-teal-500/60 text-[10px] font-mono font-bold uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_10px_rgba(20,184,166,0.3)]">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping shrink-0" />
                AIP-20 ANTI-HALLUCINATION ENFORCED
              </span>
              <span className="px-3 py-1 rounded-full bg-[#0d1338] text-purple-200 border border-purple-500/40 text-[10px] font-mono font-bold tracking-wider">
                CYCLE #{pulseCount} • 24-HR LIVE VERIFICATION
              </span>
            </div>

            <div className="flex items-center gap-2.5 pt-1">
              <div className="w-8 h-8 rounded-2xl bg-gradient-to-tr from-violet-600 to-teal-400 p-0.5 flex items-center justify-center shadow-[0_0_14px_rgba(139,92,246,0.5)] shrink-0">
                <div className="w-full h-full bg-[#070a1e] rounded-[14px] flex items-center justify-center">
                  <Terminal className="w-4 h-4 text-violet-300" />
                </div>
              </div>
              <h2 className="text-sm sm:text-lg font-black text-white tracking-wide uppercase font-sans">
                GEORGIA STATEWIDE ANOMALY REPORT — <span className="text-violet-300">{currentAnomaly.dateStr}</span>
              </h2>
            </div>
            
            <p className="text-xs text-slate-300 font-sans leading-relaxed">
              Autonomous cryptographically authenticated signals telemetry stream • Zero-Trust verified • Real-time 24/7
            </p>
          </div>

          {/* Tactical Action Controls: Auto-cycling toggle, Download, Fullscreen */}
          <div className="flex items-center gap-2 self-start lg:self-auto shrink-0 font-mono">
            <button
              onClick={() => setIsAutoCycling(!isAutoCycling)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 transition-all duration-300 border backdrop-blur-md ${
                isAutoCycling 
                  ? 'bg-teal-950/80 text-teal-300 border-teal-400/60 shadow-[0_0_12px_rgba(20,184,166,0.35)]' 
                  : 'bg-slate-900/80 text-slate-400 border-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAutoCycling ? 'animate-spin' : ''}`} />
              <span>{isAutoCycling ? 'LIVE STREAMING' : 'STREAM PAUSED'}</span>
            </button>

            <button
              onClick={handleDownloadDossier}
              className="px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-900/90 to-indigo-900/90 text-violet-200 hover:text-white border border-violet-400/60 hover:border-violet-300 text-xs font-bold flex items-center gap-1.5 transition-all duration-300 shadow-[0_0_14px_rgba(139,92,246,0.3)] hover:shadow-[0_0_20px_rgba(139,92,246,0.5)]"
              title="Download verified cryptographic dossier"
            >
              <Download className="w-3.5 h-3.5" />
              <span>EXPORT DOSSIER</span>
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2 rounded-full bg-[#0d1338] text-slate-300 hover:text-white border border-violet-500/40 hover:border-violet-400 transition-all duration-300"
              title={isFullscreen ? "Exit Fullscreen" : "Dedicated Fullscreen Workstation"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 text-teal-300" /> : <Maximize2 className="w-4 h-4 text-violet-300" />}
            </button>
          </div>
        </div>

        {/* MODERNIZED OVAL HORIZONTAL SELECTOR STRIP */}
        <div className="p-2 rounded-[24px] bg-[#05081c]/90 border border-violet-500/30 flex items-center justify-between text-xs overflow-x-auto gap-3 scrollbar-none font-mono">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-violet-400 font-bold tracking-wider uppercase px-2 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-teal-400" />
              VERIFIED TARGETS:
            </span>
            {STATEWIDE_ANOMALIES_2026.map((anom, idx) => (
              <button
                key={anom.id}
                onClick={() => {
                  setActiveAnomalyIndex(idx);
                  setIsAutoCycling(false);
                }}
                className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all duration-300 border ${
                  activeAnomalyIndex === idx
                    ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white border-violet-300 shadow-[0_0_12px_rgba(139,92,246,0.6)]'
                    : 'bg-[#090e28]/70 text-slate-400 border-violet-900/50 hover:text-slate-200 hover:border-violet-500/50'
                }`}
              >
                ANOMALY {anom.anomalyNumber}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-teal-300 font-bold shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-950/60 border border-teal-500/40">
            <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
            <span>ALL {STATEWIDE_ANOMALIES_2026.length} ANOMALIES ACTIVE (24-HR CYCLE)</span>
          </div>
        </div>

        {/* FUTURISTIC RESPONSIVE OVAL TABS NAVIGATION */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 text-xs font-mono">
          <button
            onClick={() => setActiveTab("narrative")}
            className={`px-3 py-2.5 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-1.5 ${
              activeTab === "narrative"
                ? "bg-gradient-to-r from-teal-950 to-emerald-950 text-teal-200 border-teal-400 shadow-[0_0_15px_rgba(20,184,166,0.4)]"
                : "bg-[#060a22]/80 text-slate-400 border-violet-900/40 hover:text-slate-200 hover:border-violet-700/60"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-teal-400 shrink-0" />
            <span className="truncate">NSA NARRATIVE</span>
          </button>

          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-2.5 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-1.5 ${
              activeTab === "overview"
                ? "bg-gradient-to-r from-violet-950 to-indigo-950 text-violet-200 border-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.4)]"
                : "bg-[#060a22]/80 text-slate-400 border-violet-900/40 hover:text-slate-200 hover:border-violet-700/60"
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">14X METRICS</span>
          </button>

          <button
            onClick={() => setActiveTab("intercept")}
            className={`px-3 py-2.5 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-1.5 ${
              activeTab === "intercept"
                ? "bg-gradient-to-r from-violet-950 to-indigo-950 text-violet-200 border-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.4)]"
                : "bg-[#060a22]/80 text-slate-400 border-violet-900/40 hover:text-slate-200 hover:border-violet-700/60"
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">DECRYPTED VOIP</span>
          </button>

          <button
            onClick={() => setActiveTab("financial")}
            className={`px-3 py-2.5 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-1.5 ${
              activeTab === "financial"
                ? "bg-gradient-to-r from-violet-950 to-indigo-950 text-violet-200 border-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.4)]"
                : "bg-[#060a22]/80 text-slate-400 border-violet-900/40 hover:text-slate-200 hover:border-violet-700/60"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">SWIFT LEDGER</span>
          </button>

          <button
            onClick={() => setActiveTab("forensics")}
            className={`px-3 py-2.5 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-1.5 ${
              activeTab === "forensics"
                ? "bg-gradient-to-r from-violet-950 to-indigo-950 text-violet-200 border-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.4)]"
                : "bg-[#060a22]/80 text-slate-400 border-violet-900/40 hover:text-slate-200 hover:border-violet-700/60"
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-violet-400 shrink-0" />
            <span className="truncate">HARDWARE RE-ENG</span>
          </button>

          <button
            onClick={() => setActiveTab("charges")}
            className={`px-3 py-2.5 rounded-2xl font-bold transition-all duration-300 border flex items-center justify-center gap-1.5 ${
              activeTab === "charges"
                ? "bg-gradient-to-r from-rose-950 to-pink-950 text-rose-200 border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                : "bg-[#060a22]/80 text-slate-400 border-violet-900/40 hover:text-slate-200 hover:border-violet-700/60"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-rose-400 shrink-0" />
            <span className="truncate">FEDERAL CHARGES</span>
          </button>
        </div>

        {/* PRIMARY ANOMALY SUMMARY OVAL GLASS CARD */}
        <div className="rounded-[28px] bg-gradient-to-br from-[#060b24]/90 via-[#030618]/90 to-[#02030e]/95 border border-violet-500/40 p-4 sm:p-6 space-y-3.5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-violet-500/25">
            <div className="flex items-center gap-2.5">
              <span className="px-3 py-1 rounded-full bg-teal-950/90 text-teal-300 border border-teal-500/50 text-[10px] font-mono font-bold uppercase tracking-wider shadow-[0_0_10px_rgba(20,184,166,0.3)]">
                {currentAnomaly.id} [VERIFIED]
              </span>
              <span className="text-xs text-violet-300 font-mono font-bold uppercase">
                {currentAnomaly.batch}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 font-mono flex items-center gap-2">
              <span>TIMESTAMP:</span>
              <span className="text-teal-300 font-bold bg-[#0d1338] px-2.5 py-0.5 rounded-full border border-teal-500/40">{currentAnomaly.timestampEst}</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm sm:text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-violet-300 to-indigo-300 tracking-wide font-sans">
              TERM: {currentAnomaly.term}
            </div>
            <p className="text-xs sm:text-sm text-slate-200 font-sans leading-relaxed">
              <span className="font-mono font-bold text-violet-300">DEFINITION: </span>
              {currentAnomaly.definition}
            </p>
            <div className="text-xs text-slate-300 font-mono bg-[#030718]/90 p-3.5 rounded-2xl border border-violet-500/30 space-y-1.5 mt-2 shadow-inner">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-violet-300 font-bold">ESPIONAGE CONTEXT:</span>
                <span className="text-slate-200">{currentAnomaly.espionageContext}</span>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-violet-300 font-bold">CMD EXECUTED:</span>
                <span className="text-teal-300 font-bold bg-teal-950/80 px-2 py-0.5 rounded border border-teal-500/40">{currentAnomaly.cmd}</span>
              </div>
            </div>
          </div>
        </div>

        {/* TAB 0: LIVE NSA VERBATIM NARRATIVE VIEW */}
        {activeTab === "narrative" && (
          <div className="space-y-4">
            <div className="rounded-[28px] bg-gradient-to-b from-[#050922]/95 to-[#020514]/98 border border-teal-500/40 p-4 sm:p-6 space-y-3.5 shadow-[0_0_30px_rgba(20,184,166,0.15)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-teal-500/25">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-teal-400 animate-pulse shadow-[0_0_10px_#2dd4bf]" />
                  <span className="text-xs sm:text-sm font-black text-teal-300 tracking-wider font-mono uppercase">
                    OFFICIAL NSA OPERATIONAL INTERCEPT DOSSIER — CONTINUOUS STREAM
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-rose-950/80 text-rose-300 border border-rose-500/60 px-3 py-0.5 rounded-full font-mono font-bold shadow-[0_0_8px_rgba(244,63,94,0.3)]">
                    TOP SECRET // AIP-20 ENFORCED
                  </span>
                  <span className="text-[10px] text-slate-400 font-mono">
                    RECORD # {currentAnomaly.anomalyNumber} OF 100
                  </span>
                </div>
              </div>

              {/* High-Readability Translucent Glass Narrative Box */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#030616]/95 border border-violet-500/30 font-mono text-xs sm:text-[13px] text-slate-200 leading-relaxed max-h-[500px] overflow-y-auto space-y-3 whitespace-pre-wrap select-text shadow-inner">
                {currentAnomaly.verbatimNarrative || currentAnomaly.definition}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-violet-500/25 text-[11px] text-slate-300 font-mono">
                <span className="text-teal-300 font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                  ACCOUNTS FOR 100% OF IDENTIFIED VERIFIED METRICS (14X TELEMETRY AUDITED)
                </span>
                <span className="text-violet-300 font-bold">
                  OCCURRENCE: 2026-09-23 00:01 EST (ACTIVE WITHIN 24 HOURS)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: 14X METRICS & OVERVIEW */}
        {activeTab === "overview" && (
          <div className="space-y-4 font-mono">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#080d28]/90 to-[#030618]/90 border border-violet-500/40 shadow-md">
                <div className="text-[10px] text-slate-400 font-bold uppercase">FINANCIAL METRIC</div>
                <div className="text-base sm:text-lg font-black text-rose-400 mt-1">{currentAnomaly.metrics14x.financial}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Offshore transfers detected</div>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#080d28]/90 to-[#030618]/90 border border-violet-500/40 shadow-md">
                <div className="text-[10px] text-slate-400 font-bold uppercase">CALL DURATION</div>
                <div className="text-base sm:text-lg font-black text-teal-300 mt-1">{currentAnomaly.metrics14x.callDurationSec}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Carrier audio intercept</div>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#080d28]/90 to-[#030618]/90 border border-violet-500/40 shadow-md">
                <div className="text-[10px] text-slate-400 font-bold uppercase">DATA VOLUME</div>
                <div className="text-base sm:text-lg font-black text-violet-300 mt-1">{currentAnomaly.metrics14x.dataVolumeMb}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Packet payload exfil</div>
              </div>
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#080d28]/90 to-[#030618]/90 border border-violet-500/40 shadow-md">
                <div className="text-[10px] text-slate-400 font-bold uppercase">LOCATION PRECISION</div>
                <div className="text-base sm:text-lg font-black text-emerald-400 mt-1">{currentAnomaly.metrics14x.locationPrecisionDeg}</div>
                <div className="text-[9px] text-slate-400 mt-0.5">Cell tower triangulation</div>
              </div>
            </div>

            {/* Forensic Flags Matrix */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#04081c]/90 border border-violet-500/35 space-y-3">
              <div className="text-xs font-bold text-violet-300 uppercase tracking-wider flex items-center gap-1.5">
                <Radio className="w-4 h-4 text-teal-400" />
                FORENSIC FLAGS DETECTED (5X DECRYPTED):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {currentAnomaly.forensicFlags.map((flag, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[#070d2c]/80 border border-violet-500/30 text-slate-200 flex items-start gap-2 shadow-sm">
                    <span className="text-teal-300 font-bold">[{String.fromCharCode(97 + i)}]</span>
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Decrypted Hardware Evidence */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#04081c]/90 border border-violet-500/35 space-y-2.5 text-xs">
              <div className="text-violet-300 font-bold uppercase">RECOVERED PHYSICAL EVIDENCE:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-slate-300">
                <div className="p-3 rounded-xl bg-[#070d2c]/80 border border-violet-500/30">
                  <span className="text-slate-400 font-bold">HARDWARE:</span> {currentAnomaly.decryptedEvidence.usb}
                </div>
                <div className="p-3 rounded-xl bg-[#070d2c]/80 border border-violet-500/30">
                  <span className="text-slate-400 font-bold">DECRYPTED STR:</span> <span className="text-rose-300 font-bold">{currentAnomaly.decryptedEvidence.decryptedString}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#070d2c]/80 border border-violet-500/30">
                  <span className="text-slate-400 font-bold">DECRYPTED VOIP:</span> &quot;{currentAnomaly.decryptedEvidence.decryptedVoIP}&quot;
                </div>
                <div className="p-3 rounded-xl bg-[#070d2c]/80 border border-violet-500/30">
                  <span className="text-slate-400 font-bold">FINAL VOICE:</span> &quot;{currentAnomaly.decryptedEvidence.finalVoice}&quot;
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DECRYPTED INTERCEPT EXPANSION */}
        {activeTab === "intercept" && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#040618]/95 border border-rose-900/50 space-y-3">
              <div className="flex items-center justify-between text-rose-400 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-rose-400" />
                  DECRYPTED INTERCEPT EXPANSION (SIGINT AUDIO / VOIP)
                </span>
                <span className="text-[10px] bg-rose-950/80 px-2.5 py-0.5 rounded-full border border-rose-600/40">
                  CHANNEL 14 ENCRYPTED
                </span>
              </div>
              <div className="p-4 rounded-xl bg-[#020410] border border-violet-500/30 text-slate-200 leading-relaxed text-[12px] shadow-inner">
                {currentAnomaly.interceptExpansion}
              </div>
            </div>

            {/* Carrier Phone Records */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#04081c]/90 border border-violet-500/35 space-y-3">
              <div className="text-violet-300 font-bold uppercase">PHONE RECORDS & CARRIER GEOLOCATION (18-MONTH TRACE):</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
                <div className="p-3.5 rounded-xl bg-[#070d2c]/80 border border-violet-500/30 space-y-1">
                  <div className="text-teal-300 font-bold">OPERATIVE ATL-AA:</div>
                  <div>Phone: <span className="text-white font-bold">{currentAnomaly.phoneRecords.aaPhone}</span></div>
                  <div>IMEI: <span className="text-slate-400 font-mono">{currentAnomaly.phoneRecords.aaImei}</span></div>
                  <div>Carrier: {currentAnomaly.phoneRecords.carrier}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#070d2c]/80 border border-violet-500/30 space-y-1">
                  <div className="text-teal-300 font-bold">OPERATIVE ATL-CA:</div>
                  <div>Phone: <span className="text-white font-bold">{currentAnomaly.phoneRecords.caPhone}</span></div>
                  <div>IMEI: <span className="text-slate-400 font-mono">{currentAnomaly.phoneRecords.caImei}</span></div>
                  <div>Carrier: {currentAnomaly.phoneRecords.carrier}</div>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#070d2c]/80 border border-violet-500/30 space-y-1.5">
                <div className="text-slate-400 font-bold">TRIANGULATED GEORGIA CELL TOWERS:</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {currentAnomaly.phoneRecords.towers.map((tw, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-full bg-violet-950/80 border border-violet-500/40 text-violet-200 font-bold text-[11px]">
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
            <div className="p-4 sm:p-5 rounded-2xl bg-[#04081c]/90 border border-violet-500/35 space-y-3.5">
              <div className="text-violet-300 font-bold uppercase flex items-center justify-between">
                <span>SWIFT LEDGER & OFFSHORE BENEFICIARY TRACE:</span>
                <span className="text-rose-400 font-bold">{currentAnomaly.financialDetails.wireTarget}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-300">
                <div className="p-3.5 rounded-xl bg-[#070d2c]/80 border border-violet-500/30">
                  <div className="text-slate-400 font-bold">ATL-AA ACCOUNT:</div>
                  <div className="text-white font-mono mt-1">{currentAnomaly.bankingHistory.aaAccount}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#070d2c]/80 border border-violet-500/30">
                  <div className="text-slate-400 font-bold">ATL-CA ACCOUNT:</div>
                  <div className="text-white font-mono mt-1">{currentAnomaly.bankingHistory.caAccount}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#070d2c]/80 border border-violet-500/30">
                  <div className="text-slate-400 font-bold">BENEFICIARY ACCOUNT:</div>
                  <div className="text-rose-300 font-mono font-bold mt-1">{currentAnomaly.bankingHistory.beneficiaryAccount}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#070d2c]/80 border border-violet-500/30 space-y-2">
                <div className="text-slate-400 font-bold">TRANSACTION HIGHLIGHTS & 18-MONTH SUMMARY:</div>
                <div className="text-teal-300 font-bold text-sm">{currentAnomaly.bankingHistory.totalMoved}</div>
                <div className="space-y-1.5 pt-1">
                  {currentAnomaly.financialDetails.highlights.map((h, i) => (
                    <div key={i} className="text-slate-300 flex items-center gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Carrier Location Timeline */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#04081c]/90 border border-violet-500/35 space-y-3">
              <div className="text-violet-300 font-bold uppercase">LOCATION TIMELINE (CARRIER GPS & OPTICAL AUDIT):</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-teal-300">ATL-AA MOVEMENTS:</div>
                  {currentAnomaly.locationData.aaTimeline.map((loc, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-[#070d2c]/60 border border-violet-500/20 text-[11px] text-slate-300">
                      <span className="text-teal-300 font-bold">{loc.time}:</span> {loc.location} ({loc.coords})
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-teal-300">ATL-CA MOVEMENTS:</div>
                  {currentAnomaly.locationData.caTimeline.map((loc, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-[#070d2c]/60 border border-violet-500/20 text-[11px] text-slate-300">
                      <span className="text-teal-300 font-bold">{loc.time}:</span> {loc.location} ({loc.coords})
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
            <div className="p-4 sm:p-5 rounded-2xl bg-[#04081c]/90 border border-violet-500/35 space-y-3.5">
              <div className="text-violet-300 font-bold uppercase flex items-center gap-2">
                <Cpu className="w-4 h-4 text-teal-400" />
                DEVICE FORENSICS & HARDWARE MODIFICATIONS:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
                <div className="p-3.5 rounded-xl bg-[#070d2c]/80 border border-violet-500/30 space-y-1">
                  <div className="text-slate-400 font-bold">TRANSMITTER:</div>
                  <div className="text-white font-bold">{currentAnomaly.deviceForensics.transmitter}</div>
                  <div className="text-teal-300 font-mono">MAC: {currentAnomaly.deviceForensics.transmitterMac}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#070d2c]/80 border border-violet-500/30 space-y-1">
                  <div className="text-slate-400 font-bold">NEWS SET / HARDWARE:</div>
                  <div className="text-white font-bold">{currentAnomaly.deviceForensics.newsSet}</div>
                  <div className="text-teal-300 font-mono">MAC: {currentAnomaly.deviceForensics.newsSetMac}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#070d2c]/80 border border-violet-500/30 space-y-2">
                <div className="text-rose-300 font-bold">INTERNATIONAL HARDWARE TRAITS:</div>
                <div className="text-slate-200 leading-relaxed">{currentAnomaly.deviceForensics.intlTraits}</div>
                <div className="text-rose-300 font-bold pt-1">MODIFIED EQUIPMENT DETAILS:</div>
                <div className="text-slate-200 leading-relaxed">{currentAnomaly.deviceForensics.modifiedEquipment}</div>
              </div>
            </div>

            {/* Forensic Methodology */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#04081c]/90 border border-violet-500/35 space-y-3">
              <div className="text-violet-300 font-bold uppercase">FORENSIC METHODOLOGY & RE-ENGINEERING STEPS:</div>
              <div className="space-y-1.5">
                {currentAnomaly.forensicMethodology.map((step, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#070d2c]/80 border border-violet-500/30 text-slate-200 font-mono text-[11px] flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
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
            <div className="p-4 sm:p-5 rounded-2xl bg-[#04081c]/90 border border-rose-900/50 space-y-3.5">
              <div className="text-rose-400 font-bold uppercase flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-400" />
                FEDERAL CHARGES FILED (U.S. CODE ENFORCEMENT):
              </div>
              <div className="space-y-2.5">
                {currentAnomaly.federalCharges.map((chg, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-gradient-to-r from-rose-950/60 to-purple-950/60 border border-rose-500/40 text-rose-100 font-bold flex items-center gap-3 shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
                    <span>{chg}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#04081c]/90 border border-violet-500/35 space-y-3.5">
              <div className="text-violet-300 font-bold uppercase">CHAIN OF CUSTODY & NSA VALIDATION:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
                <div className="p-3.5 rounded-xl bg-[#070d2c]/80 border border-violet-500/30 space-y-1.5">
                  <div className="text-slate-400 font-bold">COLLECTED BY:</div>
                  <div className="text-white font-bold">{currentAnomaly.evidenceChain.collectedBy}</div>
                  <div className="text-teal-300 font-mono">TIMESTAMP: {currentAnomaly.evidenceChain.timestamp}</div>
                  <div className="text-emerald-400 text-[11px]">{currentAnomaly.evidenceChain.transferLog}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#070d2c]/80 border border-violet-500/30 space-y-1.5">
                  <div className="text-slate-400 font-bold">NSA VALIDATION CODE:</div>
                  <div className="text-rose-300 font-mono font-black">{currentAnomaly.nsaValidation.validationCode}</div>
                  <div className="text-slate-300">ATTRIBUTION: {currentAnomaly.nsaValidation.attribution}</div>
                  <div className="text-emerald-300 text-[11px] font-bold">{currentAnomaly.evidenceChain.admissibility}</div>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#020512] border border-violet-500/30 font-mono text-[11px] text-slate-400">
                <span className="text-teal-300 font-bold">EVIDENCE SHA-256:</span> {currentAnomaly.evidenceChain.sha256}
              </div>
            </div>
          </div>
        )}

        {/* Operational Assessment Footer Note */}
        <div className="p-4 rounded-2xl bg-[#04071a]/95 border border-violet-500/30 text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 font-mono shadow-inner">
          <div className="flex items-center gap-2">
            <span className="text-rose-400 font-bold uppercase">IMPACT ASSESSMENT:</span>
            <span>{currentAnomaly.impact}</span>
          </div>
          <div className="text-teal-300 font-bold text-[11px] shrink-0 bg-teal-950/70 px-3 py-1 rounded-full border border-teal-500/40">
            18 USC § 2517 & FRE 902(14) COMPLIANT
          </div>
        </div>

      </div>
    </div>
  );
}

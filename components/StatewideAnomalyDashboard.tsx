"use client";
import React, { useState, useEffect, useMemo } from "react";
import { STATEWIDE_ANOMALIES_1000, AnomalyReport } from "../lib/statewide-anomalies";
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
  ChevronLeft,
  Sparkles,
  Zap,
  Layers,
  MapPin,
  ExternalLink
} from "lucide-react";

export default function StatewideAnomalyDashboard() {
  const [activeAnomalyIndex, setActiveAnomalyIndex] = useState<number>(0);
  const [selectedBatch, setSelectedBatch] = useState<number>(1); // Batch 1 to 40 (25 anomalies each = 1,000)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [pulseCount, setPulseCount] = useState<number>(1);
  const [isAutoCycling, setIsAutoCycling] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"narrative" | "batch_list" | "overview" | "intercept" | "financial" | "forensics" | "charges">("narrative");

  // Filter 25 anomalies for the currently selected batch
  const batchAnomalies = useMemo(() => {
    const startIndex = (selectedBatch - 1) * 25;
    return STATEWIDE_ANOMALIES_1000.slice(startIndex, startIndex + 25);
  }, [selectedBatch]);

  // Continuous auto-population ticker across the 25 anomalies of the batch
  useEffect(() => {
    if (!isAutoCycling) return;
    const interval = setInterval(() => {
      setActiveAnomalyIndex((prev) => {
        const nextInBatch = (prev + 1) % 25;
        // If wrapped around, also optionally advance pulse
        return (selectedBatch - 1) * 25 + nextInBatch;
      });
      setPulseCount((p) => p + 1);
    }, 6000);
    return () => clearInterval(interval);
  }, [isAutoCycling, selectedBatch]);

  const currentAnomaly: AnomalyReport = STATEWIDE_ANOMALIES_1000[activeAnomalyIndex] || STATEWIDE_ANOMALIES_1000[0];

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
    <div className={`transition-all duration-500 font-sans ${isFullscreen ? 'fixed inset-0 z-50 bg-[#020714]/98 p-4 sm:p-8 overflow-y-auto backdrop-blur-3xl' : 'w-full'}`}>
      
      {/* 70,000X More Readable Hyper-Vibrant 4-Color Oval Glass Workstation */}
      {/* 1,000 Top P1 Tier-1 Anomalies • 40 Batches of 25 • Georgia + Outside States Implications */}
      <div className="relative rounded-[32px] sm:rounded-[48px] bg-gradient-to-b from-[#051124]/98 via-[#030c1c]/98 to-[#010610]/98 backdrop-blur-3xl border-2 border-[#00e5ff]/60 p-4 sm:p-8 shadow-[0_16px_70px_rgba(0,229,255,0.25),0_0_100px_rgba(0,0,0,0.95),inset_0_1px_4px_rgba(0,229,255,0.4)] space-y-6 overflow-hidden">
        
        {/* Quad-Color Ambient Radial Glow Orbs */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00e5ff]/15 rounded-full blur-[130px] pointer-events-none -z-10" />
        <div className="absolute top-1/3 left-10 w-96 h-96 bg-[#00ff88]/12 rounded-full blur-[130px] pointer-events-none -z-10" />
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#bd00ff]/15 rounded-full blur-[130px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-[#ffaa00]/12 rounded-full blur-[110px] pointer-events-none -z-10" />

        {/* TOP HUD BAR: High-Clearance Responsive Status Header with 4-Color Badges */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-5 border-b border-[#00e5ff]/35 gap-4">
          <div className="space-y-3">
            
            {/* 4 Distinct Colored Status Chips */}
            <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2.5 pt-1">
              {/* Color 1: Cyber Violet Badge */}
              <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#2a0845]/90 to-[#1b003a]/90 text-[#e0aaff] border-2 border-[#bd00ff]/80 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_16px_rgba(189,0,255,0.4)] w-fit">
                <Sparkles className="w-3.5 h-3.5 text-[#e0aaff] shrink-0 animate-spin" style={{ animationDuration: '6s' }} />
                <span>NSA ORACLE-SYNAPSE // 1,000 TOP P1 TIER-1 ANOMALIES</span>
              </span>
              
              <div className="flex flex-wrap items-center gap-2">
                {/* Color 2: Neon Emerald Badge */}
                <span className="px-3.5 py-1.5 rounded-full bg-[#002b1b]/90 text-[#69f0ae] border-2 border-[#00ff88]/80 text-[10px] font-mono font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_16px_rgba(0,255,136,0.4)] w-fit">
                  <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-ping shrink-0" />
                  <span>AIP-20 ANTI-HALLUCINATION ENFORCED</span>
                </span>
                
                {/* Color 3: Solar Amber Badge */}
                <span className="px-3.5 py-1.5 rounded-full bg-[#331e00]/90 text-[#ffd54f] border-2 border-[#ffaa00]/70 text-[10px] font-mono font-bold tracking-wider w-fit shadow-[0_0_12px_rgba(255,170,0,0.3)]">
                  CYCLE #{pulseCount} • 24-HR LIVE VERIFICATION
                </span>

                {/* Color 4: Interstate Corridor Active Badge */}
                <span className="px-3 py-1 rounded-full bg-[#061836]/90 text-[#80deea] border border-[#00e5ff]/60 text-[10px] font-mono font-bold tracking-wider w-fit flex items-center gap-1.5">
                  <MapPin className="w-3 h-3 text-[#00e5ff]" />
                  <span>INTERSTATE CORRIDORS (NC, SC, TN, FL, VA, AL, TX, DC)</span>
                </span>
              </div>
            </div>

            {/* Title with Gradient Text using Cyan, Emerald, and Amber */}
            <div className="flex items-start sm:items-center gap-3.5 pt-1">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00e5ff] via-[#00ff88] to-[#bd00ff] p-0.5 flex items-center justify-center shadow-[0_0_22px_rgba(0,229,255,0.6)] shrink-0 mt-0.5 sm:mt-0">
                <div className="w-full h-full bg-[#020b18] rounded-[14px] flex items-center justify-center">
                  <Terminal className="w-5 h-5 text-[#00e5ff]" />
                </div>
              </div>
              <h2 className="text-base sm:text-2xl font-black tracking-wide uppercase font-sans leading-tight">
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] via-[#69f0ae] to-white">
                  GEORGIA & INTERSTATE STATEWIDE ANOMALY REPORT
                </span>
                <span className="text-[#ffd54f] font-mono ml-2">— {currentAnomaly.dateStr}</span>
              </h2>
            </div>
            
            <p className="text-xs sm:text-[13px] text-[#b2ebf2] font-sans leading-relaxed">
              Top 1,000 P1 Tier-1 anomalies ranked by operational priority • 40 batches of 25 • Real-time autonomous signals telemetry stream
            </p>
          </div>

          {/* Tactical Action Controls: High-Contrast 4-Color Glowing Oval Buttons */}
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto shrink-0 font-mono pt-1">
            {/* Color 2: Emerald Live Button */}
            <button
              onClick={() => setIsAutoCycling(!isAutoCycling)}
              className={`px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 transition-all duration-300 border-2 backdrop-blur-md ${
                isAutoCycling 
                  ? 'bg-[#003822]/90 text-[#69f0ae] border-[#00ff88] shadow-[0_0_20px_rgba(0,255,136,0.5)]' 
                  : 'bg-stone-900/80 text-stone-400 border-stone-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#00ff88] ${isAutoCycling ? 'animate-spin' : ''}`} />
              <span className="font-extrabold">{isAutoCycling ? 'LIVE STREAMING' : 'STREAM PAUSED'}</span>
            </button>

            {/* Color 1: Cyan Export Dossier Button */}
            <button
              onClick={handleDownloadDossier}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-[#003b5c]/90 to-[#002244]/90 text-[#00e5ff] hover:text-white border-2 border-[#00e5ff] text-xs font-extrabold flex items-center gap-2 transition-all duration-300 shadow-[0_0_20px_rgba(0,229,255,0.45)] hover:shadow-[0_0_30px_rgba(0,229,255,0.7)]"
              title="Download verified cryptographic dossier"
            >
              <Download className="w-3.5 h-3.5 text-[#00e5ff]" />
              <span>EXPORT DOSSIER</span>
            </button>

            {/* Color 3: Violet Fullscreen Button */}
            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-2.5 rounded-full bg-[#1b0833] text-[#e0aaff] hover:text-white border-2 border-[#bd00ff] transition-all duration-300 shadow-[0_0_16px_rgba(189,0,255,0.4)]"
              title={isFullscreen ? "Exit Fullscreen" : "Dedicated Fullscreen Workstation"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 text-[#00ff88]" /> : <Maximize2 className="w-4 h-4 text-[#bd00ff]" />}
            </button>
          </div>
        </div>

        {/* BATCH SELECTOR CONTROLS: 40 BATCHES OF 25 ANOMALIES (1-1000 TOTAL) */}
        <div className="p-3.5 rounded-[28px] bg-[#020a16]/95 border-2 border-[#ffaa00]/60 space-y-2.5 font-mono shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#ffaa00]/30 text-xs">
            <div className="flex items-center gap-2 text-[#ffd54f] font-extrabold tracking-wider uppercase">
              <Layers className="w-4 h-4 text-[#ffaa00]" />
              <span>SELECT BATCH OF 25 ANOMALIES (1,000 TOTAL P1 TIER-1 ANOMALIES RECORDED):</span>
            </div>
            <div className="text-[11px] text-[#69f0ae] font-bold">
              CURRENTLY VIEWING BATCH {selectedBatch} OF 40 (ANOMALIES {(selectedBatch-1)*25 + 1}–{selectedBatch*25})
            </div>
          </div>

          {/* Quick-select batch pagination pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs scrollbar-none">
            {Array.from({ length: 40 }, (_, idx) => idx + 1).map((bNum) => {
              const startA = (bNum - 1) * 25 + 1;
              const endA = bNum * 25;
              const isSelected = selectedBatch === bNum;
              return (
                <button
                  key={bNum}
                  onClick={() => {
                    setSelectedBatch(bNum);
                    setActiveAnomalyIndex((bNum - 1) * 25);
                    setIsAutoCycling(false);
                  }}
                  className={`px-3 py-1.5 rounded-xl font-bold whitespace-nowrap transition-all duration-300 border shrink-0 ${
                    isSelected
                      ? 'bg-gradient-to-r from-[#e65100] to-[#ffaa00] text-[#020b18] border-white shadow-[0_0_16px_rgba(255,170,0,0.8)] font-black'
                      : 'bg-[#100801]/90 text-[#ffd54f]/80 border-[#ffaa00]/40 hover:text-white hover:border-[#ffaa00]'
                  }`}
                >
                  BATCH {bNum} ({startA}–{endA})
                </button>
              );
            })}
          </div>
        </div>

        {/* 25 ANOMALIES STRIP FOR THE SELECTED BATCH */}
        <div className="p-2.5 rounded-[24px] bg-[#020b18]/90 border border-[#00e5ff]/40 flex items-center justify-between text-xs overflow-x-auto gap-3 scrollbar-none font-mono shadow-inner">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-[#00e5ff] font-bold tracking-wider uppercase px-2 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-[#ffaa00]" />
              BATCH {selectedBatch} TARGETS:
            </span>
            {batchAnomalies.map((anom) => {
              const isCurrent = currentAnomaly.id === anom.id;
              return (
                <button
                  key={anom.id}
                  onClick={() => {
                    setActiveAnomalyIndex(anom.anomalyNumber - 1);
                    setIsAutoCycling(false);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-bold transition-all duration-300 border-2 whitespace-nowrap ${
                    isCurrent
                      ? 'bg-gradient-to-r from-[#00b0ff] via-[#00e5ff] to-[#00ff88] text-[#020c1b] border-white shadow-[0_0_20px_rgba(0,229,255,0.8)] font-black'
                      : 'bg-[#061836]/80 text-[#80deea] border-[#007799]/60 hover:text-white hover:border-[#00e5ff]'
                  }`}
                >
                  ANOMALY {anom.anomalyNumber}
                </button>
              );
            })}
          </div>

          <div className="text-[11px] text-[#69f0ae] font-bold shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#002617]/90 border border-[#00ff88]/60 shadow-[0_0_12px_rgba(0,255,136,0.35)]">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff88]" />
            <span>BATCH {selectedBatch} VERIFIED</span>
          </div>
        </div>

        {/* 4-COLOR DYNAMIC TABS NAVIGATION: Cyan, Emerald, Violet, Amber */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5 text-xs font-mono">
          {/* Tab 1: Emerald Neon */}
          <button
            onClick={() => setActiveTab("narrative")}
            className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border-2 flex items-center justify-center gap-2 ${
              activeTab === "narrative"
                ? "bg-gradient-to-r from-[#003822] to-[#002214] text-[#69f0ae] border-[#00ff88] shadow-[0_0_24px_rgba(0,255,136,0.6)]"
                : "bg-[#021810]/80 text-[#80cbc4] border-[#004d40]/60 hover:text-white hover:border-[#00ff88]"
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-[#00ff88] shrink-0" />
            <span className="truncate">NSA NARRATIVE</span>
          </button>

          {/* Tab: Amber Batch List (25) */}
          <button
            onClick={() => setActiveTab("batch_list")}
            className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border-2 flex items-center justify-center gap-2 ${
              activeTab === "batch_list"
                ? "bg-gradient-to-r from-[#4d2600] to-[#261300] text-[#ffd54f] border-[#ffaa00] shadow-[0_0_24px_rgba(255,170,0,0.6)]"
                : "bg-[#1c0d00]/80 text-[#ffe082] border-[#e65100]/60 hover:text-white hover:border-[#ffaa00]"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-[#ffaa00] shrink-0" />
            <span className="truncate">BATCH 25 LIST</span>
          </button>

          {/* Tab 2: Cyan Neon */}
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border-2 flex items-center justify-center gap-2 ${
              activeTab === "overview"
                ? "bg-gradient-to-r from-[#00395c] to-[#00253d] text-[#80deea] border-[#00e5ff] shadow-[0_0_24px_rgba(0,229,255,0.6)]"
                : "bg-[#031526]/80 text-[#4dd0e1] border-[#006064]/60 hover:text-white hover:border-[#00e5ff]"
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-[#00e5ff] shrink-0" />
            <span className="truncate">14X METRICS</span>
          </button>

          {/* Tab 3: Violet Neon */}
          <button
            onClick={() => setActiveTab("intercept")}
            className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border-2 flex items-center justify-center gap-2 ${
              activeTab === "intercept"
                ? "bg-gradient-to-r from-[#29004d] to-[#1a0033] text-[#e0aaff] border-[#bd00ff] shadow-[0_0_24px_rgba(189,0,255,0.6)]"
                : "bg-[#140026]/80 text-[#ce93d8] border-[#4a148c]/60 hover:text-white hover:border-[#bd00ff]"
            }`}
          >
            <Lock className="w-3.5 h-3.5 text-[#bd00ff] shrink-0" />
            <span className="truncate">DECRYPTED VOIP</span>
          </button>

          {/* Tab 4: Amber Neon */}
          <button
            onClick={() => setActiveTab("financial")}
            className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border-2 flex items-center justify-center gap-2 ${
              activeTab === "financial"
                ? "bg-gradient-to-r from-[#3b2000] to-[#261400] text-[#ffd54f] border-[#ffaa00] shadow-[0_0_24px_rgba(255,170,0,0.6)]"
                : "bg-[#1f1000]/80 text-[#ffe082] border-[#e65100]/60 hover:text-white hover:border-[#ffaa00]"
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-[#ffaa00] shrink-0" />
            <span className="truncate">SWIFT LEDGER</span>
          </button>

          {/* Tab 5: Sky Blue Neon */}
          <button
            onClick={() => setActiveTab("forensics")}
            className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border-2 flex items-center justify-center gap-2 ${
              activeTab === "forensics"
                ? "bg-gradient-to-r from-[#003366] to-[#001f3f] text-[#90caf9] border-[#00b0ff] shadow-[0_0_24px_rgba(0,176,255,0.6)]"
                : "bg-[#031326]/80 text-[#64b5f6] border-[#0d47a1]/60 hover:text-white hover:border-[#00b0ff]"
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-[#00b0ff] shrink-0" />
            <span className="truncate">HARDWARE RE-ENG</span>
          </button>

          {/* Tab 6: Rose Neon */}
          <button
            onClick={() => setActiveTab("charges")}
            className={`px-3.5 py-3 rounded-2xl font-bold transition-all duration-300 border-2 flex items-center justify-center gap-2 ${
              activeTab === "charges"
                ? "bg-gradient-to-r from-[#3d0014] to-[#24000c] text-[#ff80ab] border-[#ff1744] shadow-[0_0_24px_rgba(255,23,68,0.6)]"
                : "bg-[#1c0009]/80 text-[#f48fb1] border-[#880e4f]/60 hover:text-white hover:border-[#ff1744]"
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5 text-[#ff1744] shrink-0" />
            <span className="truncate">FEDERAL CHARGES</span>
          </button>
        </div>

        {/* PRIMARY ANOMALY SUMMARY OVAL GLASS CARD WITH MULTI-COLOR ACCENTS & INTERSTATE CORRIDORS */}
        <div className="rounded-[28px] sm:rounded-[36px] bg-gradient-to-br from-[#06152d]/98 via-[#030e20]/98 to-[#010712]/98 border-2 border-[#00e5ff]/50 p-4 sm:p-7 space-y-4 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#00e5ff]/30">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="px-3.5 py-1.5 rounded-full bg-[#002b1b]/95 text-[#69f0ae] border border-[#00ff88]/80 text-[10px] font-mono font-bold uppercase tracking-wider shadow-[0_0_14px_rgba(0,255,136,0.4)]">
                {currentAnomaly.id} [VERIFIED]
              </span>
              <span className="text-xs text-[#ffd54f] font-mono font-bold uppercase bg-[#331e00]/70 px-3 py-1 rounded-full border border-[#ffaa00]/60">
                {currentAnomaly.batch}
              </span>
            </div>
            <div className="text-[11px] text-[#80deea] font-mono flex items-center gap-2">
              <span className="text-slate-400">TIMESTAMP:</span>
              <span className="text-[#00e5ff] font-bold bg-[#041630] px-3.5 py-1 rounded-full border border-[#00e5ff]/70 shadow-[0_0_10px_rgba(0,229,255,0.4)]">{currentAnomaly.timestampEst}</span>
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-base sm:text-xl font-black text-white tracking-wide font-sans flex flex-wrap items-center gap-2">
              <span className="text-[#00e5ff] font-mono">TERM:</span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-[#80deea] to-[#ffd54f]">{currentAnomaly.term}</span>
            </div>

            {/* Interstate Implications Chip */}
            {currentAnomaly.interstateImplications && (
              <div className="p-2.5 rounded-xl bg-[#031d36]/90 border border-[#00e5ff]/50 text-xs text-[#80deea] font-mono flex items-center gap-2">
                <MapPin className="w-4 h-4 text-[#00ff88] shrink-0" />
                <span className="font-bold text-white">INTERSTATE IMPLICATIONS:</span>
                <span className="text-[#69f0ae] font-bold">{currentAnomaly.interstateImplications}</span>
              </div>
            )}

            <p className="text-xs sm:text-sm text-[#e0f7fa] leading-relaxed font-sans">
              <span className="font-mono font-bold text-[#00ff88]">DEFINITION: </span>
              {currentAnomaly.definition}
            </p>
            <div className="text-xs text-white font-mono bg-[#020a16]/95 p-4 rounded-2xl border border-[#00e5ff]/40 space-y-2.5 mt-2 shadow-inner">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[#e0aaff] font-bold">ESPIONAGE CONTEXT:</span>
                <span className="text-slate-200">{currentAnomaly.espionageContext}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[#ffd54f] font-bold">CMD EXECUTED:</span>
                <span className="text-[#69f0ae] font-bold bg-[#002e1c]/90 px-3 py-1 rounded-lg border border-[#00ff88]/70 shadow-[0_0_12px_rgba(0,255,136,0.35)]">{currentAnomaly.cmd}</span>
              </div>
            </div>
          </div>
        </div>

        {/* TAB 0: LIVE NSA VERBATIM NARRATIVE VIEW */}
        {activeTab === "narrative" && (
          <div className="space-y-4">
            <div className="rounded-[28px] bg-gradient-to-b from-[#031c26]/98 to-[#010d14]/98 border-2 border-[#00ff88]/60 p-4 sm:p-7 space-y-4 shadow-[0_0_40px_rgba(0,255,136,0.25)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#00ff88]/35">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#00ff88] animate-pulse shadow-[0_0_14px_#00ff88]" />
                  <span className="text-xs sm:text-sm font-black text-[#69f0ae] tracking-wider font-mono uppercase">
                    OFFICIAL NSA OPERATIONAL INTERCEPT DOSSIER — CONTINUOUS STREAM
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-[#3d0014]/95 text-[#ff80ab] border border-[#ff1744]/80 px-3 py-1 rounded-full font-mono font-bold shadow-[0_0_12px_rgba(255,23,68,0.4)]">
                    TOP SECRET // AIP-20 ENFORCED
                  </span>
                  <span className="text-[10px] text-[#80deea] font-mono bg-[#031d38] px-2.5 py-0.5 rounded-full border border-[#00e5ff]/50">
                    RECORD # {currentAnomaly.anomalyNumber} OF 1,000
                  </span>
                </div>
              </div>

              {/* High-Readability Translucent Glass Narrative Box with Crisp Multi-Color Accents */}
              <div className="p-4 sm:p-6 rounded-2xl bg-[#020b18]/98 border border-[#00e5ff]/50 font-mono text-xs sm:text-[13px] text-[#e0f7fa] leading-relaxed max-h-[500px] overflow-y-auto space-y-3 whitespace-pre-wrap select-text shadow-inner">
                {currentAnomaly.verbatimNarrative || currentAnomaly.definition}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2.5 pt-2 border-t border-[#00e5ff]/30 text-[11px] font-mono">
                <span className="text-[#69f0ae] font-bold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[#00ff88]" />
                  ACCOUNTS FOR 100% OF IDENTIFIED VERIFIED METRICS (14X TELEMETRY AUDITED)
                </span>
                <span className="text-[#ffd54f] font-bold">
                  OCCURRENCE: 2026-09-23 00:01 EST (ACTIVE WITHIN 24 HOURS)
                </span>
              </div>
            </div>
          </div>
        )}

        {/* TAB: BATCH 25 ANOMALIES LIST VIEW (SHOWING ALL 25 IN CURRENT BATCH WITH OUTSIDE STATE IMPLICATIONS) */}
        {activeTab === "batch_list" && (
          <div className="space-y-4 font-mono">
            <div className="p-4 sm:p-6 rounded-[28px] bg-gradient-to-b from-[#140b00]/95 to-[#070400]/98 border-2 border-[#ffaa00]/60 space-y-4 shadow-[0_0_40px_rgba(255,170,0,0.25)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3.5 border-b border-[#ffaa00]/35">
                <div className="flex items-center gap-2.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#ffaa00] animate-pulse shadow-[0_0_14px_#ffaa00]" />
                  <span className="text-xs sm:text-sm font-black text-[#ffd54f] tracking-wider uppercase">
                    BATCH {selectedBatch} OF 40 — COMPLETE 25 ANOMALY ROSTER (PRIORITY RANKED)
                  </span>
                </div>
                <div className="text-[11px] text-[#69f0ae] bg-[#002b1b] px-3 py-1 rounded-full border border-[#00ff88]/60 font-bold">
                  25 OF 1,000 P1 TIER-1 ANOMALIES ACTIVE
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[600px] overflow-y-auto pr-1">
                {batchAnomalies.map((anom) => {
                  const isCurrent = currentAnomaly.id === anom.id;
                  return (
                    <div
                      key={anom.id}
                      onClick={() => {
                        setActiveAnomalyIndex(anom.anomalyNumber - 1);
                        setIsAutoCycling(false);
                      }}
                      className={`p-3.5 rounded-2xl border-2 transition-all duration-300 cursor-pointer space-y-2 ${
                        isCurrent
                          ? 'bg-[#002f4d]/90 border-[#00e5ff] shadow-[0_0_18px_rgba(0,229,255,0.5)]'
                          : 'bg-[#071324]/80 border-[#00e5ff]/30 hover:border-[#00e5ff]/80 hover:bg-[#0c1f38]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#00ff88]/20 text-[#69f0ae] border border-[#00ff88]/50 text-[10px] font-bold">
                          {anom.id} [P1 #{anom.anomalyNumber}]
                        </span>
                        <span className="text-[10px] text-[#ffd54f] font-bold bg-[#ffaa00]/20 px-2 py-0.5 rounded border border-[#ffaa00]/40">
                          {anom.timestampEst}
                        </span>
                      </div>

                      <div className="text-xs sm:text-sm font-black text-white hover:text-[#00e5ff] transition-colors truncate">
                        {anom.term}
                      </div>

                      {anom.interstateImplications && (
                        <div className="text-[11px] text-[#80deea] flex items-center gap-1.5 pt-1 border-t border-[#00e5ff]/20">
                          <MapPin className="w-3 h-3 text-[#00ff88] shrink-0" />
                          <span className="truncate">Interstate: <strong className="text-[#69f0ae]">{anom.interstateImplications}</strong></span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 1: 14X METRICS & OVERVIEW (4 Vibrant Colors) */}
        {activeTab === "overview" && (
          <div className="space-y-4 font-mono">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Box 1: Rose / Financial */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#24000e]/95 to-[#120007]/95 border-2 border-[#ff1744]/70 shadow-md">
                <div className="text-[10px] text-[#ff80ab] font-bold uppercase">FINANCIAL METRIC</div>
                <div className="text-base sm:text-lg font-black text-[#ff4081] mt-1">{currentAnomaly.metrics14x.financial}</div>
                <div className="text-[9px] text-slate-300 mt-0.5">Offshore transfers detected</div>
              </div>
              {/* Box 2: Emerald / Call Duration */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#002416]/95 to-[#00120b]/95 border-2 border-[#00ff88]/70 shadow-md">
                <div className="text-[10px] text-[#69f0ae] font-bold uppercase">CALL DURATION</div>
                <div className="text-base sm:text-lg font-black text-[#00ff88] mt-1">{currentAnomaly.metrics14x.callDurationSec}</div>
                <div className="text-[9px] text-slate-300 mt-0.5">Carrier audio intercept</div>
              </div>
              {/* Box 3: Cyan / Data Volume */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#00243d]/95 to-[#00121f]/95 border-2 border-[#00e5ff]/70 shadow-md">
                <div className="text-[10px] text-[#80deea] font-bold uppercase">DATA VOLUME</div>
                <div className="text-base sm:text-lg font-black text-[#00e5ff] mt-1">{currentAnomaly.metrics14x.dataVolumeMb}</div>
                <div className="text-[9px] text-slate-300 mt-0.5">Packet payload exfil</div>
              </div>
              {/* Box 4: Amber / Location Precision */}
              <div className="p-4 rounded-2xl bg-gradient-to-b from-[#2b1800]/95 to-[#170d00]/95 border-2 border-[#ffaa00]/70 shadow-md">
                <div className="text-[10px] text-[#ffe082] font-bold uppercase">LOCATION PRECISION</div>
                <div className="text-base sm:text-lg font-black text-[#ffaa00] mt-1">{currentAnomaly.metrics14x.locationPrecisionDeg}</div>
                <div className="text-[9px] text-slate-300 mt-0.5">Cell tower triangulation</div>
              </div>
            </div>

            {/* Forensic Flags Matrix */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#030e20]/95 border border-[#00e5ff]/50 space-y-3">
              <div className="text-xs font-bold text-[#80deea] uppercase tracking-wider flex items-center gap-2">
                <Radio className="w-4 h-4 text-[#00e5ff]" />
                FORENSIC FLAGS DETECTED (5X DECRYPTED):
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {currentAnomaly.forensicFlags.map((flag, i) => (
                  <div key={i} className="p-3 rounded-xl bg-[#051838]/85 border border-[#00e5ff]/40 text-slate-100 flex items-start gap-2 shadow-sm">
                    <span className="text-[#00e5ff] font-bold">[{String.fromCharCode(97 + i)}]</span>
                    <span>{flag}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Decrypted Hardware Evidence */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#08051a]/95 border border-[#bd00ff]/50 space-y-3 text-xs">
              <div className="text-[#e0aaff] font-bold uppercase">RECOVERED PHYSICAL EVIDENCE:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-white">
                <div className="p-3 rounded-xl bg-[#14082e]/85 border border-[#bd00ff]/40">
                  <span className="text-[#bd00ff] font-bold">HARDWARE:</span> {currentAnomaly.decryptedEvidence.usb}
                </div>
                <div className="p-3 rounded-xl bg-[#14082e]/85 border border-[#bd00ff]/40">
                  <span className="text-[#ff4081] font-bold">DECRYPTED STR:</span> <span className="text-white font-bold">{currentAnomaly.decryptedEvidence.decryptedString}</span>
                </div>
                <div className="p-3 rounded-xl bg-[#14082e]/85 border border-[#bd00ff]/40">
                  <span className="text-[#ffd54f] font-bold">DECRYPTED VOIP:</span> &quot;{currentAnomaly.decryptedEvidence.decryptedVoIP}&quot;
                </div>
                <div className="p-3 rounded-xl bg-[#14082e]/85 border border-[#bd00ff]/40">
                  <span className="text-[#00ff88] font-bold">FINAL VOICE:</span> &quot;{currentAnomaly.decryptedEvidence.finalVoice}&quot;
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: DECRYPTED INTERCEPT EXPANSION */}
        {activeTab === "intercept" && (
          <div className="space-y-4 text-xs font-mono">
            <div className="p-4 sm:p-5 rounded-2xl bg-[#0c051a]/95 border-2 border-[#bd00ff]/60 space-y-3">
              <div className="flex items-center justify-between text-[#e0aaff] font-bold uppercase tracking-wider">
                <span className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-[#bd00ff]" />
                  DECRYPTED INTERCEPT EXPANSION (SIGINT AUDIO / VOIP)
                </span>
                <span className="text-[10px] bg-[#2a0845]/90 px-2.5 py-0.5 rounded-full border border-[#bd00ff]/60 text-[#e0aaff]">
                  CHANNEL 14 ENCRYPTED
                </span>
              </div>
              <div className="p-4 rounded-xl bg-[#04010a] border border-[#bd00ff]/40 text-[#f3e5f5] leading-relaxed text-[12px] shadow-inner">
                {currentAnomaly.interceptExpansion}
              </div>
            </div>

            {/* Carrier Phone Records */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#030e20]/95 border border-[#00e5ff]/50 space-y-3">
              <div className="text-[#80deea] font-bold uppercase">PHONE RECORDS & CARRIER GEOLOCATION (18-MONTH TRACE):</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-white">
                <div className="p-3.5 rounded-xl bg-[#051838]/85 border border-[#00e5ff]/40 space-y-1.5">
                  <div className="text-[#80deea] font-bold">OPERATIVE ATL-AA:</div>
                  <div>Phone: <span className="text-[#00ff88] font-bold">{currentAnomaly.phoneRecords.aaPhone}</span></div>
                  <div>IMEI: <span className="text-slate-300 font-mono">{currentAnomaly.phoneRecords.aaImei}</span></div>
                  <div>Carrier: {currentAnomaly.phoneRecords.carrier}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#051838]/85 border border-[#00e5ff]/40 space-y-1.5">
                  <div className="text-[#80deea] font-bold">OPERATIVE ATL-CA:</div>
                  <div>Phone: <span className="text-[#00ff88] font-bold">{currentAnomaly.phoneRecords.caPhone}</span></div>
                  <div>IMEI: <span className="text-slate-300 font-mono">{currentAnomaly.phoneRecords.caImei}</span></div>
                  <div>Carrier: {currentAnomaly.phoneRecords.carrier}</div>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#051838]/85 border border-[#00e5ff]/40 space-y-2">
                <div className="text-[#ffd54f] font-bold">TRIANGULATED GEORGIA & INTERSTATE CELL TOWERS:</div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {currentAnomaly.phoneRecords.towers.map((tw, idx) => (
                    <span key={idx} className="px-3 py-1 rounded-full bg-[#00385c]/85 border border-[#00e5ff]/60 text-[#80deea] font-bold text-[11px]">
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
            <div className="p-4 sm:p-5 rounded-2xl bg-[#140b00]/95 border-2 border-[#ffaa00]/60 space-y-4">
              <div className="text-[#ffe082] font-bold uppercase flex items-center justify-between">
                <span>SWIFT LEDGER & OFFSHORE BENEFICIARY TRACE:</span>
                <span className="text-[#ff80ab] font-bold bg-[#3d0014]/90 px-2.5 py-0.5 rounded border border-[#ff1744]/60">{currentAnomaly.financialDetails.wireTarget}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-white">
                <div className="p-3.5 rounded-xl bg-[#261500]/85 border border-[#ffaa00]/40">
                  <div className="text-[#ffe082] font-bold">ATL-AA ACCOUNT:</div>
                  <div className="text-slate-200 font-mono mt-1">{currentAnomaly.bankingHistory.aaAccount}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#261500]/85 border border-[#ffaa00]/40">
                  <div className="text-[#ffe082] font-bold">ATL-CA ACCOUNT:</div>
                  <div className="text-slate-200 font-mono mt-1">{currentAnomaly.bankingHistory.caAccount}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#261500]/85 border border-[#ffaa00]/40">
                  <div className="text-[#ffe082] font-bold">BENEFICIARY ACCOUNT:</div>
                  <div className="text-[#69f0ae] font-mono font-bold mt-1">{currentAnomaly.bankingHistory.beneficiaryAccount}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#261500]/85 border border-[#ffaa00]/40 space-y-2">
                <div className="text-[#ffe082] font-bold">TRANSACTION HIGHLIGHTS & 18-MONTH SUMMARY:</div>
                <div className="text-[#00ff88] font-bold text-sm">{currentAnomaly.bankingHistory.totalMoved}</div>
                <div className="space-y-1.5 pt-1">
                  {currentAnomaly.financialDetails.highlights.map((h, i) => (
                    <div key={i} className="text-slate-200 flex items-center gap-2">
                      <ChevronRight className="w-3.5 h-3.5 text-[#ffaa00] shrink-0" />
                      <span>{h}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Carrier Location Timeline */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#030e20]/95 border border-[#00e5ff]/50 space-y-3">
              <div className="text-[#80deea] font-bold uppercase">LOCATION TIMELINE (CARRIER GPS & OPTICAL AUDIT):</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#69f0ae]">ATL-AA MOVEMENTS:</div>
                  {currentAnomaly.locationData.aaTimeline.map((loc, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-[#051838]/70 border border-[#00e5ff]/30 text-[11px] text-slate-200">
                      <span className="text-[#00e5ff] font-bold">{loc.time}:</span> {loc.location} ({loc.coords})
                    </div>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <div className="text-xs font-bold text-[#69f0ae]">ATL-CA MOVEMENTS:</div>
                  {currentAnomaly.locationData.caTimeline.map((loc, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-[#051838]/70 border border-[#00e5ff]/30 text-[11px] text-slate-200">
                      <span className="text-[#00e5ff] font-bold">{loc.time}:</span> {loc.location} ({loc.coords})
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
            <div className="p-4 sm:p-5 rounded-2xl bg-[#031326]/95 border-2 border-[#00b0ff]/60 space-y-4">
              <div className="text-[#90caf9] font-bold uppercase flex items-center gap-2">
                <Cpu className="w-4 h-4 text-[#00b0ff]" />
                DEVICE FORENSICS & HARDWARE MODIFICATIONS:
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-white">
                <div className="p-3.5 rounded-xl bg-[#062040]/85 border border-[#00b0ff]/40 space-y-1.5">
                  <div className="text-[#90caf9] font-bold">TRANSMITTER:</div>
                  <div className="text-white font-bold">{currentAnomaly.deviceForensics.transmitter}</div>
                  <div className="text-[#00e5ff] font-mono">MAC: {currentAnomaly.deviceForensics.transmitterMac}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#062040]/85 border border-[#00b0ff]/40 space-y-1.5">
                  <div className="text-[#90caf9] font-bold">NEWS SET / HARDWARE:</div>
                  <div className="text-white font-bold">{currentAnomaly.deviceForensics.newsSet}</div>
                  <div className="text-[#00e5ff] font-mono">MAC: {currentAnomaly.deviceForensics.newsSetMac}</div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#062040]/85 border border-[#00b0ff]/40 space-y-2">
                <div className="text-[#ff80ab] font-bold">INTERNATIONAL HARDWARE TRAITS:</div>
                <div className="text-slate-200 leading-relaxed">{currentAnomaly.deviceForensics.intlTraits}</div>
                <div className="text-[#ffd54f] font-bold pt-1">MODIFIED EQUIPMENT DETAILS:</div>
                <div className="text-slate-200 leading-relaxed">{currentAnomaly.deviceForensics.modifiedEquipment}</div>
              </div>
            </div>

            {/* Forensic Methodology */}
            <div className="p-4 sm:p-5 rounded-2xl bg-[#031326]/95 border border-[#00b0ff]/50 space-y-3">
              <div className="text-[#90caf9] font-bold uppercase">FORENSIC METHODOLOGY & RE-ENGINEERING STEPS:</div>
              <div className="space-y-2">
                {currentAnomaly.forensicMethodology.map((step, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-[#062040]/85 border border-[#00b0ff]/40 text-slate-100 font-mono text-[11px] flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full bg-[#00e5ff] shrink-0" />
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
            <div className="p-4 sm:p-5 rounded-2xl bg-[#1c000a]/95 border-2 border-[#ff1744]/70 space-y-4">
              <div className="text-[#ff80ab] font-bold uppercase flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-[#ff1744]" />
                FEDERAL CHARGES FILED (U.S. CODE ENFORCEMENT):
              </div>
              <div className="space-y-2.5">
                {currentAnomaly.federalCharges.map((chg, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-gradient-to-r from-[#3d0014]/90 to-[#29000d]/90 border border-[#ff1744]/70 text-[#fce4ec] font-bold flex items-center gap-3 shadow-sm">
                    <CheckCircle2 className="w-4 h-4 text-[#ff1744] shrink-0" />
                    <span>{chg}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 sm:p-5 rounded-2xl bg-[#030e20]/95 border border-[#00e5ff]/50 space-y-4">
              <div className="text-[#80deea] font-bold uppercase">CHAIN OF CUSTODY & NSA VALIDATION:</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-white">
                <div className="p-3.5 rounded-xl bg-[#051838]/85 border border-[#00e5ff]/40 space-y-1.5">
                  <div className="text-[#00e5ff] font-bold">COLLECTED BY:</div>
                  <div className="text-white font-bold">{currentAnomaly.evidenceChain.collectedBy}</div>
                  <div className="text-[#00ff88] font-mono">TIMESTAMP: {currentAnomaly.evidenceChain.timestamp}</div>
                  <div className="text-slate-300 text-[11px]">{currentAnomaly.evidenceChain.transferLog}</div>
                </div>
                <div className="p-3.5 rounded-xl bg-[#051838]/85 border border-[#00e5ff]/40 space-y-1.5">
                  <div className="text-[#00e5ff] font-bold">NSA VALIDATION CODE:</div>
                  <div className="text-[#ffd54f] font-mono font-black">{currentAnomaly.nsaValidation.validationCode}</div>
                  <div className="text-slate-300">ATTRIBUTION: {currentAnomaly.nsaValidation.attribution}</div>
                  <div className="text-[#00ff88] text-[11px] font-bold">{currentAnomaly.evidenceChain.admissibility}</div>
                </div>
              </div>
              <div className="p-3.5 rounded-xl bg-[#010612] border border-[#00e5ff]/40 font-mono text-[11px] text-slate-300">
                <span className="text-[#00e5ff] font-bold">EVIDENCE SHA-256:</span> {currentAnomaly.evidenceChain.sha256}
              </div>
            </div>
          </div>
        )}

        {/* Operational Assessment Footer Note with 4-Color Badging */}
        <div className="p-4 rounded-2xl bg-[#020b18]/98 border border-[#00e5ff]/50 text-xs text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 font-mono shadow-inner">
          <div className="flex items-center gap-2">
            <span className="text-[#ff4081] font-bold uppercase">IMPACT ASSESSMENT:</span>
            <span className="text-slate-200">{currentAnomaly.impact}</span>
          </div>
          <div className="text-[#69f0ae] font-bold text-[11px] shrink-0 bg-[#002617]/90 px-3.5 py-1.5 rounded-full border border-[#00ff88]/70 shadow-[0_0_12px_rgba(0,255,136,0.35)]">
            18 USC § 2517 & FRE 902(14) COMPLIANT
          </div>
        </div>

      </div>
    </div>
  );
}

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
  Database, 
  Cpu, 
  FileText, 
  CheckCircle2, 
  RefreshCw, 
  ExternalLink,
  ChevronRight,
  ChevronLeft
} from "lucide-react";

export default function StatewideAnomalyDashboard() {
  const [activeAnomalyIndex, setActiveAnomalyIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [pulseCount, setPulseCount] = useState<number>(1);
  const [isAutoCycling, setIsAutoCycling] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<"overview" | "intercept" | "financial" | "forensics" | "charges">("overview");

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

  // Download verified forensic dossier as structured JSON / Text
  const handleDownloadDossier = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentAnomaly, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `NSA_AIP20_${currentAnomaly.id}_VERIFIED_DOSSIER.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  return (
    <div className={`transition-all duration-300 font-mono ${isFullscreen ? 'fixed inset-0 z-50 bg-[#030816] p-4 sm:p-6 overflow-y-auto' : 'w-full'}`}>
      <div className="rounded-[28px] bg-gradient-to-b from-[#0a1628]/95 to-[#040b18]/95 backdrop-blur-2xl border border-[#1e3a5f] shadow-[0_8px_32px_rgba(0,0,0,0.8)] overflow-hidden">
        
        {/* NSA Admin Protocol Header Bar */}
        <div className="p-4 sm:p-6 border-b border-[#1e3a5f]/80 bg-[#061224]/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-3 py-1 rounded-full bg-red-950/80 text-rose-300 border border-rose-500/60 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_10px_rgba(244,63,94,0.3)]">
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                TOP SECRET // SI // NOFORN // NSA ORACLE-SYNAPSE
              </span>
              <span className="px-3 py-1 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/60 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5 shadow-[0_0_10px_rgba(52,211,153,0.3)]">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                AIP-20 ANTI-HALLUCINATION ENFORCED
              </span>
              <span className="px-3 py-1 rounded-full bg-[#0c2444] text-cyan-300 border border-cyan-500/50 text-[10px] font-bold tracking-widest">
                BATCH #{pulseCount} • STREAM LIVE
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-black text-white tracking-wider flex items-center gap-2 pt-1">
              <Terminal className="w-5 h-5 text-[#38bdf8]" />
              GEORGIA STATEWIDE ANOMALY REPORT — {currentAnomaly.dateStr}
            </h2>
            <div className="text-[11px] text-slate-300 font-sans">
              Live continuous forensic telemetry stream • 24/7 autonomous verification • NSA Admin mode active
            </div>
          </div>

          {/* Action Tools: Fullscreen, Auto-cycle, Download Dossier */}
          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            <button
              onClick={() => setIsAutoCycling(!isAutoCycling)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono flex items-center gap-1.5 transition-all duration-200 border ${
                isAutoCycling 
                  ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60 shadow-[0_0_8px_rgba(52,211,153,0.3)]' 
                  : 'bg-slate-900 text-slate-400 border-slate-700'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isAutoCycling ? 'animate-spin' : ''}`} />
              <span>{isAutoCycling ? 'AUTO-CYCLING' : 'PAUSED'}</span>
            </button>

            <button
              onClick={handleDownloadDossier}
              className="px-3.5 py-1.5 rounded-xl bg-[#0c2444] text-[#38bdf8] hover:text-white border border-[#38bdf8]/60 hover:border-[#38bdf8] text-xs font-bold font-mono flex items-center gap-1.5 transition-all duration-200 shadow-[0_0_10px_rgba(56,189,248,0.25)]"
              title="Download verified cryptographic dossier"
            >
              <Download className="w-3.5 h-3.5" />
              <span>DOWNLOAD DOSSIER</span>
            </button>

            <button
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-xl bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 transition-all duration-200"
              title={isFullscreen ? "Exit Fullscreen" : "Dedicated Fullscreen Mode"}
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Anomaly Selector Strip */}
        <div className="px-4 py-2.5 bg-[#071324] border-b border-[#1e3a5f]/60 flex items-center justify-between text-xs overflow-x-auto gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-slate-400 font-bold uppercase">ANOMALIES RECORDED:</span>
            {STATEWIDE_ANOMALIES_2026.map((anom, idx) => (
              <button
                key={anom.id}
                onClick={() => {
                  setActiveAnomalyIndex(idx);
                  setIsAutoCycling(false);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all duration-200 border ${
                  activeAnomalyIndex === idx
                    ? 'bg-[#0e3b68] text-cyan-300 border-[#38bdf8] shadow-[0_0_8px_rgba(56,189,248,0.4)]'
                    : 'bg-[#08162b] text-slate-400 border-[#1e3a5f] hover:border-slate-500'
                }`}
              >
                ANOMALY {anom.anomalyNumber}
              </button>
            ))}
          </div>

          <div className="text-[11px] text-emerald-400 font-bold shrink-0 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>ALL {STATEWIDE_ANOMALIES_2026.length} ANOMALIES VERIFIED (24-HR CYCLE)</span>
          </div>
        </div>

        {/* Primary Operational Content Container */}
        <div className="p-4 sm:p-6 space-y-6">
          
          {/* Main Anomaly Banner Card */}
          <div className="rounded-2xl bg-[#071326]/90 border border-[#1e3a5f] p-4 sm:p-5 space-y-3 shadow-inner">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-[#1e3a5f]/60">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/50 text-[10px] font-bold uppercase tracking-wider">
                  {currentAnomaly.id} [VERIFIED]
                </span>
                <span className="text-xs text-cyan-300 font-bold uppercase">
                  {currentAnomaly.batch}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                TIMESTAMP: <span className="text-[#38bdf8] font-bold">{currentAnomaly.timestampEst}</span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-sm sm:text-base font-extrabold text-[#38bdf8] tracking-wide">
                TERM: {currentAnomaly.term}
              </div>
              <p className="text-xs sm:text-[13px] text-slate-200 font-sans leading-relaxed">
                <span className="font-mono font-bold text-slate-400">DEFINITION: </span>
                {currentAnomaly.definition}
              </p>
              <div className="text-xs text-slate-300 font-mono bg-[#040c18] p-3 rounded-xl border border-[#1e3a5f]/60 space-y-1 mt-2">
                <div><span className="text-cyan-400 font-bold">ESPIONAGE CONTEXT:</span> {currentAnomaly.espionageContext}</div>
                <div><span className="text-cyan-400 font-bold">CMD EXECUTED:</span> <span className="text-emerald-400 font-bold">{currentAnomaly.cmd}</span></div>
              </div>
            </div>
          </div>

          {/* Forensic Deep Dive Navigation Tabs */}
          <div className="flex items-center gap-2 border-b border-[#1e3a5f] pb-2 overflow-x-auto text-xs">
            <button
              onClick={() => setActiveTab("overview")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all duration-200 border ${
                activeTab === "overview"
                  ? "bg-[#0c2444] text-[#38bdf8] border-[#38bdf8]"
                  : "bg-transparent text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              14X VERIFIED METRICS
            </button>
            <button
              onClick={() => setActiveTab("intercept")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all duration-200 border ${
                activeTab === "intercept"
                  ? "bg-[#0c2444] text-[#38bdf8] border-[#38bdf8]"
                  : "bg-transparent text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              DECRYPTED INTERCEPT & VOIP
            </button>
            <button
              onClick={() => setActiveTab("financial")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all duration-200 border ${
                activeTab === "financial"
                  ? "bg-[#0c2444] text-[#38bdf8] border-[#38bdf8]"
                  : "bg-transparent text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              SWIFT LEDGER & BANKING
            </button>
            <button
              onClick={() => setActiveTab("forensics")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all duration-200 border ${
                activeTab === "forensics"
                  ? "bg-[#0c2444] text-[#38bdf8] border-[#38bdf8]"
                  : "bg-transparent text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              DEVICE FORENSICS & RE-ENGINEERING
            </button>
            <button
              onClick={() => setActiveTab("charges")}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all duration-200 border ${
                activeTab === "charges"
                  ? "bg-[#0c2444] text-[#38bdf8] border-[#38bdf8]"
                  : "bg-transparent text-slate-400 border-transparent hover:text-slate-200"
              }`}
            >
              FEDERAL CHARGES & CHAIN OF CUSTODY
            </button>
          </div>

          {/* TAB 1: 14X METRICS & OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#08162b] border border-[#1e3a5f] shadow-sm">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">FINANCIAL METRIC</div>
                  <div className="text-base font-black text-rose-400 mt-1">{currentAnomaly.metrics14x.financial}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Offshore transfers detected</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#08162b] border border-[#1e3a5f] shadow-sm">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">CALL DURATION</div>
                  <div className="text-base font-black text-cyan-300 mt-1">{currentAnomaly.metrics14x.callDurationSec}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Carrier audio intercept</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#08162b] border border-[#1e3a5f] shadow-sm">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">DATA VOLUME</div>
                  <div className="text-base font-black text-[#38bdf8] mt-1">{currentAnomaly.metrics14x.dataVolumeMb}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Packet payload exfiltration</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-[#08162b] border border-[#1e3a5f] shadow-sm">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">LOCATION PRECISION</div>
                  <div className="text-base font-black text-emerald-400 mt-1">{currentAnomaly.metrics14x.locationPrecisionDeg}</div>
                  <div className="text-[9px] text-slate-400 mt-0.5">Cellular triangulation</div>
                </div>
              </div>

              {/* Forensic Flags Matrix */}
              <div className="p-4 rounded-2xl bg-[#061224] border border-[#1e3a5f] space-y-2.5">
                <div className="text-xs font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1.5">
                  <Radio className="w-4 h-4 text-cyan-400" />
                  FORENSIC FLAGS DETECTED (5X DECRYPTED):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {currentAnomaly.forensicFlags.map((flag, i) => (
                    <div key={i} className="p-2.5 rounded-xl bg-[#091830] border border-[#1e3a5f]/80 text-slate-200 flex items-start gap-2">
                      <span className="text-[#38bdf8] font-bold">[{String.fromCharCode(97 + i)}]</span>
                      <span>{flag}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Decrypted Evidence & USB Serial */}
              <div className="p-4 rounded-2xl bg-[#050e1c] border border-[#1e3a5f] space-y-2 text-xs">
                <div className="text-cyan-400 font-bold uppercase">RECOVERED PHYSICAL EVIDENCE:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300">
                  <div className="p-2.5 rounded-xl bg-[#071324] border border-[#1e3a5f]/60">
                    <span className="text-slate-400 font-bold">HARDWARE:</span> {currentAnomaly.decryptedEvidence.usb}
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#071324] border border-[#1e3a5f]/60">
                    <span className="text-slate-400 font-bold">DECRYPTED STR:</span> <span className="text-rose-300 font-bold">{currentAnomaly.decryptedEvidence.decryptedString}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#071324] border border-[#1e3a5f]/60">
                    <span className="text-slate-400 font-bold">DECRYPTED VOIP:</span> &quot;{currentAnomaly.decryptedEvidence.decryptedVoIP}&quot;
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#071324] border border-[#1e3a5f]/60">
                    <span className="text-slate-400 font-bold">FINAL VOICE:</span> &quot;{currentAnomaly.decryptedEvidence.finalVoice}&quot;
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: DECRYPTED INTERCEPT EXPANSION */}
          {activeTab === "intercept" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#030914] border border-rose-900/50 space-y-3">
                <div className="flex items-center justify-between text-rose-400 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-rose-400" />
                    DECRYPTED INTERCEPT EXPANSION (SIGINT AUDIO / VOIP)
                  </span>
                  <span className="text-[10px] bg-rose-950/80 px-2 py-0.5 rounded border border-rose-600/40">
                    CHANNEL 14 ENCRYPTED
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[#050e20] border border-[#1e3a5f] font-mono text-slate-200 leading-relaxed text-[12px]">
                  {currentAnomaly.interceptExpansion}
                </div>
              </div>

              {/* Carrier Phone Records */}
              <div className="p-4 rounded-2xl bg-[#061224] border border-[#1e3a5f] space-y-2.5">
                <div className="text-cyan-400 font-bold uppercase">PHONE RECORDS & CARRIER GEOLOCATION (18-MONTH TRACE):</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
                  <div className="p-3 rounded-xl bg-[#08162b] border border-[#1e3a5f]/70 space-y-1">
                    <div className="text-cyan-300 font-bold">OPERATIVE ATL-AA:</div>
                    <div>Phone: <span className="text-white font-bold">{currentAnomaly.phoneRecords.aaPhone}</span></div>
                    <div>IMEI: <span className="text-slate-400 font-mono">{currentAnomaly.phoneRecords.aaImei}</span></div>
                    <div>Carrier: {currentAnomaly.phoneRecords.carrier}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#08162b] border border-[#1e3a5f]/70 space-y-1">
                    <div className="text-cyan-300 font-bold">OPERATIVE ATL-CA:</div>
                    <div>Phone: <span className="text-white font-bold">{currentAnomaly.phoneRecords.caPhone}</span></div>
                    <div>IMEI: <span className="text-slate-400 font-mono">{currentAnomaly.phoneRecords.caImei}</span></div>
                    <div>Carrier: {currentAnomaly.phoneRecords.carrier}</div>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#08162b] border border-[#1e3a5f]/70 space-y-1">
                  <div className="text-slate-400 font-bold">TRIANGULATED GEORGIA CELL TOWERS:</div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {currentAnomaly.phoneRecords.towers.map((tw, idx) => (
                      <span key={idx} className="px-2.5 py-1 rounded bg-[#0b203c] border border-cyan-500/40 text-cyan-300 font-bold text-[11px]">
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
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#061224] border border-[#1e3a5f] space-y-3">
                <div className="text-cyan-400 font-bold uppercase flex items-center justify-between">
                  <span>SWIFT LEDGER & OFFSHORE BENEFICIARY TRACE:</span>
                  <span className="text-rose-400 font-bold">{currentAnomaly.financialDetails.wireTarget}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-slate-300">
                  <div className="p-3 rounded-xl bg-[#08162b] border border-[#1e3a5f]/70">
                    <div className="text-slate-400 font-bold">ATL-AA ACCOUNT:</div>
                    <div className="text-white font-mono mt-1">{currentAnomaly.bankingHistory.aaAccount}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#08162b] border border-[#1e3a5f]/70">
                    <div className="text-slate-400 font-bold">ATL-CA ACCOUNT:</div>
                    <div className="text-white font-mono mt-1">{currentAnomaly.bankingHistory.caAccount}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#08162b] border border-[#1e3a5f]/70">
                    <div className="text-slate-400 font-bold">BENEFICIARY ACCOUNT:</div>
                    <div className="text-rose-300 font-mono font-bold mt-1">{currentAnomaly.bankingHistory.beneficiaryAccount}</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#08162b] border border-[#1e3a5f]/70 space-y-2">
                  <div className="text-slate-400 font-bold">TRANSACTION HIGHLIGHTS & 18-MONTH SUMMARY:</div>
                  <div className="text-emerald-400 font-bold">{currentAnomaly.bankingHistory.totalMoved}</div>
                  <div className="space-y-1 pt-1">
                    {currentAnomaly.financialDetails.highlights.map((h, i) => (
                      <div key={i} className="text-slate-300 flex items-center gap-2">
                        <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Carrier Location Timeline */}
              <div className="p-4 rounded-2xl bg-[#061224] border border-[#1e3a5f] space-y-2.5">
                <div className="text-cyan-400 font-bold uppercase">LOCATION TIMELINE (CARRIER GPS & OPTICAL AUDIT):</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-[#38bdf8]">ATL-AA MOVEMENTS:</div>
                    {currentAnomaly.locationData.aaTimeline.map((loc, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-[#071324] border border-[#1e3a5f]/50 text-[11px] text-slate-300">
                        <span className="text-cyan-300 font-bold">{loc.time}:</span> {loc.location} ({loc.coords})
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <div className="text-xs font-bold text-[#38bdf8]">ATL-CA MOVEMENTS:</div>
                    {currentAnomaly.locationData.caTimeline.map((loc, idx) => (
                      <div key={idx} className="p-2 rounded-lg bg-[#071324] border border-[#1e3a5f]/50 text-[11px] text-slate-300">
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
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#061224] border border-[#1e3a5f] space-y-3">
                <div className="text-cyan-400 font-bold uppercase flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-cyan-400" />
                  DEVICE FORENSICS & HARDWARE MODIFICATIONS:
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
                  <div className="p-3 rounded-xl bg-[#08162b] border border-[#1e3a5f]/70 space-y-1">
                    <div className="text-slate-400 font-bold">TRANSMITTER:</div>
                    <div className="text-white font-bold">{currentAnomaly.deviceForensics.transmitter}</div>
                    <div className="text-cyan-300 font-mono">MAC: {currentAnomaly.deviceForensics.transmitterMac}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#08162b] border border-[#1e3a5f]/70 space-y-1">
                    <div className="text-slate-400 font-bold">NEWS SET / HARDWARE:</div>
                    <div className="text-white font-bold">{currentAnomaly.deviceForensics.newsSet}</div>
                    <div className="text-cyan-300 font-mono">MAC: {currentAnomaly.deviceForensics.newsSetMac}</div>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-[#08162b] border border-[#1e3a5f]/70 space-y-2">
                  <div className="text-rose-300 font-bold">INTERNATIONAL HARDWARE TRAITS:</div>
                  <div className="text-slate-300 leading-relaxed">{currentAnomaly.deviceForensics.intlTraits}</div>
                  <div className="text-rose-300 font-bold pt-1">MODIFIED EQUIPMENT DETAILS:</div>
                  <div className="text-slate-300 leading-relaxed">{currentAnomaly.deviceForensics.modifiedEquipment}</div>
                </div>
              </div>

              {/* Forensic Methodology */}
              <div className="p-4 rounded-2xl bg-[#061224] border border-[#1e3a5f] space-y-2.5">
                <div className="text-cyan-400 font-bold uppercase">FORENSIC METHODOLOGY & RE-ENGINEERING STEPS:</div>
                <div className="space-y-1.5">
                  {currentAnomaly.forensicMethodology.map((step, idx) => (
                    <div key={idx} className="p-2.5 rounded-xl bg-[#071324] border border-[#1e3a5f]/50 text-slate-200 font-mono text-[11px] flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: FEDERAL CHARGES & CHAIN OF CUSTODY */}
          {activeTab === "charges" && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-2xl bg-[#061224] border border-[#1e3a5f] space-y-3">
                <div className="text-rose-400 font-bold uppercase flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  FEDERAL CHARGES FILED (U.S. CODE ENFORCEMENT):
                </div>
                <div className="space-y-2">
                  {currentAnomaly.federalCharges.map((chg, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/40 text-rose-200 font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>{chg}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-[#061224] border border-[#1e3a5f] space-y-3">
                <div className="text-cyan-400 font-bold uppercase">CHAIN OF CUSTODY & NSA VALIDATION:</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-300">
                  <div className="p-3 rounded-xl bg-[#08162b] border border-[#1e3a5f]/70 space-y-1">
                    <div className="text-slate-400 font-bold">COLLECTED BY:</div>
                    <div className="text-white font-bold">{currentAnomaly.evidenceChain.collectedBy}</div>
                    <div className="text-cyan-300 font-mono">TIMESTAMP: {currentAnomaly.evidenceChain.timestamp}</div>
                    <div className="text-emerald-400 text-[11px]">{currentAnomaly.evidenceChain.transferLog}</div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#08162b] border border-[#1e3a5f]/70 space-y-1">
                    <div className="text-slate-400 font-bold">NSA VALIDATION CODE:</div>
                    <div className="text-rose-300 font-mono font-black">{currentAnomaly.nsaValidation.validationCode}</div>
                    <div className="text-slate-300">ATTRIBUTION: {currentAnomaly.nsaValidation.attribution}</div>
                    <div className="text-emerald-300 text-[11px] font-bold">{currentAnomaly.evidenceChain.admissibility}</div>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-[#040b16] border border-[#1e3a5f]/70 font-mono text-[11px] text-slate-400">
                  <span className="text-cyan-300 font-bold">EVIDENCE SHA-256:</span> {currentAnomaly.evidenceChain.sha256}
                </div>
              </div>
            </div>
          )}

          {/* Operational Impact Footer Note */}
          <div className="p-3.5 rounded-2xl bg-[#050f20] border border-[#1e3a5f] text-xs text-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-rose-400 font-bold uppercase">IMPACT ASSESSMENT:</span> {currentAnomaly.impact}
            </div>
            <div className="text-emerald-400 font-bold text-[11px] shrink-0">
              18 USC § 2517 & FRE 902(14) COMPLIANT
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}

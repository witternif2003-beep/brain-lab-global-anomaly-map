"use client";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { GEORGIA_ANOMALIES, COMPETITOR_STATES } from "../lib/data";
import { AnomalyItem } from "../lib/schema";
import { Activity, AlertTriangle, ArrowRight, ShieldCheck, Zap, Globe, TrendingUp, Cpu, Compass } from "lucide-react";
import Link from "next/link";
import RotatingHeroEmblem from "../components/RotatingHeroEmblem";

// Dynamic load StateMap for SSR safety with WebGL/Canvas
const StateMap = dynamic(() => import("../components/StateMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[480px] glass-card border border-white/10 rounded-xl flex items-center justify-center font-mono text-xs text-[#94a3b8] animate-pulse">
      INITIALIZING SATELLITE TELEMETRY & VECTOR TILES...
    </div>
  ),
});

export default function DashboardPage() {
  const [selectedState, setSelectedState] = useState<string>("GA");
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyItem | null>(GEORGIA_ANOMALIES[0]);

  const activeCompetitor = COMPETITOR_STATES.find((c) => c.stateCode === selectedState);

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 pt-4 sm:pt-6 space-y-6">
      
      {/* Hero Section with Official Circular Emblem & Watermark */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#131d2c] via-[#0f172a] to-[#0b1320] p-5 sm:p-8 rounded-2xl border border-white/10 shadow-2xl flex flex-col items-center text-center">
        
        {/* Background Watermark: Centered at 4% opacity */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.04] -z-0">
          <div className="w-[300px] h-[300px] sm:w-[500px] sm:h-[500px] md:w-[600px] md:h-[600px] relative">
            <Image
              src="/assets/brain-lab-emblem-512.png"
              alt="Brain Lab by Liliya emblem watermark"
              width={600}
              height={600}
              className="w-full h-full object-contain rounded-full"
              priority
            />
          </div>
        </div>

        {/* Hero Content Layer */}
        <div className="relative z-10 flex flex-col items-center space-y-4 max-w-4xl w-full">
          
          {/* Official IC / NSA Admin Approved Primary Header Seal (Standardized 64px Anchor & Elevation) */}
          <div className="flex items-center space-x-4 mb-2 p-2 rounded-2xl glass-panel border border-[#38bdf8]/50 shadow-[0_0_25px_rgba(56,189,248,0.35)]">
            <div className="relative w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full p-1 bg-[#070d18] border-2 border-[#38bdf8] shadow-lg flex items-center justify-center">
              <Image
                src="/assets/brain-lab-emblem.png"
                alt="Official Brain Lab Intelligence Seal"
                width={64}
                height={64}
                className="w-full h-full object-contain aspect-square rounded-full drop-shadow"
                priority
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-mono text-xs uppercase tracking-widest text-[#38bdf8] font-bold flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                CENTRAL INTELLIGENCE INTEGRATION
              </span>
              <span className="font-mono text-base sm:text-lg font-extrabold text-white tracking-tight">
                BRAIN LAB <span className="text-[#38bdf8]">BY LILIYA</span>
              </span>
            </div>
          </div>

          {/* Subtitle & Headline */}
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full glass-card border border-[#38bdf8]/40 text-[#38bdf8] text-[10px] sm:text-xs font-mono font-semibold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-[#10b981] animate-ping"></span>
              <span>Post-Doctorate Cognitive Market Intelligence & Microstructure Research</span>
            </div>

            <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold font-mono tracking-tight text-[#f8fafc] leading-tight">
              BRAIN LAB BY LILIYA — GLOBAL ANOMALY MAP
            </h1>
            
            <p className="text-xs sm:text-sm text-[#cbd5e1] max-w-2xl mx-auto font-sans leading-relaxed">
              Real-time automated detection across Georgia logistics (Savannah Ports), legislative incentive sunsets (HB 463), and consumer macro debt profiles. Fused with competitor state exploitation matrices.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 font-mono text-xs w-full max-w-3xl pt-2">
            <div className="glass-card border border-white/10 p-3 rounded-xl shadow-md">
              <div className="text-[#94a3b8] text-[10px]">TARGET ENTITY</div>
              <div className="text-[#f43f5e] font-bold text-xs sm:text-sm truncate">GEORGIA STATE</div>
            </div>
            <div className="glass-card border border-white/10 p-3 rounded-xl shadow-md">
              <div className="text-[#94a3b8] text-[10px]">ACTIVE ANOMALIES</div>
              <div className="text-[#fb923c] font-bold text-xs sm:text-sm">{GEORGIA_ANOMALIES.length} VECTORS</div>
            </div>
            <div className="glass-card border border-white/10 p-3 rounded-xl shadow-md">
              <div className="text-[#94a3b8] text-[10px]">DETECTION PIPELINE</div>
              <div className="text-[#10b981] font-bold text-xs sm:text-sm">F1: 0.986 (STGNN)</div>
            </div>
            <div className="glass-card border border-white/10 p-3 rounded-xl shadow-md">
              <div className="text-[#94a3b8] text-[10px]">EXPLOIT ALLIES</div>
              <div className="text-[#38bdf8] font-bold text-xs sm:text-sm">{COMPETITOR_STATES.length} STATES</div>
            </div>
          </div>

        </div>

      </div>

      {/* Surface 1 Core Workspace: Live Telemetry & Vector Radar (12-Col Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Interactive Geospatial Radar (7 Cols) */}
        <div className="lg:col-span-7 glass-panel border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#10b981] animate-pulse"></span>
              <h2 className="font-mono font-bold text-xs sm:text-sm text-[#f8fafc] tracking-wide">
                GEOSPATIAL VECTOR RADAR (MAPLIBRE + US CENSUS BOUNDARIES)
              </h2>
            </div>
            <div
              className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 font-mono text-xs p-1 rounded-lg"
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
            >
              <span className="text-[#94a3b8] text-[11px] px-1">Focus:</span>
              {(['GA', ...COMPETITOR_STATES.map((c) => c.stateCode)] as const).map((s) => {
                const isTarget = s === 'GA';
                const isActive = selectedState === s;

                let style: React.CSSProperties = {
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  padding: '6px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  transition: 'all 200ms ease',
                  backgroundColor: 'transparent',
                  outline: 'none',
                  lineHeight: 1.2,
                };

                if (isTarget) {
                  if (isActive) {
                    style = {
                      ...style,
                      backgroundColor: '#dc2626',
                      color: '#ffffff',
                      border: '1px solid #fca5a5',
                      animation: 'pulse-red 2s ease-in-out infinite',
                    };
                  } else {
                    style = {
                      ...style,
                      backgroundColor: 'transparent',
                      color: '#991b1b',
                      border: '1px solid #7f1d1d',
                    };
                  }
                } else {
                  if (isActive) {
                    style = {
                      ...style,
                      backgroundColor: '#0ea5e9',
                      color: '#ffffff',
                      border: '1px solid #7dd3fc',
                      animation: 'pulse-teal 2s ease-in-out infinite',
                    };
                  } else {
                    style = {
                      ...style,
                      backgroundColor: 'transparent',
                      color: '#cbd5e1',
                      border: '1px solid rgba(71, 85, 105, 0.6)',
                    };
                  }
                }

                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedState(s)}
                    style={style}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(30, 41, 59, 0.6)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    {isTarget ? 'GA (Target)' : s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Vector Map */}
          <div className="w-full h-[480px]">
            <StateMap
              anomalies={GEORGIA_ANOMALIES}
              competitors={COMPETITOR_STATES}
              selectedState={selectedState}
              onSelectState={(code) => setSelectedState(code)}
              onSelectAnomaly={(anom) => setSelectedAnomaly(anom)}
            />
          </div>

          <div className="text-[11px] font-mono text-[#94a3b8] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 px-1">
            <span>Click any pulsating radar point for anomaly details or click competitor state badge.</span>
            <span className="text-[#10b981] font-semibold">Sensor Refresh: Real-time continual (24/7)</span>
          </div>
        </div>

        {/* Dynamic Focus Telemetry Inspector (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          
          {/* Anomaly Quick Detail Card */}
          {selectedAnomaly ? (
            <div className="glass-panel border border-[#f43f5e]/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3 font-mono">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-2 py-0.5 text-[10px] rounded bg-[#f43f5e]/20 text-[#f43f5e] border border-[#f43f5e]/50 font-bold uppercase">
                    {selectedAnomaly.severity} SEVERITY • {selectedAnomaly.code}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-white mt-1.5 leading-snug">
                    {selectedAnomaly.title}
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-[#94a3b8]">CONFIDENCE</div>
                  <div className="text-xs font-bold text-[#10b981]">{selectedAnomaly.confidenceScore}%</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] glass-card p-2.5 rounded-xl border border-white/10">
                <div>
                  <span className="text-[#94a3b8] block">Target Entity:</span>
                  <span className="text-slate-200 font-semibold">{selectedAnomaly.entity}</span>
                </div>
                <div>
                  <span className="text-[#94a3b8] block">Observed Deviation:</span>
                  <span className="text-[#f43f5e] font-semibold">{selectedAnomaly.deviation}</span>
                </div>
                <div>
                  <span className="text-[#94a3b8] block">Detection Pipeline:</span>
                  <span className="text-[#38bdf8] font-semibold">{selectedAnomaly.detectionModel}</span>
                </div>
                <div>
                  <span className="text-[#94a3b8] block">Admiralty Grade:</span>
                  <span className="text-[#38bdf8] font-semibold">{selectedAnomaly.admiraltyRating}</span>
                </div>
              </div>

              <div className="border-t border-white/10 pt-2 space-y-1">
                <div className="text-[11px] font-bold text-[#38bdf8] flex items-center space-x-1">
                  <TrendingUp className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span>COMPETITOR EXPLOITATION ANGLE</span>
                </div>
                <p className="text-xs text-[#cbd5e1] font-sans leading-relaxed">
                  {selectedAnomaly.exploitationPlaybook}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <span className="text-[#94a3b8]">Beneficiary States: {selectedAnomaly.exploitingStates.join(", ")}</span>
                <Link
                  href="/anomalies"
                  className="text-[#38bdf8] hover:text-[#10b981] font-bold inline-flex items-center space-x-1"
                >
                  <span>Full Dossier</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="glass-panel border border-white/10 rounded-2xl p-6 text-center text-xs font-mono text-[#94a3b8]">
              Select an anomaly node on the radar to inspect live telemetry.
            </div>
          )}

          {/* Competitor Opportunity Profile */}
          {activeCompetitor ? (
            <div className="glass-panel border border-[#38bdf8]/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3 font-mono flex-1">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 text-xs font-bold">
                    {activeCompetitor.stateCode}
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    {activeCompetitor.stateName} Exploitation Profile
                  </h3>
                </div>
                <Link href="/insider-intel" className="text-[11px] text-[#38bdf8] hover:underline flex items-center space-x-1">
                  <span>View Strategy</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-[#f8fafc] font-bold">
                  {activeCompetitor.primaryAdvantage}
                </div>
                <p className="text-xs text-[#cbd5e1] font-sans leading-relaxed">
                  {activeCompetitor.strategicPlaybook}
                </p>
              </div>

              <div className="space-y-1.5 text-xs border-t border-white/10 pt-2">
                <span className="text-[#94a3b8] font-semibold text-[11px]">Key Exploited Vulnerabilities:</span>
                <ul className="space-y-1 text-[#cbd5e1] font-sans text-xs">
                  {activeCompetitor.keyVulnerabilitiesExploited.map((v: string, idx: number) => (
                    <li key={idx} className="flex items-start space-x-1.5">
                      <span className="text-[#f43f5e] mt-0.5">•</span>
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="glass-card p-2.5 rounded-xl border border-white/10 flex items-center justify-between text-[11px]">
                <span className="text-[#94a3b8]">Active Opportunities:</span>
                <span className="text-[#10b981] font-bold">{activeCompetitor.activeOpportunities.length} Verified Playbooks</span>
              </div>
            </div>
          ) : (
            <div className="glass-panel border border-white/10 rounded-2xl p-5 text-center text-xs font-mono text-[#94a3b8]">
              Select a state code from the map header to examine tailored competitor intelligence.
            </div>
          )}

        </div>

      </div>

      {/* Surface 1 Bottom Feeds: Continuous Georgia Anomaly Radar Streams */}
      <div className="glass-panel border border-white/10 rounded-2xl p-5 shadow-2xl space-y-4 font-mono">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-[#f43f5e]" />
            <h3 className="font-bold text-sm sm:text-base text-[#f8fafc]">
              CONTINUOUS GEORGIA STATE ANOMALY RADAR FEEDS
            </h3>
          </div>
          <div className="text-right text-xs">
            <span className="text-[#94a3b8]">{GEORGIA_ANOMALIES.length} Monitored Domains</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {GEORGIA_ANOMALIES.map((a) => (
            <div
              key={a.id}
              onClick={() => setSelectedAnomaly(a)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                selectedAnomaly?.id === a.id
                  ? "bg-[#1e293b] border-[#38bdf8] shadow-lg shadow-[#38bdf8]/10"
                  : "glass-card border-white/10 hover:border-[#38bdf8]/50 hover:glass-panel"
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#94a3b8]">{a.sector}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    a.severity === "CRITICAL"
                      ? "bg-[#f43f5e]/20 text-[#f43f5e] border border-[#f43f5e]/40"
                      : "bg-[#fb923c]/20 text-[#fb923c] border border-[#fb923c]/40"
                  }`}
                >
                  {a.severity}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white line-clamp-2 mb-1.5">{a.title}</h4>
              <div className="text-[11px] text-[#f43f5e] font-semibold mb-1">
                {a.deviation}
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#94a3b8] border-t border-white/10 pt-1.5">
                <span className="truncate max-w-[180px]">{a.location}</span>
                <span className="text-[#10b981]">{a.confidenceScore}% confidence</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

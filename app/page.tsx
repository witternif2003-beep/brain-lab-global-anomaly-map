"use client";
import React, { useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { GEORGIA_ANOMALIES, COMPETITOR_STATES } from "../lib/data";
import { AnomalyItem } from "../lib/schema";
import { Activity, AlertTriangle, ArrowRight, ShieldCheck, Zap, Globe, TrendingUp, Cpu, Compass } from "lucide-react";
import Link from "next/link";
import RotatingHeroEmblem from "../components/RotatingHeroEmblem";

// Dynamic load StateMap for SSR safety with WebGL/MapLibre
const StateMap = dynamic(() => import("../components/StateMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[480px] bg-[#2a2236] border border-[#54446d] rounded-xl flex items-center justify-center font-mono text-xs text-[#baaed3] animate-pulse">
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
      <div className="relative overflow-hidden bg-gradient-to-b from-[#332a42] via-[#2d243a] to-[#241c2f] p-5 sm:p-8 rounded-2xl border border-[#54446d] shadow-2xl flex flex-col items-center text-center">
        
        {/* Background Watermark: Centered at 5% opacity */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.05] -z-0">
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
          
          {/* Centered Rotating Glowing Neon Circular Emblem */}
          <RotatingHeroEmblem className="mb-1" />

          {/* Subtitle & Headline */}
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#2a2236]/90 border border-[#ffd87a]/40 text-[#ffd87a] text-[10px] sm:text-xs font-mono font-semibold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-[#ffd87a] animate-ping"></span>
              <span>Post-Doctorate Cognitive Market Intelligence & Microstructure Research</span>
            </div>

            <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold font-mono tracking-tight text-[#f5effa] leading-tight">
              BRAIN LAB BY LILIYA — GLOBAL ANOMALY MAP
            </h1>
            
            <p className="text-xs sm:text-sm text-[#e5bca8] max-w-2xl mx-auto font-sans leading-relaxed">
              Real-time automated detection across Georgia logistics (Savannah Ports), legislative incentive sunsets (HB 463), and consumer macro debt profiles. Fused with competitor state exploitation matrices.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 font-mono text-xs w-full max-w-3xl pt-2">
            <div className="bg-[#2a2236]/90 border border-[#54446d] p-3 rounded-xl shadow-md">
              <div className="text-[#baaed3] text-[10px]">TARGET ENTITY</div>
              <div className="text-[#e580b5] font-bold text-xs sm:text-sm truncate">GEORGIA STATE</div>
            </div>
            <div className="bg-[#2a2236]/90 border border-[#54446d] p-3 rounded-xl shadow-md">
              <div className="text-[#baaed3] text-[10px]">ACTIVE ANOMALIES</div>
              <div className="text-[#ffd87a] font-bold text-xs sm:text-sm">{GEORGIA_ANOMALIES.length} VECTORS</div>
            </div>
            <div className="bg-[#2a2236]/90 border border-[#54446d] p-3 rounded-xl shadow-md">
              <div className="text-[#baaed3] text-[10px]">DETECTION PIPELINE</div>
              <div className="text-[#88f4e2] font-bold text-xs sm:text-sm">F1: 0.986 (STGNN)</div>
            </div>
            <div className="bg-[#2a2236]/90 border border-[#54446d] p-3 rounded-xl shadow-md">
              <div className="text-[#baaed3] text-[10px]">EXPLOIT ALLIES</div>
              <div className="text-[#62d3ee] font-bold text-xs sm:text-sm">{COMPETITOR_STATES.length} STATES</div>
            </div>
          </div>

        </div>

      </div>

      {/* Surface 1 Core Workspace: Live Telemetry & Vector Radar (12-Col Grid) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Interactive Geospatial Radar (7 Cols) */}
        <div className="lg:col-span-7 bg-[#332a42] border border-[#54446d] rounded-2xl p-4 sm:p-5 shadow-2xl space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#54446d] pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-[#62d3ee] animate-pulse"></span>
              <h2 className="font-mono font-bold text-xs sm:text-sm text-[#f5effa] tracking-wide">
                GEOSPATIAL VECTOR RADAR (MAPLIBRE + US CENSUS BOUNDARIES)
              </h2>
            </div>
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0 font-mono text-xs">
              <span className="text-[#baaed3] text-[11px]">Focus:</span>
              <button
                onClick={() => setSelectedState("GA")}
                className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
                  selectedState === "GA"
                    ? "bg-[#e580b5] text-[#241c2f] font-bold shadow"
                    : "bg-[#2a2236] text-[#baaed3] hover:text-white"
                }`}
              >
                GA (Target)
              </button>
              {COMPETITOR_STATES.map((c) => (
                <button
                  key={c.stateCode}
                  onClick={() => setSelectedState(c.stateCode)}
                  className={`px-2 py-0.5 rounded text-xs font-semibold transition-all ${
                    selectedState === c.stateCode
                      ? "bg-[#62d3ee] text-[#241c2f] font-bold shadow"
                      : "bg-[#2a2236] text-[#baaed3] hover:text-white"
                  }`}
                >
                  {c.stateCode}
                </button>
              ))}
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

          <div className="text-[11px] font-mono text-[#baaed3] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 px-1">
            <span>Click any pulsating radar point for anomaly details or click competitor state badge.</span>
            <span className="text-[#88f4e2] font-semibold">Sensor Refresh: Real-time continual (24/7)</span>
          </div>
        </div>

        {/* Dynamic Focus Telemetry Inspector (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          
          {/* Anomaly Quick Detail Card */}
          {selectedAnomaly ? (
            <div className="bg-[#332a42] border border-[#e580b5]/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3 font-mono">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-2 py-0.5 text-[10px] rounded bg-[#e580b5]/20 text-[#e580b5] border border-[#e580b5]/50 font-bold uppercase">
                    {selectedAnomaly.severity} SEVERITY • {selectedAnomaly.code}
                  </span>
                  <h3 className="text-sm sm:text-base font-bold text-white mt-1.5 leading-snug">
                    {selectedAnomaly.title}
                  </h3>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-[10px] text-[#baaed3]">CONFIDENCE</div>
                  <div className="text-xs font-bold text-[#88f4e2]">{selectedAnomaly.confidenceScore}%</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#2a2236]/90 p-2.5 rounded-xl border border-[#54446d]">
                <div>
                  <span className="text-[#baaed3] block">Target Entity:</span>
                  <span className="text-slate-200 font-semibold">{selectedAnomaly.entity}</span>
                </div>
                <div>
                  <span className="text-[#baaed3] block">Observed Deviation:</span>
                  <span className="text-[#e580b5] font-semibold">{selectedAnomaly.deviation}</span>
                </div>
                <div>
                  <span className="text-[#baaed3] block">Detection Pipeline:</span>
                  <span className="text-[#62d3ee] font-semibold">{selectedAnomaly.detectionModel}</span>
                </div>
                <div>
                  <span className="text-[#baaed3] block">Admiralty Grade:</span>
                  <span className="text-[#ffd87a] font-semibold">{selectedAnomaly.admiraltyRating}</span>
                </div>
              </div>

              <div className="border-t border-[#54446d] pt-2 space-y-1">
                <div className="text-[11px] font-bold text-[#ffd87a] flex items-center space-x-1">
                  <TrendingUp className="w-3.5 h-3.5 text-[#ffd87a]" />
                  <span>COMPETITOR EXPLOITATION ANGLE</span>
                </div>
                <p className="text-xs text-[#e5bca8] font-sans leading-relaxed">
                  {selectedAnomaly.exploitationPlaybook}
                </p>
              </div>

              <div className="flex items-center justify-between pt-1 text-[11px]">
                <span className="text-[#baaed3]">Beneficiary States: {selectedAnomaly.exploitingStates.join(", ")}</span>
                <Link
                  href="/anomalies"
                  className="text-[#62d3ee] hover:text-[#88f4e2] font-bold inline-flex items-center space-x-1"
                >
                  <span>Full Dossier</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-[#332a42] border border-[#54446d] rounded-2xl p-6 text-center text-xs font-mono text-[#baaed3]">
              Select an anomaly node on the radar to inspect live telemetry.
            </div>
          )}

          {/* Competitor Opportunity Profile */}
          {activeCompetitor ? (
            <div className="bg-[#332a42] border border-[#62d3ee]/40 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3 font-mono flex-1">
              <div className="flex items-center justify-between border-b border-[#54446d] pb-2">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-[#62d3ee]/20 text-[#62d3ee] border border-[#62d3ee]/40 text-xs font-bold">
                    {activeCompetitor.stateCode}
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    {activeCompetitor.stateName} Exploitation Profile
                  </h3>
                </div>
                <Link href="/insider-intel" className="text-[11px] text-[#62d3ee] hover:underline flex items-center space-x-1">
                  <span>View Strategy</span>
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-[#f5effa] font-bold">
                  {activeCompetitor.primaryAdvantage}
                </div>
                <p className="text-xs text-[#e5bca8] font-sans leading-relaxed">
                  {activeCompetitor.strategicPlaybook}
                </p>
              </div>

              <div className="space-y-1.5 text-xs border-t border-[#54446d] pt-2">
                <span className="text-[#baaed3] font-semibold text-[11px]">Key Exploited Vulnerabilities:</span>
                <ul className="space-y-1 text-[#e5bca8] font-sans text-xs">
                  {activeCompetitor.keyVulnerabilitiesExploited.map((v: string, idx: number) => (
                    <li key={idx} className="flex items-start space-x-1.5">
                      <span className="text-[#e580b5] mt-0.5">•</span>
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="bg-[#2a2236]/90 p-2.5 rounded-xl border border-[#54446d] flex items-center justify-between text-[11px]">
                <span className="text-[#baaed3]">Active Opportunities:</span>
                <span className="text-[#88f4e2] font-bold">{activeCompetitor.activeOpportunities.length} Verified Playbooks</span>
              </div>
            </div>
          ) : (
            <div className="bg-[#332a42] border border-[#54446d] rounded-2xl p-5 text-center text-xs font-mono text-[#baaed3]">
              Select a state code from the map header to examine tailored competitor intelligence.
            </div>
          )}

        </div>

      </div>

      {/* Surface 1 Bottom Feeds: Continuous Georgia Anomaly Radar Streams */}
      <div className="bg-[#332a42] border border-[#54446d] rounded-2xl p-5 shadow-2xl space-y-4 font-mono">
        <div className="flex items-center justify-between border-b border-[#54446d] pb-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-[#e580b5]" />
            <h3 className="font-bold text-sm sm:text-base text-[#f5effa]">
              CONTINUOUS GEORGIA STATE ANOMALY RADAR FEEDS
            </h3>
          </div>
          <div className="text-right text-xs">
            <span className="text-[#baaed3]">{GEORGIA_ANOMALIES.length} Monitored Domains</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {GEORGIA_ANOMALIES.map((a) => (
            <div
              key={a.id}
              onClick={() => setSelectedAnomaly(a)}
              className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
                selectedAnomaly?.id === a.id
                  ? "bg-[#3b304d] border-[#e580b5] shadow-lg shadow-[#e580b5]/10"
                  : "bg-[#2a2236]/90 border-[#54446d] hover:border-[#6b578a] hover:bg-[#332a42]"
              }`}
            >
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[#baaed3]">{a.sector}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    a.severity === "CRITICAL"
                      ? "bg-[#e580b5]/20 text-[#e580b5] border border-[#e580b5]/40"
                      : "bg-[#ffd87a]/20 text-[#ffd87a] border border-[#ffd87a]/40"
                  }`}
                >
                  {a.severity}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white line-clamp-2 mb-1.5">{a.title}</h4>
              <div className="text-[11px] text-[#e580b5] font-semibold mb-1">
                {a.deviation}
              </div>
              <div className="flex items-center justify-between text-[10px] text-[#baaed3] border-t border-[#54446d] pt-1.5">
                <span className="truncate max-w-[180px]">{a.location}</span>
                <span className="text-[#88f4e2]">{a.confidenceScore}% confidence</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

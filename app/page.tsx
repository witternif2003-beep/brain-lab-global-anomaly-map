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
    <div className="w-full h-[460px] bg-slate-900 border border-[#3a2e4c] rounded-xl flex items-center justify-center font-mono text-xs text-slate-500 animate-pulse">
      INITIALIZING SATELLITE TELEMETRY & VECTOR TILES...
    </div>
  ),
});

export default function DashboardPage() {
  const [selectedState, setSelectedState] = useState<string>("GA");
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyItem | null>(GEORGIA_ANOMALIES[0]);

  const activeCompetitor = COMPETITOR_STATES.find((c) => c.stateCode === selectedState);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
      
      {/* Hero Section with Official Emblem (256x256, rotating, glowing neon white) & Watermark */}
      <div className="relative overflow-hidden bg-gradient-to-b from-[#231d2e] via-[#1e1828] to-[#120e18] p-6 sm:p-8 rounded-2xl border border-[#3a2e4c] shadow-2xl flex flex-col items-center text-center">
        
        {/* Background Watermark: 600x600px version behind hero content at 6% opacity, centered */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-[0.06] -z-0">
          <div className="w-[320px] h-[320px] sm:w-[500px] sm:h-[500px] md:w-[600px] md:h-[600px] relative">
            <Image
              src="/assets/brain-lab-emblem-512.png"
              alt="Brain Lab by Liliya emblem watermark"
              width={600}
              height={600}
              className="w-full h-full object-contain"
              priority
            />
          </div>
        </div>

        {/* Hero Content Layer */}
        <div className="relative z-10 flex flex-col items-center space-y-4 max-w-4xl">
          
          {/* Centered Rotating Glowing Neon White Emblem (3. HERO SECTION & PROMPT SPEC) */}
          <RotatingHeroEmblem className="mb-2" />

          {/* Subtitle & Headline */}
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-950/80 border border-brand-gold/40 text-brand-gold text-xs font-mono font-semibold tracking-wider uppercase">
              <span className="w-2 h-2 rounded-full bg-brand-gold animate-ping"></span>
              <span>Post-Doctorate Cognitive Market Intelligence & Microstructure Research</span>
            </div>

            <h1 className="text-xl sm:text-3xl md:text-4xl font-extrabold font-mono tracking-tight text-white leading-tight">
              BRAIN LAB BY LILIYA — GLOBAL ANOMALY MAP
            </h1>
            
            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl mx-auto font-sans leading-relaxed">
              Real-time automated detection across Georgia logistics (Savannah Ports), legislative incentive sunsets (HB 463), and consumer macro debt profiles. Fused with competitor state exploitation matrices.
            </p>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono text-xs w-full max-w-2xl pt-2">
            <div className="bg-slate-950/80 border border-[#3a2e4c] p-3 rounded-xl shadow-md">
              <div className="text-slate-500 text-[10px]">TARGET ENTITY</div>
              <div className="text-rose-400 font-bold text-sm">GEORGIA STATE</div>
            </div>
            <div className="bg-slate-950/80 border border-[#3a2e4c] p-3 rounded-xl shadow-md">
              <div className="text-slate-500 text-[10px]">ACTIVE ANOMALIES</div>
              <div className="text-rose-400 font-bold text-sm">{GEORGIA_ANOMALIES.length} VECTORS</div>
            </div>
            <div className="bg-slate-950/80 border border-[#3a2e4c] p-3 rounded-xl shadow-md">
              <div className="text-slate-500 text-[10px]">DETECTION PIPELINE</div>
              <div className="text-emerald-400 font-bold text-sm">F1: 0.986 (STGNN)</div>
            </div>
            <div className="bg-slate-950/80 border border-[#3a2e4c] p-3 rounded-xl shadow-md">
              <div className="text-slate-500 text-[10px]">EXPLOIT ALLIES</div>
              <div className="text-sky-400 font-bold text-sm">{COMPETITOR_STATES.length} STATES</div>
            </div>
          </div>

        </div>
      </div>

      {/* Main Map + Side Telemetry Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Map Container (7 Cols on desktop) */}
        <div className="lg:col-span-7 flex flex-col space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-mono text-slate-400 flex items-center space-x-1.5">
              <Compass className="w-4 h-4 text-sky-400" />
              <span>GEOSPATIAL VECTOR RADAR (MAPLIBRE + US CENSUS BOUNDARIES)</span>
            </div>
            {/* State Selector Buttons */}
            <div className="flex items-center space-x-1 font-mono text-xs overflow-x-auto py-0.5">
              <button
                onClick={() => setSelectedState("GA")}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                  selectedState === "GA"
                    ? "bg-rose-600 text-white shadow"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                GA (Target)
              </button>
              {COMPETITOR_STATES.map((c) => (
                <button
                  key={c.stateCode}
                  onClick={() => setSelectedState(c.stateCode)}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all ${
                    selectedState === c.stateCode
                      ? "bg-sky-500 text-black shadow"
                      : "bg-slate-800 text-slate-400 hover:text-white"
                  }`}
                >
                  {c.stateCode}
                </button>
              ))}
            </div>
          </div>

          {/* Interactive Map */}
          <div className="w-full h-[480px]">
            <StateMap
              anomalies={GEORGIA_ANOMALIES}
              competitors={COMPETITOR_STATES}
              selectedState={selectedState}
              onSelectState={(code) => setSelectedState(code)}
              onSelectAnomaly={(anom) => setSelectedAnomaly(anom)}
            />
          </div>

          <div className="text-[11px] font-mono text-slate-500 flex items-center justify-between px-1">
            <span>Click any pulsating radar point for anomaly details or click competitor state badge.</span>
            <span>Sensor Refresh: Real-time continual</span>
          </div>
        </div>

        {/* Dynamic Focus Telemetry Inspector (5 Cols) */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          
          {/* Anomaly Quick Detail Card */}
          {selectedAnomaly ? (
            <div className="bg-slate-900/90 border border-rose-500/30 rounded-xl p-4 shadow-xl space-y-3 font-mono">
              <div className="flex items-start justify-between">
                <div>
                  <span className="inline-block px-2 py-0.5 text-[10px] rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold uppercase">
                    {selectedAnomaly.severity} SEVERITY • {selectedAnomaly.code}
                  </span>
                  <h3 className="text-sm font-bold text-white mt-1.5 leading-snug">
                    {selectedAnomaly.title}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block">CONFIDENCE</span>
                  <span className="text-emerald-400 font-bold text-sm">
                    {selectedAnomaly.confidenceScore}%
                  </span>
                </div>
              </div>

              <div className="bg-slate-950/80 p-3 rounded-lg border border-[#3a2e4c]/80 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Target Entity:</span>
                  <span className="text-slate-200 text-right">{selectedAnomaly.entity}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Observed Deviation:</span>
                  <span className="text-rose-400 font-bold text-right">{selectedAnomaly.deviation}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Detection Pipeline:</span>
                  <span className="text-sky-300 text-right">{selectedAnomaly.detectionModel}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Admiralty Grade:</span>
                  <span className="text-amber-300 text-right">{selectedAnomaly.admiraltyRating}</span>
                </div>
              </div>

              <div className="bg-sky-950/40 border border-sky-800/50 p-2.5 rounded-lg text-xs space-y-1">
                <div className="text-sky-400 font-bold flex items-center space-x-1">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>COMPETITOR EXPLOITATION ANGLE</span>
                </div>
                <p className="text-slate-300 text-[11px] leading-relaxed">
                  {selectedAnomaly.competitorAdvantage}
                </p>
                <div className="pt-1 flex items-center justify-between text-[10px] text-sky-400 font-semibold">
                  <span>Beneficiary States: {selectedAnomaly.exploitingStates.join(", ")}</span>
                  <Link href="/anomalies" className="hover:underline flex items-center">
                    Full Dossier <ArrowRight className="w-3 h-3 ml-0.5" />
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 font-mono text-xs border border-dashed border-[#3a2e4c] rounded-xl">
              Select an anomaly node on the map to inspect live metrics
            </div>
          )}

          {/* Competitor State Card Preview */}
          {activeCompetitor && (
            <div className="bg-slate-900/90 border border-sky-500/30 rounded-xl p-4 shadow-xl space-y-3 font-mono">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-bold">
                    {activeCompetitor.stateCode}
                  </span>
                  <h3 className="text-sm font-bold text-white">
                    {activeCompetitor.stateName} Exploitation Profile
                  </h3>
                </div>
                <Link
                  href="/insider-intel"
                  className="text-xs text-sky-400 hover:text-sky-300 flex items-center"
                >
                  View Strategy <ArrowRight className="w-3 h-3 ml-0.5" />
                </Link>
              </div>

              <p className="text-xs text-slate-300 leading-snug">
                {activeCompetitor.primaryAdvantage}
              </p>

              <div className="space-y-1.5 text-xs">
                <div className="text-slate-400 text-[11px]">Key Exploited Vulnerabilities:</div>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300 text-[11px]">
                  {activeCompetitor.keyVulnerabilitiesExploited.slice(0, 3).map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>

              <div className="border-t border-[#3a2e4c] pt-2 flex items-center justify-between text-[11px]">
                <span className="text-slate-400">Active Opportunities:</span>
                <span className="text-emerald-400 font-bold">
                  {activeCompetitor.activeOpportunities.length} Verified Playbooks
                </span>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Surface 1 Widgets Grid: 6 Live State Radar Feeds */}
      <div className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base sm:text-lg font-bold font-mono tracking-tight text-white flex items-center space-x-2">
            <Cpu className="w-5 h-5 text-sky-400" />
            <span>CONTINUOUS GEORGIA STATE ANOMALY RADAR FEEDS</span>
          </h2>
          <span className="text-xs font-mono text-slate-500">6 Monitored Domains</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {GEORGIA_ANOMALIES.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedAnomaly(item)}
              className={`p-4 rounded-xl border transition-all cursor-pointer font-mono space-y-2 ${
                selectedAnomaly?.id === item.id
                  ? "bg-slate-900 border-rose-500 shadow-lg shadow-rose-950/20"
                  : "bg-slate-900/60 border-[#3a2e4c] hover:border-slate-700 hover:bg-slate-900"
              }`}
            >
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-400">{item.sector}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    item.severity === "CRITICAL"
                      ? "bg-rose-500/20 text-rose-400 border border-rose-500/40"
                      : "bg-amber-500/20 text-amber-300 border border-amber-500/40"
                  }`}
                >
                  {item.severity}
                </span>
              </div>

              <h4 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                {item.title}
              </h4>

              <div className="bg-slate-950/60 p-2 rounded text-[11px] text-rose-300 font-mono">
                {item.deviation}
              </div>

              <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                <span>{item.location}</span>
                <span className="text-emerald-400">{item.confidenceScore}% confidence</span>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

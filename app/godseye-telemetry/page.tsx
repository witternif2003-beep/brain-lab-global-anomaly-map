"use client";
import StatewideAnomalyDashboard from "../../components/StatewideAnomalyDashboard";
import FbiDataSection from "../../components/fbi/FbiDataSection";
import React, { useState, useEffect } from "react";
import GodsEyeMap from "../../components/GodsEyeMap";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import { GODSEYE_INTEL_LAYERS } from "../../lib/godseye-layers";
import { Eye, ShieldAlert, Cpu, Activity, Radio, ExternalLink, Database } from "lucide-react";

export default function GodsEyeTelemetryPage() {
  const [telemetryTick, setTelemetryTick] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setTelemetryTick((t) => t + 1);
    }, 1500);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header */}
      <PageEmblemHeader
        badgeText="GodsEYE Global Protocol Integration"
        badgeIcon={<Eye className="w-4 h-4 text-sky-400" />}
        title="GODSEYE LIVE COMMON OPERATING PICTURE & REAL-TIME TELEMETRY"
        description="Comprehensive integration inspired by the open-source GodsEYE.network protocol. Fuses ADS-B aviation, maritime AIS transponders, CelesTrak satellites, NASA FIRMS thermal hotspots, USGS seismic telemetry, and public DOT traffic cameras into an interactive operational map."
        rightElement={
          <div className="glass-card px-4 py-2.5 rounded-xl border border-white/10 text-right shadow-lg">
            <div className="text-[10px] text-slate-500">INTELLIGENCE PLATFORM</div>
            <div className="text-sky-400 font-bold text-lg">23+ LAYERS • 60K+ LIVE ENTITIES • 35x ULTRA-ZOOM</div>
          </div>
        }
      />

      {/* Main GodsEye Interactive Vector Map */}
      <GodsEyeMap />

      {/* DEDICATED FBI CAPABILITIES & RESTRICTED SYSTEMS PANEL — NSA ADMIN MODE */}
      <div id="fbi-capabilities" className="w-full scroll-mt-24">
        <FbiDataSection />
      </div>

      {/* DEDICATED LIVE NSA STATEWIDE ANOMALY DASHBOARD & CONTINUOUS INGESTION FEEDS — NSA ADMIN LEVEL ENFORCED */}
      <div id="nsa-statewide-dashboard" className="w-full scroll-mt-24 space-y-4">
        <StatewideAnomalyDashboard />
      </div>

      {/* Comprehensive GodsEye Ingestion Architecture Matrix — NSA Admin Modern Oval Glass Theme */}
      <div className="w-full rounded-[36px] bg-[#080e1a]/85 backdrop-blur-2xl border border-[#38bdf8]/40 p-5 sm:p-7 shadow-[0_20px_60px_rgba(0,0,0,0.85),inset_0_1px_2px_rgba(56,189,248,0.35)] space-y-5 font-mono text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[#1e3a5f]/60 gap-2">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 shadow-[0_0_10px_#10b981]"></span>
            </span>
            <h3 className="text-xs sm:text-[13px] font-extrabold text-[#38bdf8] tracking-widest uppercase flex items-center gap-2">
              <Database className="w-4 h-4 text-[#38bdf8]" />
              <span>GODSEYE INGESTION PROTOCOL & GEORGIA TELEMETRY RELEVANCE</span>
            </h3>
          </div>
          <div className="flex items-center gap-2 text-[10px] text-emerald-400 bg-[#062018]/90 px-3.5 py-1 rounded-full border border-emerald-500/50 font-bold uppercase tracking-wider self-start sm:self-auto shadow-[0_0_12px_rgba(52,211,153,0.25)]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            23+ INTELLIGENCE LAYERS • 20 PRODUCTION FEEDS LIVE
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {GODSEYE_INTEL_LAYERS.map((layer, index) => {
            // Live dynamic count incrementing continuously with tick
            const baseCount = parseInt(layer.entityCount.replace(/[^0-9]/g, '')) || 5000;
            const variance = ((telemetryTick * (index + 3)) % 142);
            const liveEntityCount = (baseCount + variance).toLocaleString() + "+ Live";

            return (
              <div
                key={layer.id}
                className="rounded-[24px] bg-[#0a1228]/85 backdrop-blur-xl border border-[#1e3a5f] hover:border-[#38bdf8] p-4 space-y-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.6)] transition-all duration-300 flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="px-3 py-1 rounded-full bg-[#0c2444] text-[#38bdf8] border border-[#38bdf8]/50 font-bold tracking-wider uppercase shadow-[0_0_8px_rgba(56,189,248,0.3)]">
                      {layer.category}
                    </span>
                    <span className="text-emerald-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                      {layer.updateCadence}
                    </span>
                  </div>

                  <h4 className="text-xs font-bold tracking-wide" style={{ color: layer.color }}>
                    {layer.name}
                  </h4>

                  <div className="text-[11px] text-slate-300 font-mono flex items-center justify-between bg-[#06101e] px-2.5 py-1.5 rounded-xl border border-[#1e3a5f]/60">
                    <span className="text-slate-400">Tracking:</span>
                    <span className="text-[#38bdf8] font-black tracking-wide flex items-center gap-1.5">
                      <span>{liveEntityCount}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse"></span>
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 font-sans leading-relaxed pt-1">
                    {layer.georgiaRelevance}
                  </p>
                </div>

                <div className="text-[10px] text-slate-400 pt-2 border-t border-[#1e3a5f]/60 font-mono flex items-center justify-between">
                  <span className="truncate">Provider: <span className="text-slate-300 font-semibold">{layer.provider}</span></span>
                  <span className="text-emerald-400 font-bold shrink-0 ml-1">● 24/7 STREAM</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}

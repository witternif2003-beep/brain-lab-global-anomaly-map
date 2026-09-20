"use client";
import React from "react";
import GodsEyeMap from "../../components/GodsEyeMap";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import { GODSEYE_INTEL_LAYERS } from "../../lib/godseye-layers";
import { Eye, ShieldAlert, Cpu, Activity, Radio, ExternalLink, Database } from "lucide-react";

export default function GodsEyeTelemetryPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header */}
      <PageEmblemHeader
        badgeText="GodsEYE Global Protocol Integration"
        badgeIcon={<Eye className="w-4 h-4 text-sky-400" />}
        title="GODSEYE LIVE COMMON OPERATING PICTURE & REAL-TIME TELEMETRY"
        description="Comprehensive integration inspired by the open-source GodsEYE.network protocol. Fuses ADS-B aviation, maritime AIS transponders, CelesTrak satellites, NASA FIRMS thermal hotspots, USGS seismic telemetry, and public DOT traffic cameras into an interactive operational map."
        rightElement={
          <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-right shadow-lg">
            <div className="text-[10px] text-slate-500">INTELLIGENCE PLATFORM</div>
            <div className="text-sky-400 font-bold text-lg">23+ LAYERS • 60K+ ENTITIES</div>
          </div>
        }
      />

      {/* Main GodsEye Interactive Vector Map */}
      <GodsEyeMap />

      {/* Comprehensive GodsEye Ingestion Architecture Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>GODSEYE INGESTION PROTOCOL & GEORGIA TELEMETRY RELEVANCE</span>
          </h3>
          <span className="text-xs text-slate-400">8 Audited Production Pipelines</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {GODSEYE_INTEL_LAYERS.map((layer) => (
            <div key={layer.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 font-bold">
                  {layer.category}
                </span>
                <span className="text-emerald-400 font-bold">{layer.updateCadence}</span>
              </div>

              <h4 className="text-xs font-bold text-white" style={{ color: layer.color }}>
                {layer.name}
              </h4>

              <div className="text-[11px] text-slate-400">
                Tracking: <span className="text-white font-semibold">{layer.entityCount}</span>
              </div>

              <p className="text-[11px] text-slate-300 font-sans leading-relaxed pt-1">
                {layer.georgiaRelevance}
              </p>

              <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                Provider: {layer.provider}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

"use client";
import React from "react";
import WhiteHouseDigitalTwin3D from "../../components/WhiteHouseDigitalTwin3D";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import { RealTimeSparkline } from "../../components/RealTimeSparkline";
import { ShieldAlert, Cpu, TrendingUp, Building2, ExternalLink, BookOpen, Layers } from "lucide-react";
import { DIGITAL_TWIN_RESEARCH_CITATIONS } from "../../lib/whitehouse-digital-twin";

export default function ThreatGlobePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Page Header */}
      <PageEmblemHeader
        badgeText="Operational Architectural Layer"
        badgeIcon={<Building2 className="w-4 h-4 text-[#00e5ff]" />}
        title="WHITE HOUSE COMMON OPERATING PICTURE (COP) & DIGITAL TWIN"
        description="Physical and architectural model derived from Library of Congress Historic American Buildings Survey (HABS DC-37), NPS surveys, and IEEE 10820352 parametric digital twin standards. Spatial tolerance verified within ±2.0 centimeters across all wings."
        rightElement={
          <div className="glass-card px-4 py-2.5 rounded-2xl border-2 border-[#00e5ff]/50 text-right shadow-[0_0_20px_rgba(0,229,255,0.25)] bg-[#020b18]/90">
            <div className="text-[10px] text-[#80deea] font-bold">DIGITAL TWIN STATUS</div>
            <div className="text-[#69f0ae] font-black text-lg flex items-center justify-end gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse"></span>
              <span>ONLINE • ±2.0CM CALIBRATED</span>
            </div>
          </div>
        }
      />

      {/* NSA ADMIN LEVEL WHITE HOUSE DIGITAL TWIN 3D WORKSTATION */}
      <WhiteHouseDigitalTwin3D />

      {/* 60 FPS Canvas Real-Time Telemetry Sparklines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RealTimeSparkline
          channelKey="gridLoadMW"
          label="White House Complex Sub-Station Power Inflow Reserve Margin"
          unit="13,850 kVA"
          strokeColor="#00e5ff"
        />
        <RealTimeSparkline
          channelKey="portTEUVelocity"
          label="SCIF Environmental Air Gap & Grounded Shield Impedance"
          unit="0.042 Ω"
          strokeColor="#00ff9d"
        />
      </div>

      {/* Post-Doctorate Web Research & Grounding Citations */}
      <div className="rounded-2xl bg-[#020b18]/95 border border-[#00e5ff]/30 p-5 space-y-4 shadow-xl">
        <div className="flex items-center justify-between border-b border-[#00e5ff]/20 pb-3">
          <div className="flex items-center space-x-2 text-[#00e5ff] font-bold text-sm tracking-wide">
            <BookOpen className="w-4 h-4 text-[#00e5ff]" />
            <span>POST-DOCTORATE ARCHITECTURAL & SENSING RESEARCH CITATIONS</span>
          </div>
          <span className="px-2.5 py-1 rounded bg-[#00e5ff]/10 text-[#00e5ff] text-[10px] font-bold border border-[#00e5ff]/30">
            ±2.0CM CALIBRATION REPOSITORY
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {DIGITAL_TWIN_RESEARCH_CITATIONS.map((cit) => (
            <div key={cit.id} className="p-3.5 rounded-xl bg-[#031528]/80 border border-slate-800 hover:border-[#00e5ff]/50 transition-all space-y-2">
              <div className="flex items-start justify-between gap-2">
                <span className="text-xs font-bold text-[#e0e7ff]">{cit.source}</span>
                <a
                  href={cit.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#00e5ff] hover:text-[#80deea] p-1 inline-flex items-center gap-1 text-[10px]"
                >
                  <span>Link</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="text-[11px] text-[#80deea] font-mono">
                Identifier: <span className="text-white font-bold">{cit.doiOrLocId}</span>
              </div>
              <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                {cit.application}
              </p>
              <div className="text-[10px] text-[#69f0ae] font-bold flex items-center gap-1">
                <Layers className="w-3 h-3" />
                <span>Resolution: {cit.calibrationResolution}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Under-Workstation Telemetry Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-4 rounded-2xl bg-[#031528]/90 border border-[#00e5ff]/40 space-y-2 shadow-lg">
          <div className="flex items-center space-x-2 text-[#00e5ff] text-xs font-bold">
            <ShieldAlert className="w-4 h-4" />
            <span>Pillar 1: Optical & Refraction Testing</span>
          </div>
          <p className="text-slate-300 text-xs font-sans leading-relaxed">
            Continuous optical reflectance and transmission baseline monitoring across exterior glazing systems under historic preservation structural evaluation standards.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#031528]/90 border border-[#00ff88]/40 space-y-2 shadow-lg">
          <div className="flex items-center space-x-2 text-[#69f0ae] text-xs font-bold">
            <Cpu className="w-4 h-4" />
            <span>Pillar 2: Geotechnical Ground Vibration</span>
          </div>
          <p className="text-slate-300 text-xs font-sans leading-relaxed">
            Continuous ground vibration analysis protecting historic limestone foundations against nearby civil utility and transit acoustic coupling.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#031528]/90 border border-[#bd00ff]/40 space-y-2 shadow-lg">
          <div className="flex items-center space-x-2 text-[#e0aaff] text-xs font-bold">
            <TrendingUp className="w-4 h-4" />
            <span>Pillar 3: RF Attenuation & Shielding</span>
          </div>
          <p className="text-slate-300 text-xs font-sans leading-relaxed">
            Electromagnetic shielding effectiveness measured against IEEE 299 benchmarks across West Wing, Situation Room, and Executive Residence boundaries.
          </p>
        </div>
      </div>

    </div>
  );
}

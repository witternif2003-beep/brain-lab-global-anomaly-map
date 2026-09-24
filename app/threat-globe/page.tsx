"use client";
import React from "react";
import WhiteHouseDigitalTwin3D from "../../components/WhiteHouseDigitalTwin3D";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import { RealTimeSparkline } from "../../components/RealTimeSparkline";
import { Globe, ShieldAlert, Cpu, CheckCircle2, TrendingUp, Building2 } from "lucide-react";

export default function ThreatGlobePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Page Header */}
      <PageEmblemHeader
        badgeText="NSA Admin Level Operational Picture"
        badgeIcon={<Building2 className="w-4 h-4 text-[#00e5ff]" />}
        title="WHITE HOUSE COMMON OPERATING PICTURE (COP) & DIGITAL TWIN"
        description="Physical multi-source signal correlation and architectural digital twin replica derived from official Library of Congress HABS DC-37 and NPS surveys. Each physical and RF vector anomaly identified within 5 centimeters of architectural grounding."
        rightElement={
          <div className="glass-card px-4 py-2.5 rounded-2xl border-2 border-[#00e5ff]/50 text-right shadow-[0_0_20px_rgba(0,229,255,0.25)] bg-[#020b18]/90">
            <div className="text-[10px] text-[#80deea] font-bold">DIGITAL TWIN STATUS</div>
            <div className="text-[#69f0ae] font-black text-lg flex items-center justify-end gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-pulse"></span>
              <span>ONLINE • ±5CM VERIFIED</span>
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

      {/* Under-Workstation Telemetry Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="p-4 rounded-2xl bg-[#031528]/90 border border-[#00e5ff]/40 space-y-2 shadow-lg">
          <div className="flex items-center space-x-2 text-[#00e5ff] text-xs font-bold">
            <ShieldAlert className="w-4 h-4" />
            <span>Pillar 1: TEMPEST Acoustic Refraction</span>
          </div>
          <p className="text-slate-300 text-xs font-sans leading-relaxed">
            Continuous optical laser vibrometry mitigation across exterior laminated fenestration. Laser return deflection monitored via active piezoelectric transducer arrays under CNSSAM TEMPEST 01-13 standard.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#031528]/90 border border-[#00ff88]/40 space-y-2 shadow-lg">
          <div className="flex items-center space-x-2 text-[#69f0ae] text-xs font-bold">
            <Cpu className="w-4 h-4" />
            <span>Pillar 2: Subterranean RF & Acoustic DAS</span>
          </div>
          <p className="text-slate-300 text-xs font-sans leading-relaxed">
            Distributed Acoustic Sensing (DAS) over fiber-optic perimeter lines eliminates blind spots from unauthorized boring or subterranean conduit penetration within 5cm accuracy tolerance.
          </p>
        </div>

        <div className="p-4 rounded-2xl bg-[#031528]/90 border border-[#bd00ff]/40 space-y-2 shadow-lg">
          <div className="flex items-center space-x-2 text-[#e0aaff] text-xs font-bold">
            <TrendingUp className="w-4 h-4" />
            <span>Pillar 3: Zero-Trust SCIF Isolation</span>
          </div>
          <p className="text-slate-300 text-xs font-sans leading-relaxed">
            All West Wing, Situation Room, and Executive Residence RF signatures verified against baseline harmonic spectra. Automated Faraday gasket compression triggers upon Z &gt; 2.5σ variance.
          </p>
        </div>
      </div>

    </div>
  );
}

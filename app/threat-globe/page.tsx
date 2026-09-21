"use client";
import React from "react";
import ThreatGlobe3D from "../../components/ThreatGlobe3D";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import { RealTimeSparkline } from "../../components/RealTimeSparkline";
import { Globe, ShieldAlert, Cpu, CheckCircle2, TrendingUp } from "lucide-react";
import { GEORGIA_ANOMALIES, COMPETITOR_STATES } from "../../lib/data";

export default function ThreatGlobePage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Page Header */}
      <PageEmblemHeader
        badgeText="Operational Visualization Layer"
        badgeIcon={<Globe className="w-4 h-4 text-sky-400" />}
        title="3D THREAT GLOBE COMMON OPERATING PICTURE (COP)"
        description="Physical multi-source signal correlation projected onto an interactive 3D geospatial sphere. Correlates Port of Savannah logistics bottlenecks, legislative tax sunsets (HB 463), and consumer macro debt spikes before editorial news cycles emerge."
        rightElement={
          <div className="glass-card px-4 py-2.5 rounded-xl border border-white/10 text-right shadow-lg">
            <div className="text-[10px] text-slate-500">LIVE ORBIT FEED</div>
            <div className="text-emerald-400 font-bold text-lg">ONLINE • 100+ FEEDS</div>
          </div>
        }
      />

      {/* 3D Canvas Globe */}
      <ThreatGlobe3D />

      {/* 60 FPS Canvas Real-Time Telemetry Sparklines (React Bypassed Hot-Path) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RealTimeSparkline
          channelKey="gridLoadMW"
          label="Georgia Power High-Density Grid Reserve Margin"
          unit="18,450 MW"
          strokeColor="#00e5ff"
        />
        <RealTimeSparkline
          channelKey="portTEUVelocity"
          label="Savannah Mason Mega Rail Intermodal Velocity"
          unit="541,405 TEU"
          strokeColor="#00ff9d"
        />
      </div>

      {/* Under-Globe Telemetry Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="glass-panel border border-white/10 p-4 rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-rose-400 text-xs font-bold">
            <ShieldAlert className="w-4 h-4" />
            <span>Pillar 1: Logistics Infrastructure</span>
          </div>
          <p className="text-slate-300 text-xs font-sans leading-relaxed">
            Continuous AIS vessel telemetry tracks Port of Savannah berthing congestion (+67.8% dwell deviation) and Mason Mega Rail intermodal dispatch velocity. Exploited by South Carolina and Tennessee.
          </p>
        </div>

        <div className="glass-panel border border-white/10 p-4 rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-sky-400 text-xs font-bold">
            <Cpu className="w-4 h-4" />
            <span>Pillar 2: Incentive Parity (HB 463)</span>
          </div>
          <p className="text-slate-300 text-xs font-sans leading-relaxed">
            Statutory repeal of Headquarters Tax Credit, Port activity credits, and medical device manufacturing credits effective Jan 1, 2026, with total tax credit sunset in 2032. Exploited by North Carolina and Texas.
          </p>
        </div>

        <div className="glass-panel border border-white/10 p-4 rounded-xl space-y-2">
          <div className="flex items-center space-x-2 text-sky-400 text-xs font-bold">
            <TrendingUp className="w-4 h-4" />
            <span>Pillar 3: Consumer & Labor Distress</span>
          </div>
          <p className="text-slate-300 text-xs font-sans leading-relaxed">
            Georgia ranks 7th most financially distressed state in the US; 13.9% credit card delinquency rate. Healthcare ranks 49th for access, opening corporate talent recruitment pipelines for Florida and North Carolina.
          </p>
        </div>
      </div>

    </div>
  );
}

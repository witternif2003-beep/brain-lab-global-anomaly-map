"use client";
import React, { useState } from "react";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import { EXECUTIVE_PILLAR_STRATEGIES, PillarExploitationStrategy } from "../../lib/executive-pillar-intel";
import { ShieldAlert, TrendingUp, Layers, CheckCircle2, ArrowRight, DollarSign, Target, Award, Cpu } from "lucide-react";

export default function ThreePillarsPage() {
  const [selectedPillarId, setSelectedPillarId] = useState<string>("pillar-1-logistics");
  const activePillar = EXECUTIVE_PILLAR_STRATEGIES.find((p) => p.pillarId === selectedPillarId) || EXECUTIVE_PILLAR_STRATEGIES[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header */}
      <PageEmblemHeader
        badgeText="Executive Business Analysis Engine"
        badgeIcon={<Target className="w-4 h-4 text-rose-400" />}
        title="GEORGIA 3-PILLAR ECONOMIC ARCHITECTURE & COMPETITOR EXPLOITATION MATRIX"
        description="Comprehensive post-doctorate executive intelligence breaking down the three structural pillars of Georgia's economy. Quantifies vulnerabilities across Logistics, Legislative Incentives (HB 463), and Healthcare/Workforce Distress into actionable profit vectors for competitor states."
        rightElement={
          <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-right shadow-lg">
            <div className="text-[10px] text-slate-500">EXPLOITATION ANALYSIS</div>
            <div className="text-emerald-400 font-bold text-lg">3 PILLARS • 7 ALLY STATES</div>
          </div>
        }
      />

      {/* Pillar Navigation Tabs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {EXECUTIVE_PILLAR_STRATEGIES.map((p, idx) => (
          <button
            key={p.pillarId}
            onClick={() => setSelectedPillarId(p.pillarId)}
            className={`p-4 rounded-xl border text-left transition-all ${
              selectedPillarId === p.pillarId
                ? "bg-slate-900 border-rose-500 shadow-xl shadow-rose-950/20"
                : "bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
            }`}
          >
            <div className="flex items-center justify-between text-[10px] mb-1">
              <span className="text-brand-gold font-bold">PILLAR {idx + 1}</span>
              <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 font-bold">
                {p.competitorAllocations.length} Exploiting States
              </span>
            </div>
            <h3 className="text-xs font-bold text-white line-clamp-2">{p.pillarTitle}</h3>
            <p className="text-[11px] text-slate-400 font-sans mt-1 line-clamp-2">
              {p.georgiaEconomicAnchor}
            </p>
          </button>
        ))}
      </div>

      {/* Main Focus Pillar Analysis */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        
        {/* Pillar Header */}
        <div className="border-b border-slate-800 pb-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold">
              TARGET ARCHITECTURE: {activePillar.pillarTitle.toUpperCase()}
            </span>
            <span className="text-xs text-slate-400">Status: Critical Vulnerability Active</span>
          </div>
          <h2 className="text-base sm:text-xl font-bold text-white leading-snug">
            {activePillar.pillarTitle}
          </h2>
          <div className="text-xs text-slate-300 font-sans">
            <strong>Economic Anchor:</strong> {activePillar.georgiaEconomicAnchor}
          </div>
          <div className="text-xs text-slate-400 font-sans">
            <strong>Statewide Baseline Impact:</strong> {activePillar.statewideImpactBaseline}
          </div>
        </div>

        {/* Structural Vulnerability Alert Box */}
        <div className="bg-rose-950/25 border border-rose-800/50 p-4 rounded-xl space-y-1.5 text-xs">
          <div className="text-rose-400 font-bold flex items-center space-x-1.5">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>EXECUTIVE FORENSIC VULNERABILITY FINDING</span>
          </div>
          <p className="text-rose-200 text-xs leading-relaxed font-sans">
            {activePillar.detectedStructuralVulnerability}
          </p>
        </div>

        {/* Telemetry Evidence Chain */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
            <Layers className="w-4 h-4 text-sky-400" />
            <span>VERIFIED PRIMARY TELEMETRY METRICS</span>
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {activePillar.telemetryEvidenceMetrics.map((met, idx) => (
              <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
                <div className="text-white font-bold">{met.metric}</div>
                <div className="text-slate-400 text-[11px]">Baseline: <span className="text-slate-200">{met.baseline}</span></div>
                <div className="text-rose-400 font-semibold text-[11px]">Observed: {met.observedTelemetry}</div>
                <div className="bg-slate-900 p-2 rounded text-[10px] text-sky-300 flex justify-between">
                  <span>Deviation:</span>
                  <span className="font-bold">{met.deviationZScore}</span>
                </div>
                <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-900">
                  Source: {met.verifiedPrimarySource}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Competitor Exploitation Playbooks Tailored for This Pillar */}
        <div className="space-y-4 pt-2">
          <h4 className="text-xs font-bold text-emerald-400 flex items-center space-x-1.5">
            <Award className="w-4 h-4 text-emerald-400" />
            <span>TAILORED COMPETITOR STATE EXPLOITATION DIRECTIVES</span>
          </h4>

          <div className="space-y-4">
            {activePillar.competitorAllocations.map((comp) => (
              <div key={comp.stateCode} className="bg-slate-950 p-5 rounded-xl border border-sky-900/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-bold">
                      {comp.stateCode} ({comp.stateName.toUpperCase()})
                    </span>
                    <span className="text-xs font-bold text-white">{comp.strategicAdvantageVector}</span>
                  </div>
                  <span className="text-emerald-400 font-bold text-xs">{comp.confidenceGrade} (VERIFIED)</span>
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-bold">EXECUTIVE INTERVENTION PLAYBOOK:</div>
                  <p className="text-xs text-slate-300 font-sans leading-relaxed">
                    {comp.executiveInterventionPlaybook}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-xs">
                  <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">QUANTIFIABLE FINANCIAL YIELD:</span>
                    <span className="text-emerald-400 font-bold text-xs">{comp.quantifiableFinancialYield}</span>
                  </div>
                  <div className="bg-slate-900/80 p-2.5 rounded border border-slate-800">
                    <span className="text-slate-400 text-[10px] block">ACTION HORIZON:</span>
                    <span className="text-sky-300 font-bold text-xs">{comp.timeHorizon}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

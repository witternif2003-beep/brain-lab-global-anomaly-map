"use client";
import React, { useState } from "react";
import { COMPETITOR_STATES } from "../../lib/data";
import { CompetitorStateIntel } from "../../lib/schema";
import { Cpu, TrendingUp, Target, Award } from "lucide-react";
import PageEmblemHeader from "../../components/PageEmblemHeader";

export default function InsiderIntelPage() {
  const [selectedStateCode, setSelectedStateCode] = useState<string>("NC");
  const selectedState = COMPETITOR_STATES.find(c => c.stateCode === selectedStateCode) || COMPETITOR_STATES[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header with Rotating Neon Glowing Emblem & Watermark */}
      <PageEmblemHeader
        badgeText="Surface 3: Competitor-Profitable Insider Intelligence Matrix"
        badgeIcon={<Cpu className="w-4 h-4 text-sky-400" />}
        title="STATE-SPECIFIC COMPETITOR EXPLOITATION PLAYBOOKS"
        description="Tailored tactical playbooks for NC, TN, FL, SC, and TX to systematically capture corporate relocations, industrial logistics freight, and medical workforce capital arbitrage from Georgia entities."
        rightElement={
          <div className="flex items-center space-x-1.5 overflow-x-auto bg-slate-950 p-1.5 rounded-xl border border-slate-800">
            {COMPETITOR_STATES.map((state) => (
              <button
                key={state.stateCode}
                onClick={() => setSelectedStateCode(state.stateCode)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  selectedStateCode === state.stateCode
                    ? "bg-sky-500 text-black shadow-lg shadow-sky-500/20"
                    : "text-slate-400 hover:text-white hover:bg-slate-900"
                }`}
              >
                {state.stateCode} ({state.stateName})
              </button>
            ))}
          </div>
        }
      />

      {/* Main Focus Dossier for Selected Competitor State */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono">
        
        {/* Left Column: State Advantage Summary & Opportunities */}
        <div className="lg:col-span-5 space-y-4">
          
          <div className="bg-slate-900 border border-sky-500/30 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 text-xs font-bold">
                BENEFICIARY: {selectedState.stateName.toUpperCase()} ({selectedState.stateCode})
              </span>
              <span className="text-emerald-400 text-xs font-bold">ACTIVE EXPLOITATION STATUS</span>
            </div>

            <h2 className="text-sm sm:text-base font-bold text-white leading-snug">
              {selectedState.primaryAdvantage}
            </h2>

            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs text-slate-300">
              <div className="text-slate-500 text-[10px] mb-1">TARGET GEORGIA WEAKNESS PILLAR</div>
              <div className="text-rose-400 font-semibold">{selectedState.targetGeorgiaPillar}</div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="text-slate-400 text-xs flex items-center space-x-1.5">
                <Target className="w-3.5 h-3.5 text-rose-400" />
                <span>EXPLOITED GEORGIA VULNERABILITIES:</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {selectedState.keyVulnerabilitiesExploited.map((v, i) => (
                  <li key={i} className="flex items-start space-x-2 bg-slate-950/60 p-2 rounded border border-slate-800/80">
                    <span className="text-rose-500 font-bold">•</span>
                    <span>{v}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Active Relocation & Arbitrage Opportunities */}
          <div className="space-y-3">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>ACTIONABLE RELOCATION CAMPAIGNS ({selectedState.activeOpportunities.length})</span>
            </div>

            {selectedState.activeOpportunities.map((opp) => (
              <div key={opp.id} className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">{opp.sector}</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    {opp.status}
                  </span>
                </div>
                <h4 className="text-xs font-bold text-white">{opp.title}</h4>
                <div className="flex items-center justify-between text-[11px] pt-1">
                  <span className="text-slate-400">Projected Margin ROI:</span>
                  <span className="text-emerald-400 font-bold">{opp.roiProjected}</span>
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1 border-t border-slate-800">
                  <span>Execution Horizon: {opp.exploitationWindow}</span>
                  <span>Confidence: {opp.confidenceGrade}</span>
                </div>
              </div>
            ))}
          </div>

        </div>

        {/* Right Column: Comparative Microstructure Metrics */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
            
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <TrendingUp className="w-4 h-4 text-sky-400" />
                <span>MICROSTRUCTURE COMPARATIVE AUDIT: {selectedState.stateName} VS GEORGIA</span>
              </h3>
              <span className="text-[11px] text-slate-400">Head-to-Head Telemetry</span>
            </div>

            <div className="space-y-4">
              {selectedState.comparativeMetrics.map((item, idx) => (
                <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{item.metric}</span>
                    <span className="text-[10px] text-slate-500">{item.source}</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-rose-950/20 border border-rose-900/40 p-2.5 rounded-lg">
                      <div className="text-rose-400 text-[10px] font-semibold">GEORGIA ENTITY METRIC</div>
                      <div className="text-slate-200 mt-0.5 font-medium">{item.georgiaValue}</div>
                    </div>
                    <div className="bg-sky-950/30 border border-sky-800/50 p-2.5 rounded-lg">
                      <div className="text-sky-400 text-[10px] font-semibold">{selectedState.stateName.toUpperCase()} METRIC</div>
                      <div className="text-slate-200 mt-0.5 font-medium">{item.competitorValue}</div>
                    </div>
                  </div>

                  <div className="bg-slate-900/90 p-2.5 rounded border border-slate-800 text-xs flex items-center justify-between">
                    <span className="text-slate-400">Calculated Competitor Premium:</span>
                    <span className="text-emerald-400 font-bold">{item.advantageDelta}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Strategic Directive */}
            <div className="bg-gradient-to-r from-sky-950/60 to-slate-950 border border-sky-600/40 p-4 rounded-xl space-y-2 text-xs">
              <div className="text-sky-300 font-bold flex items-center space-x-1.5">
                <Award className="w-4 h-4 text-sky-400" />
                <span>STRATEGIC RECRUITMENT DIRECTIVE</span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">
                {selectedState.strategicPlaybook}
              </p>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}

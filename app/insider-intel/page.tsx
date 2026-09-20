"use client";
import React, { useState } from "react";
import { COMPETITOR_STATES } from "../../lib/data";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import {
  Cpu,
  Target,
  ArrowRight,
  TrendingUp,
  Award,
  Zap,
  Building,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";

export default function InsiderIntelPage() {
  const [selectedState, setSelectedState] = useState<string>("NC");
  const activeCompetitor = COMPETITOR_STATES.find((c) => c.stateCode === selectedState) || COMPETITOR_STATES[0];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header */}
      <PageEmblemHeader
        badgeText="Competitor State Exploitation Engine"
        badgeIcon={<Cpu className="w-4 h-4 text-[#38bdf8]" />}
        title="POST-DOCTORATE COMPETITOR STATE EXPLOITATION PLAYBOOKS"
        description="Comprehensive intelligence playbooks for North Carolina, Tennessee, Florida, South Carolina, and Texas. Engineered to capture logistics freight, corporate headquarters, and capital investment from Georgia's structural policy and capacity constraints."
        rightElement={
          <div className="glass-panel px-4 py-2.5 rounded-xl border border-white/10 text-right shadow-lg">
            <div className="text-[10px] text-[#94a3b8]">COMPETITOR ALLIANCE</div>
            <div className="text-[#38bdf8] font-bold text-lg">{COMPETITOR_STATES.length} ALLY STATES</div>
          </div>
        }
      />

      {/* State Selection Bar */}
      <div className="glass-panel border border-white/10 rounded-2xl p-3 sm:p-4 shadow-xl">
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {COMPETITOR_STATES.map((c) => (
            <button
              key={c.stateCode}
              onClick={() => setSelectedState(c.stateCode)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center space-x-1.5 ${
                selectedState === c.stateCode
                  ? "bg-[#38bdf8] text-[#0b1320] shadow-md shadow-[#38bdf8]/20"
                  : "glass-card text-[#94a3b8] hover:text-white border border-white/10"
              }`}
            >
              <span>{c.stateCode} ({c.stateName})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Competitor Profile */}
      <div className="glass-panel border border-white/10 rounded-2xl p-6 shadow-2xl space-y-6">
        
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-4">
          <div className="space-y-1">
            <span className="px-2.5 py-0.5 rounded bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]/40 text-xs font-bold">
              BENEFICIARY: {activeCompetitor.stateName.toUpperCase()} ({activeCompetitor.stateCode})
            </span>
            <h2 className="text-lg sm:text-xl font-bold text-white mt-1">
              {activeCompetitor.primaryAdvantage}
            </h2>
            <div className="text-xs text-[#94a3b8] font-sans">
              <strong>Target Georgia Weakness:</strong> {activeCompetitor.targetGeorgiaPillar}
            </div>
          </div>
          <span className="text-xs font-bold text-[#10b981] px-3 py-1 rounded bg-[#10b981]/15 border border-[#10b981]/30 self-start sm:self-auto">
            ACTIVE EXPLOITATION STATUS: OPERATIONAL
          </span>
        </div>

        {/* Exploited Vulnerabilities List */}
        <div className="glass-card border border-white/10 p-4 rounded-xl space-y-2 text-xs">
          <div className="text-[#38bdf8] font-bold flex items-center space-x-1.5">
            <Target className="w-4 h-4 text-[#38bdf8]" />
            <span>EXPLOITED GEORGIA VULNERABILITIES</span>
          </div>
          <ul className="space-y-1.5 text-[#cbd5e1] font-sans text-xs pt-1">
            {activeCompetitor.keyVulnerabilitiesExploited.map((vuln: string, idx: number) => (
              <li key={idx} className="flex items-start space-x-2">
                <span className="text-[#f43f5e] font-bold">•</span>
                <span>{vuln}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Actionable Campaigns Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-white flex items-center space-x-1.5">
            <Award className="w-4 h-4 text-[#10b981]" />
            <span>ACTIONABLE RELOCATION CAMPAIGNS ({activeCompetitor.activeOpportunities.length})</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeCompetitor.activeOpportunities.map((opp: any) => (
              <div key={opp.id} className="glass-card p-4 rounded-xl border border-white/10 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#94a3b8] text-[10px]">{opp.sector}</span>
                  <span className="px-2 py-0.5 rounded bg-[#10b981]/20 text-[#10b981] font-bold text-[10px]">
                    {opp.status}
                  </span>
                </div>
                <h4 className="text-white font-bold">{opp.title}</h4>
                <div className="grid grid-cols-2 gap-2 glass-panel p-2 rounded text-[11px] border border-white/10">
                  <div>
                    <span className="text-[#94a3b8] block text-[10px]">Projected Margin ROI:</span>
                    <span className="text-[#10b981] font-bold">{opp.roiProjected}</span>
                  </div>
                  <div>
                    <span className="text-[#94a3b8] block text-[10px]">Execution Horizon:</span>
                    <span className="text-[#38bdf8] font-bold">{opp.exploitationWindow}</span>
                  </div>
                </div>
                <div className="text-[10px] text-[#94a3b8] text-right">
                  Confidence: <strong className="text-white">{opp.confidenceGrade}</strong>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Microstructure Comparative Audit */}
        <div className="space-y-3 border-t border-white/10 pt-4">
          <h3 className="text-xs font-bold text-white flex items-center space-x-1.5">
            <TrendingUp className="w-4 h-4 text-[#38bdf8]" />
            <span>MICROSTRUCTURE COMPARATIVE AUDIT: {activeCompetitor.stateName.toUpperCase()} VS GEORGIA</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {activeCompetitor.comparativeMetrics.map((met: any, idx: number) => (
              <div key={idx} className="glass-card p-3.5 rounded-xl border border-white/10 space-y-1.5">
                <div className="flex justify-between font-bold">
                  <span className="text-white">{met.metric}</span>
                  <span className="text-[#10b981]">{met.advantageDelta}</span>
                </div>
                <div className="text-[#94a3b8] text-[11px] flex justify-between">
                  <span>Georgia: <strong className="text-slate-300">{met.georgiaValue}</strong></span>
                  <span>{activeCompetitor.stateCode}: <strong className="text-[#38bdf8]">{met.competitorValue}</strong></span>
                </div>
                <div className="text-[10px] text-[#64748b] border-t border-white/10 pt-1">
                  Source: {met.source}
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

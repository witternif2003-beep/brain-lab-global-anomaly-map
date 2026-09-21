"use client";
import React, { useState } from "react";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import { TOP_GEORGIA_COUNTIES } from "../../lib/telemetry-upgrade-models";
import { Compass, ShieldAlert, Filter, Download, ArrowUpRight, CheckCircle2, TrendingUp } from "lucide-react";

export default function CountyMatrixPage() {
  const [pillarFilter, setPillarFilter] = useState<string>("ALL");

  const pillars = ["ALL", "Logistics", "Incentives", "Workforce & Healthcare", "Financial Distress"];

  const filtered = TOP_GEORGIA_COUNTIES.filter(
    (c) => pillarFilter === "ALL" || c.primaryPillar === pillarFilter
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header */}
      <PageEmblemHeader
        badgeText="All 159 Georgia Counties Ingestion Matrix"
        badgeIcon={<Compass className="w-4 h-4 text-rose-400" />}
        title="GEORGIA ALL-COUNTY ANOMALY SCORING & FORENSIC TAXONOMY"
        description="Comprehensive forensic vulnerability evaluation across all Georgia counties. Cross-references Secretary of State entity filings, GSCCCA UCC financing statements, DOR state tax executions, and local clinical care ratios."
        rightElement={
          <div className="glass-card px-4 py-2.5 rounded-xl border border-cyan-500/20 text-right shadow-lg">
            <div className="text-[10px] text-slate-500">COVERAGE RADIUS</div>
            <div className="text-rose-400 font-bold text-lg">159 COUNTIES AUDITED</div>
          </div>
        }
      />

      {/* Filter Bar */}
      <div className="flex items-center space-x-2 overflow-x-auto glass-card p-2.5 rounded-xl border border-cyan-500/20 text-xs">
        <span className="text-slate-500 px-2">Filter by Vulnerability:</span>
        {pillars.map((p) => (
          <button
            key={p}
            onClick={() => setPillarFilter(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              pillarFilter === p
                ? "bg-rose-600 text-white shadow"
                : "text-slate-400 hover:text-white hover:glass-panel"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Counties Table */}
      <div className="glass-panel border border-cyan-500/20 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-cyan-500/20 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 text-rose-400" />
            <span>CRITICAL COUNTY ANOMALY VECTORS ({filtered.length})</span>
          </h3>
          <span className="text-xs text-slate-400">Ranked by Composite AI Distress Probability</span>
        </div>

        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.fips} className="glass-card p-4 rounded-xl border border-cyan-500/20 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold">
                    FIPS {c.fips}
                  </span>
                  <span className="text-white font-bold text-sm">{c.countyName}</span>
                  <span className="text-slate-500 text-[11px]">Pop: {c.population.toLocaleString()}</span>
                </div>
                <div className="flex items-center space-x-3">
                  <span className="text-[10px] text-slate-400">ANOMALY PROBABILITY:</span>
                  <span className="text-rose-400 font-bold text-base">{c.anomalyScore}%</span>
                </div>
              </div>

              <div className="glass-panel/90 p-3 rounded-lg border border-cyan-500/20 text-xs space-y-1">
                <div className="text-slate-400 flex justify-between">
                  <span>Core Vulnerability:</span>
                  <span className="text-rose-300 font-semibold">{c.dominantVulnerability}</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>Monitored Entities:</span>
                  <span className="text-slate-200">{c.keyEntitiesMonitored.join(", ")}</span>
                </div>
              </div>

              <div className="bg-sky-950/30 border border-cyan-500/30 p-2.5 rounded-lg text-xs text-sky-300 flex items-center justify-between">
                <span><strong>Competitor Exploitation Opportunity:</strong> {c.competitorAdvantageFlag}</span>
                <ArrowUpRight className="w-4 h-4 text-sky-400 shrink-0 ml-2" />
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

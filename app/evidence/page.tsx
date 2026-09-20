"use client";
import React, { useState } from "react";
import { EVIDENCE_CARDS } from "../../lib/data";
import { Layers, CheckCircle2, ExternalLink } from "lucide-react";
import PageEmblemHeader from "../../components/PageEmblemHeader";

export default function EvidencePage() {
  const [selectedPillar, setSelectedPillar] = useState<string>("ALL");

  const pillars = ["ALL", "LOGISTICS", "INCENTIVES", "WORKFORCE_QUALITY", "FISCAL_STRESS"];

  const filtered = EVIDENCE_CARDS.filter((card) => {
    return selectedPillar === "ALL" || card.pillar === selectedPillar;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header with Rotating Neon Glowing Emblem & Watermark */}
      <PageEmblemHeader
        badgeText="Auditable Primary Source Catalog"
        badgeIcon={<CheckCircle2 className="w-4 h-4 text-emerald-400" />}
        title="PUBLIC-SOURCE EVIDENCE CARDS & PROVENANCE"
        description="Every card complies with open-records standards: official dataset IDs, verified timestamps, primary URLs, and Admiralty System credibility ratings (A1 / A2)."
        rightElement={
          <div className="glass-card px-4 py-2.5 rounded-xl border border-white/10 text-right shadow-lg">
            <div className="text-[10px] text-slate-500">TOTAL EVIDENCE CARDS</div>
            <div className="text-emerald-400 font-bold text-lg">{EVIDENCE_CARDS.length} AUDITED</div>
          </div>
        }
      />

      {/* Pillar Selector Filter */}
      <div className="flex items-center space-x-2 overflow-x-auto glass-card p-2 rounded-xl border border-white/10 text-xs">
        <span className="text-slate-500 px-2">Filter by Pillar:</span>
        {pillars.map((p) => (
          <button
            key={p}
            onClick={() => setSelectedPillar(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
              selectedPillar === p
                ? "bg-emerald-600 text-white shadow"
                : "text-slate-400 hover:text-white hover:glass-panel"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.map((card) => (
          <div
            key={card.id}
            className="glass-panel border border-white/10 hover:border-slate-700 rounded-xl p-4 shadow-xl flex flex-col justify-between space-y-3 transition-all"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  {card.reviewStatus} • ADMIRALTY {card.admiraltyScore}
                </span>
                <span className="text-slate-500">{card.datasetId}</span>
              </div>

              <h3 className="text-xs sm:text-sm font-bold text-white leading-snug">
                {card.title}
              </h3>

              <div className="glass-card p-3 rounded-lg border border-white/10/80 space-y-1 text-xs">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Observed Telemetry Value:</span>
                  <span className="text-white font-bold">{card.value} {card.unit || ""}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Reporting Agency / Source:</span>
                  <span className="text-sky-300 text-right">{card.source}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Confidence Level:</span>
                  <span className="text-emerald-400 font-bold">{card.confidencePercent}%</span>
                </div>
              </div>

              {card.notes && (
                <p className="text-[11px] text-slate-300 font-sans leading-relaxed pt-1">
                  {card.notes}
                </p>
              )}
            </div>

            <div className="border-t border-white/10 pt-2.5 text-[10px] text-slate-400 flex items-center justify-between">
              <span>License: {card.license}</span>
              <a
                href={card.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline flex items-center space-x-1"
              >
                <span>Primary Link</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

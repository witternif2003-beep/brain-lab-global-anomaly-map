"use client";
import React, { useState } from "react";
import { VERIFIED_REPORTS } from "../../lib/telemetry-catalog";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import { FileText, Download, CheckCircle2, ArrowRight, ShieldCheck, Award } from "lucide-react";

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState(VERIFIED_REPORTS[0]);

  const downloadReportText = () => {
    const text = `BRAIN LAB BY LILIYA — POST-DOCTORATE COGNITIVE MARKET INTELLIGENCE
TITLE: ${selectedReport.title}
DATE: ${selectedReport.date}
PILLAR: ${selectedReport.pillar}
CONFIDENCE: ${selectedReport.confidence}% | ADMIRALTY: ${selectedReport.admiraltyRating}
LEAD ANALYST: ${selectedReport.leadAnalyst}

EXECUTIVE SUMMARY:
${selectedReport.summary}

GEORGIA TARGET VULNERABILITY:
${selectedReport.targetGeorgiaVulnerability}

COMPETITOR EXPLOITATION ACTIONS:
${selectedReport.competitorActionItems.map(a => `- [${a.state}] ${a.action} (Projected ROI: ${a.roiProjected})`).join("\n")}

PRIMARY AUDITED SOURCES:
${selectedReport.primarySources.map(s => `- ${s}`).join("\n")}

DISCLAIMER: Emblem used for identification purposes only. Not affiliated with any government agency. All data is public-record open-source only.`;

    const blob = new Blob([text], { type: "text/plain" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedReport.slug}-${selectedReport.date.replace(/[\s,]+/g, "-")}.txt`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header with Rotating Neon White Emblem & Watermark */}
      <PageEmblemHeader
        badgeText="Cognitive Intelligence Production"
        badgeIcon={<FileText className="w-4 h-4 text-sky-400" />}
        title="VERIFIED POST-DOCTORATE INTELLIGENCE REPORTS & DOSSIERS"
        description="Formal economic anomaly intelligence briefings synthesized from verified primary source telemetry, cross-referenced against competitor state tax and logistical incentives."
        rightElement={
          <button
            onClick={downloadReportText}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-black text-xs font-bold transition-all shadow-lg shadow-sky-500/20"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download Dossier (TXT)</span>
          </button>
        }
      />

      {/* Main Grid: Reports Index & Deep Dossier Reader */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Report Selectors */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>AUDITED BRIEFINGS ({VERIFIED_REPORTS.length})</span>
            <span className="text-slate-500 text-[11px]">Select to inspect dossier</span>
          </div>

          <div className="space-y-3">
            {VERIFIED_REPORTS.map((rep) => (
              <div
                key={rep.id}
                onClick={() => setSelectedReport(rep)}
                className={`p-4 rounded-xl border cursor-pointer transition-all space-y-2 ${
                  selectedReport.id === rep.id
                    ? "glass-panel border-sky-500 shadow-xl"
                    : "glass-card/80 border-white/10/80 hover:border-slate-700 hover:glass-panel/60"
                }`}
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-sky-400 font-bold">{rep.pillar.split(":")[0]}</span>
                  <span className="text-slate-400">{rep.date}</span>
                </div>

                <h3 className="text-xs font-bold text-white leading-snug">
                  {rep.title}
                </h3>

                <p className="text-[11px] text-slate-400 font-sans line-clamp-2 leading-relaxed">
                  {rep.summary}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-900">
                  <span>Admiralty: {rep.admiraltyRating.split(" ")[0]}</span>
                  <span className="text-emerald-400 font-bold">{rep.confidence}% Confidence</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Full Intelligence Dossier Reader */}
        <div className="lg:col-span-7">
          <div className="glass-panel border border-white/10 rounded-2xl p-6 shadow-2xl space-y-5 sticky top-20">
            
            <div className="border-b border-white/10 pb-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="px-2.5 py-1 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold">
                  {selectedReport.pillar}
                </span>
                <span className="text-slate-400">{selectedReport.date}</span>
              </div>
              
              <h2 className="text-base sm:text-xl font-bold text-white leading-snug">
                {selectedReport.title}
              </h2>

              <div className="text-xs text-slate-400 flex items-center justify-between pt-1">
                <span>Lead: {selectedReport.leadAnalyst}</span>
                <span className="text-emerald-400 font-bold">{selectedReport.confidence}% Verified</span>
              </div>
            </div>

            {/* Executive Abstract */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-300">EXECUTIVE SUMMARY</h4>
              <p className="text-xs text-slate-300 font-sans leading-relaxed glass-card p-4 rounded-xl border border-white/10">
                {selectedReport.summary}
              </p>
            </div>

            {/* Target Vulnerability */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-rose-400">TARGET GEORGIA STRUCTURAL VULNERABILITY</h4>
              <div className="bg-rose-950/20 border border-rose-900/40 p-3 rounded-xl text-xs text-rose-200 leading-relaxed font-sans">
                {selectedReport.targetGeorgiaVulnerability}
              </div>
            </div>

            {/* Competitor Exploitation Playbooks */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-sky-400 flex items-center space-x-1.5">
                <Award className="w-4 h-4 text-sky-400" />
                <span>STATE COMPETITOR EXPLOITATION DIRECTIVES</span>
              </h4>
              <div className="space-y-2">
                {selectedReport.competitorActionItems.map((item, idx) => (
                  <div key={idx} className="glass-card p-3 rounded-xl border border-white/10 text-xs space-y-1">
                    <div className="flex items-center justify-between text-sky-300 font-bold">
                      <span>{item.state} Action Directive</span>
                      <span className="text-emerald-400 font-semibold">{item.roiProjected}</span>
                    </div>
                    <p className="text-slate-300 font-sans text-xs">
                      {item.action}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Primary Source Audits */}
            <div className="glass-card p-3.5 rounded-xl border border-white/10 text-xs space-y-1.5">
              <div className="text-slate-400 font-bold">CORROBORATING PRIMARY SOURCE PROVENANCE</div>
              <ul className="list-disc list-inside text-slate-300 text-[11px] space-y-0.5">
                {selectedReport.primarySources.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}

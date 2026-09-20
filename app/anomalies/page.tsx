"use client";
import React, { useState } from "react";
import { GEORGIA_ANOMALIES } from "../../lib/data";
import { AnomalyItem } from "../../lib/schema";
import { ShieldAlert, Filter, Download, CheckCircle2, Layers } from "lucide-react";
import PageEmblemHeader from "../../components/PageEmblemHeader";

export default function AnomaliesPage() {
  const [sectorFilter, setSectorFilter] = useState<string>("ALL");
  const [severityFilter, setSeverityFilter] = useState<string>("ALL");
  const [selectedAnomaly, setSelectedAnomaly] = useState<AnomalyItem>(GEORGIA_ANOMALIES[0]);

  const sectors = ["ALL", "Logistics", "Fiscal & Tax", "Healthcare", "Labor", "Infrastructure", "Regulatory"];

  const filtered = GEORGIA_ANOMALIES.filter((item) => {
    const matchSector = sectorFilter === "ALL" || item.sector === sectorFilter;
    const matchSeverity = severityFilter === "ALL" || item.severity === severityFilter;
    return matchSector && matchSeverity;
  });

  const exportCSV = () => {
    const headers = "ID,Code,Title,Sector,Severity,Metric,Baseline,Observed,Deviation,Confidence,Admiralty\n";
    const rows = filtered.map(a => `"${a.id}","${a.code}","${a.title}","${a.sector}","${a.severity}","${a.metric}","${a.baseline}","${a.observed}","${a.deviation}",${a.confidenceScore},"${a.admiraltyRating}"`).join("\n");
    const blob = new Blob([headers + rows], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `georgia-anomalies-export-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
      
      {/* Branded Header with Rotating Neon Glowing Emblem & Watermark */}
      <PageEmblemHeader
        badgeText="Surface 2: Individual Anomaly Tracking Dossier"
        badgeIcon={<ShieldAlert className="w-4 h-4 text-rose-400" />}
        title="VERIFIED GEORGIA ECONOMIC ANOMALIES & AUDIT WIDGETS"
        description="Every entry is corroborated by primary public data (Georgia General Assembly statutes, Port of Savannah logistics, AAMC workforce profiles) and evaluated under the Admiralty System (A1/A2 grading)."
        rightElement={
          <button
            onClick={exportCSV}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono border border-slate-700 transition-all shadow-md"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Anomalies (CSV)</span>
          </button>
        }
      />

      {/* Filter Chips Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800/80 font-mono text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-slate-500 mr-2 flex items-center">
            <Filter className="w-3.5 h-3.5 mr-1" /> Sector:
          </span>
          {sectors.map((sec) => (
            <button
              key={sec}
              onClick={() => setSectorFilter(sec)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all ${
                sectorFilter === sec
                  ? "bg-rose-600 text-white shadow"
                  : "bg-slate-900 text-slate-400 hover:text-slate-200"
              }`}
            >
              {sec}
            </button>
          ))}
        </div>

        <div className="flex items-center space-x-1.5">
          <span className="text-slate-500 text-[11px]">Severity:</span>
          {["ALL", "CRITICAL", "HIGH"].map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                severityFilter === sev
                  ? "bg-slate-200 text-black"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              {sev}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: List and Detail Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 font-mono">
        
        {/* Left Column: Anomalies Selection Cards */}
        <div className="lg:col-span-5 space-y-3">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span>FILTERED ANOMALIES ({filtered.length})</span>
            <span className="text-slate-500 text-[11px]">Click to inspect evidence chain</span>
          </div>

          <div className="space-y-2.5">
            {filtered.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedAnomaly(item)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  selectedAnomaly.id === item.id
                    ? "bg-slate-900 border-rose-500 shadow-md"
                    : "bg-slate-950/80 border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60"
                }`}
              >
                <div className="flex items-center justify-between text-[10px] mb-1">
                  <span className="text-slate-400 font-semibold">{item.code}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded font-bold ${
                      item.severity === "CRITICAL"
                        ? "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {item.severity}
                  </span>
                </div>

                <h4 className="text-xs font-bold text-white line-clamp-2">
                  {item.title}
                </h4>

                <div className="text-[11px] text-rose-300 mt-2 font-mono">
                  {item.deviation}
                </div>

                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 border-t border-slate-900 mt-2">
                  <span>Admiralty: {item.admiraltyRating.split(" ")[0]}</span>
                  <span className="text-emerald-400">{item.confidenceScore}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Deep Evidence & Exploitation Inspector */}
        <div className="lg:col-span-7">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5 sticky top-20">
            
            {/* Anomaly Header */}
            <div className="border-b border-slate-800 pb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold">
                  {selectedAnomaly.code} • {selectedAnomaly.severity}
                </span>
                <span className="text-xs text-slate-400">
                  Detected: {new Date(selectedAnomaly.timestamp).toLocaleDateString()}
                </span>
              </div>
              <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
                {selectedAnomaly.title}
              </h2>
              <div className="text-xs text-slate-400">
                Target Entity: <span className="text-slate-200">{selectedAnomaly.entity}</span>
              </div>
            </div>

            {/* Metrics Comparison Table */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
              <div className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                <Layers className="w-4 h-4 text-sky-400" />
                <span>OBSERVED TELEMETRY DEVIATION ANALYSIS</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                  <div className="text-slate-500 text-[10px]">HISTORICAL BASELINE</div>
                  <div className="text-slate-200 mt-1 font-semibold">{selectedAnomaly.baseline}</div>
                </div>
                <div className="bg-slate-900/80 p-2.5 rounded-lg border border-rose-950/60">
                  <div className="text-rose-400 text-[10px]">ANOMALOUS OBSERVATION</div>
                  <div className="text-rose-300 mt-1 font-semibold">{selectedAnomaly.observed}</div>
                </div>
              </div>
              <div className="bg-rose-950/20 border border-rose-800/40 p-2.5 rounded-lg text-xs text-rose-300">
                <strong>Deviation Magnitude:</strong> {selectedAnomaly.deviation}
              </div>
            </div>

            {/* Detection Machine Learning Architecture */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-slate-500 text-[10px]">DETECTION MODEL PIPELINE</div>
                <div className="text-sky-300 font-bold mt-0.5">{selectedAnomaly.detectionModel}</div>
                <div className="text-slate-400 text-[11px] mt-1">Confidence Score: <span className="text-emerald-400 font-bold">{selectedAnomaly.confidenceScore}%</span></div>
              </div>
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <div className="text-slate-500 text-[10px]">ADMIRALTY SYSTEM CREDIBILITY</div>
                <div className="text-amber-300 font-bold mt-0.5">{selectedAnomaly.admiraltyRating}</div>
                <div className="text-slate-400 text-[11px] mt-1">Classification Status: <span className="text-emerald-400">{selectedAnomaly.status}</span></div>
              </div>
            </div>

            {/* Evidence Chain Verification */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
              <div className="text-slate-300 font-bold flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>CROSS-VERIFIED EVIDENCE CHAIN</span>
              </div>
              <div className="space-y-1 text-slate-300 text-[11px]">
                <div>• <strong>Primary Source:</strong> {selectedAnomaly.evidenceChain.primarySource}</div>
                <div>• <strong>Corroborating Source:</strong> {selectedAnomaly.evidenceChain.corroboratingSource}</div>
                <div>• <strong>Validation Status:</strong> {selectedAnomaly.evidenceChain.verificationStatus}</div>
              </div>
            </div>

            {/* Competitor Exploitation Playbook */}
            <div className="bg-gradient-to-r from-sky-950/60 to-slate-950 border border-sky-600/40 p-4 rounded-xl space-y-2 text-xs">
              <div className="text-sky-400 font-bold flex items-center justify-between">
                <span>COMPETITOR ACTION PLAYBOOK</span>
                <span className="text-[11px] text-sky-300">Beneficiary States: {selectedAnomaly.exploitingStates.join(", ")}</span>
              </div>
              <p className="text-slate-200 text-xs leading-relaxed">
                {selectedAnomaly.competitorAdvantage}
              </p>
              <div className="bg-slate-950/80 p-2.5 rounded border border-sky-900/60 text-[11px] text-sky-200">
                <strong>Execution Strategy:</strong> {selectedAnomaly.exploitationPlaybook}
              </div>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
}

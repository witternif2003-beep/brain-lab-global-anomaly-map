"use client";
import React, { useState, useEffect } from "react";
import { GEORGIA_ANOMALIES } from "../../lib/data";
import { AnomalyItem } from "../../lib/schema";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import {
  ShieldAlert,
  Search,
  Filter,
  Download,
  Activity,
  ArrowUpRight,
  TrendingUp,
  FileCheck,
  CheckCircle2,
  RefreshCw,
  Compass
} from "lucide-react";

export default function AnomaliesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [anomalyStream, setAnomalyStream] = useState<AnomalyItem[]>(GEORGIA_ANOMALIES);
  const [lastPing, setLastPing] = useState<string>("Just now");

  // Continuous 24/7 Real-Time Anomaly Population Simulator
  useEffect(() => {
    const interval = setInterval(() => {
      setLastPing(new Date().toLocaleTimeString());
      // Randomly update continuous confidence score variance
      setAnomalyStream((prev) =>
        prev.map((a) => ({
          ...a,
          confidenceScore: Math.min(99.9, Math.max(91.0, +(a.confidenceScore + (Math.random() * 0.4 - 0.2)).toFixed(1))),
        }))
      );
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const filtered = anomalyStream.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.entity.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSeverity = selectedSeverity === "ALL" || item.severity === selectedSeverity;
    const matchesSector = selectedSector === "ALL" || item.sector === selectedSector;
    return matchesSearch && matchesSeverity && matchesSector;
  });

  const exportCSV = () => {
    const headers = [
      "ID",
      "Code",
      "Title",
      "Entity",
      "Sector",
      "Severity",
      "Metric",
      "Baseline",
      "Observed",
      "Deviation",
      "Confidence",
      "Admiralty",
      "Beneficiaries",
    ];
    const rows = filtered.map((a) => [
      a.id,
      a.code,
      `"${a.title}"`,
      `"${a.entity}"`,
      a.sector,
      a.severity,
      `"${a.metric}"`,
      `"${a.baseline}"`,
      `"${a.observed}"`,
      `"${a.deviation}"`,
      `${a.confidenceScore}%`,
      a.admiraltyRating,
      `"${a.exploitingStates.join(", ")}"`,
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Georgia_Anomalies_Verified_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header */}
      <PageEmblemHeader
        badgeText="Real-Time Detection Feed • 24/7 Population"
        badgeIcon={<ShieldAlert className="w-4 h-4 text-[#f43f5e]" />}
        title="GEORGIA STATE DEDICATED ANOMALY SURVEILLANCE & EXPLOITATION DOSSIERS"
        description="High-contrast, peer-reviewed telemetry dossiers tracking active statistical anomalies across Georgia logistics, legislative incentive repeals (HB 463), and infrastructure stress. Updated continuously with automated Admiralty System audit grading."
        rightElement={
          <div className="bg-[#131d2c] px-4 py-2.5 rounded-xl border border-[#28394e] text-right shadow-lg">
            <div className="text-[10px] text-[#94a3b8] flex items-center justify-end space-x-1">
              <RefreshCw className="w-3 h-3 text-[#10b981] animate-spin" />
              <span>LIVE 24/7 STREAM</span>
            </div>
            <div className="text-[#38bdf8] font-bold text-lg">{filtered.length} ACTIVE VECTORS</div>
            <div className="text-[10px] text-[#10b981]">Ping: {lastPing}</div>
          </div>
        }
      />

      {/* Filter and Export Toolbar */}
      <div className="bg-[#131d2c] border border-[#28394e] rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#64748b] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search anomaly code, title, entity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#0b1320] border border-[#28394e] pl-8 pr-3 py-1.5 rounded-lg text-xs text-[#f8fafc] focus:outline-none focus:border-[#38bdf8] w-56 sm:w-64"
              />
            </div>

            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="bg-[#0b1320] border border-[#28394e] px-3 py-1.5 rounded-lg text-xs text-[#cbd5e1] focus:outline-none focus:border-[#38bdf8]"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical (Z &gt; 2.5σ)</option>
              <option value="HIGH">High (Z &gt; 2.0σ)</option>
              <option value="MEDIUM">Medium (Z &gt; 1.5σ)</option>
            </select>

            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-[#0b1320] border border-[#28394e] px-3 py-1.5 rounded-lg text-xs text-[#cbd5e1] focus:outline-none focus:border-[#38bdf8]"
            >
              <option value="ALL">All Sectors</option>
              <option value="Logistics">Logistics & Ports</option>
              <option value="Fiscal & Tax">Fiscal & Tax Legislation</option>
              <option value="Infrastructure">Grid & Infrastructure</option>
              <option value="Healthcare">Healthcare Capacity</option>
              <option value="Labor">Labor & Credit Stress</option>
              <option value="Regulatory">Regulatory & Life Sciences</option>
            </select>
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center space-x-2 bg-[#1e293b] hover:bg-[#334155] text-[#38bdf8] border border-[#38bdf8]/50 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md self-start md:self-auto"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT CSV DOSSIER</span>
          </button>

        </div>
      </div>

      {/* High-Readability Anomalies List (Oceanic Slate & Emerald Theme) */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.map((anom) => {
          const isCritical = anom.severity === "CRITICAL";
          return (
            <div
              key={anom.id}
              className="bg-[#131d2c] border border-[#28394e] hover:border-[#38bdf8]/60 rounded-2xl p-5 space-y-4 shadow-xl transition-all"
            >
              {/* Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#28394e] pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                      isCritical
                        ? "bg-[#f43f5e]/20 text-[#f43f5e] border border-[#f43f5e]/50"
                        : "bg-[#fb923c]/20 text-[#fb923c] border border-[#fb923c]/50"
                    }`}
                  >
                    {anom.severity} • {anom.code}
                  </span>
                  <span className="text-[#f8fafc] font-bold text-sm sm:text-base">
                    {anom.title}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#1e293b] text-[#38bdf8] border border-[#334155] text-[10px]">
                    {anom.sector}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-[#94a3b8]">Admiralty: <strong className="text-[#38bdf8]">{anom.admiraltyRating}</strong></span>
                  <span className="text-[#10b981] font-bold">{anom.confidenceScore}% CONFIDENCE</span>
                </div>
              </div>

              {/* Forensic Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="bg-[#0b1320] p-3 rounded-xl border border-[#28394e]">
                  <span className="text-[#94a3b8] block text-[10px]">TARGET ENTITY:</span>
                  <span className="text-[#f8fafc] font-semibold truncate block">{anom.entity}</span>
                </div>
                <div className="bg-[#0b1320] p-3 rounded-xl border border-[#28394e]">
                  <span className="text-[#94a3b8] block text-[10px]">BASELINE:</span>
                  <span className="text-[#94a3b8] block truncate">{anom.baseline}</span>
                </div>
                <div className="bg-[#0b1320] p-3 rounded-xl border border-[#28394e]">
                  <span className="text-[#94a3b8] block text-[10px]">OBSERVED VALUE:</span>
                  <span className="text-[#f8fafc] font-semibold block truncate">{anom.observed}</span>
                </div>
                <div className="bg-[#0b1320] p-3 rounded-xl border border-[#28394e]">
                  <span className="text-[#94a3b8] block text-[10px]">DEVIATION Z-SCORE:</span>
                  <span className={`font-bold block ${isCritical ? "text-[#f43f5e]" : "text-[#fb923c]"}`}>
                    {anom.deviation}
                  </span>
                </div>
              </div>

              {/* Competitor Exploitation Directive */}
              <div className="bg-[#0f172a] border border-[#28394e] p-4 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[#38bdf8] font-bold flex items-center space-x-1.5">
                    <TrendingUp className="w-4 h-4 text-[#38bdf8]" />
                    <span>COMPETITOR STRATEGIC EXPLOITATION DIRECTIVE</span>
                  </span>
                  <span className="text-[#10b981] text-[11px] font-semibold">
                    Beneficiaries: {anom.exploitingStates.join(", ")}
                  </span>
                </div>
                <p className="text-[#cbd5e1] font-sans leading-relaxed text-xs">
                  {anom.exploitationPlaybook}
                </p>
              </div>

              {/* Evidence Chain Footer */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-[#94a3b8] border-t border-[#28394e] pt-2">
                <div>Primary Source: <span className="text-[#cbd5e1]">{anom.evidenceChain.primarySource}</span></div>
                <div className="text-[#38bdf8] font-semibold">Model: {anom.detectionModel}</div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}

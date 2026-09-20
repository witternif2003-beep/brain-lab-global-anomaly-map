"use client";
import React, { useState } from "react";
import { useTelemetryStore } from "../../lib/telemetry-store";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import {
  ShieldAlert,
  Search,
  Download,
  Activity,
  TrendingUp,
  RefreshCw,
  Zap,
  Radio
} from "lucide-react";

export default function AnomaliesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState<string>("ALL");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");

  // Read continuously from global SSE store
  const anomalyStream = useTelemetryStore((s) => s.anomalies);
  const connectionStatus = useTelemetryStore((s) => s.connectionStatus);
  const lastTimestamp = useTelemetryStore((s) => s.timestamp);

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
      "Deviation",
      "Confidence",
      "Z-Score",
      "Location"
    ];
    const rows = filtered.map((a) => [
      a.id,
      a.code,
      `"${a.title}"`,
      `"${a.entity}"`,
      a.sector,
      a.severity,
      `"${a.deviation}"`,
      `${a.confidenceScore}%`,
      a.zScore,
      `"${a.location}"`
    ]);
    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Georgia_Anomalies_Live_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono pb-16">
      
      {/* Branded Header with Live SSE Indicator */}
      <PageEmblemHeader
        badgeText={`Live SSE Telemetry: ${connectionStatus.toUpperCase()}`}
        badgeIcon={<Radio className="w-4 h-4 text-[#00ff9d]" />}
        title="GEORGIA STATE DEDICATED ANOMALY SURVEILLANCE & EXPLOITATION DOSSIERS"
        description="High-contrast telemetry dossiers tracking real-time statistical anomalies across Georgia logistics, legislative incentive repeals (HB 463), and infrastructure stress. Updated via Edge Server-Sent Events (SSE) every 2.5 seconds."
        rightElement={
          <div className="glass-panel px-4 py-2.5 rounded-xl border border-white/10 text-right shadow-lg">
            <div className="text-[11px] text-[#8595a8] flex items-center justify-end space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${connectionStatus === 'streaming' ? 'bg-[#00ff9d] animate-ping' : 'bg-[#ffb800]'}`} />
              <span className="font-bold">{connectionStatus === 'streaming' ? 'SSE ACTIVE (2.5s)' : 'CONNECTING...'}</span>
            </div>
            <div className="text-[#00e5ff] font-bold text-lg">{filtered.length} ACTIVE VECTORS</div>
            <div className="text-[10px] text-[#00ff9d]">Tick: {new Date(lastTimestamp).toLocaleTimeString()}</div>
          </div>
        }
      />

      {/* Filter and Export Toolbar */}
      <div className="glass-panel border border-white/10 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-[#8595a8] absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search anomaly code, title, entity..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="glass-card border border-white/15 pl-9 pr-3 py-1.5 rounded-xl text-sm text-white focus:outline-none focus:border-[#00e5ff] w-56 sm:w-64"
              />
            </div>

            <select
              value={selectedSeverity}
              onChange={(e) => setSelectedSeverity(e.target.value)}
              className="glass-card border border-white/15 px-3 py-1.5 rounded-xl text-sm text-[#b6c2d2] focus:outline-none focus:border-[#00e5ff]"
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Critical (Z &gt; 2.5σ)</option>
              <option value="HIGH">High (Z &gt; 2.0σ)</option>
              <option value="MEDIUM">Medium (Z &gt; 1.5σ)</option>
            </select>

            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="glass-card border border-white/15 px-3 py-1.5 rounded-xl text-sm text-[#b6c2d2] focus:outline-none focus:border-[#00e5ff]"
            >
              <option value="ALL">All Sectors</option>
              <option value="Logistics">Logistics & Ports</option>
              <option value="Fiscal & Tax">Fiscal & Tax Legislation</option>
              <option value="Infrastructure">Grid & Infrastructure</option>
              <option value="Healthcare">Healthcare Capacity</option>
            </select>
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center space-x-2 bg-[#1e293b] hover:bg-[#334155] text-[#00e5ff] border border-[#00e5ff]/50 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md self-start md:self-auto"
          >
            <Download className="w-4 h-4" />
            <span>EXPORT CSV DOSSIER</span>
          </button>

        </div>
      </div>

      {/* High-Readability Anomalies List */}
      <div className="grid grid-cols-1 gap-4">
        {filtered.map((anom) => {
          const isCritical = anom.severity === "CRITICAL";
          return (
            <div
              key={anom.id}
              className="glass-panel border border-white/10 hover:border-[#00e5ff]/60 rounded-2xl p-5 space-y-4 shadow-xl transition-all"
            >
              {/* Header Row */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`px-2.5 py-0.5 rounded text-xs font-bold uppercase tracking-wider ${
                      isCritical
                        ? "bg-[#f43f5e]/20 text-[#f43f5e] border border-[#f43f5e]/50"
                        : "bg-[#fb923c]/20 text-[#fb923c] border border-[#fb923c]/50"
                    }`}
                  >
                    {anom.severity} • {anom.code}
                  </span>
                  <span className="text-white font-bold text-base">
                    {anom.title}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-[#1e293b] text-[#00e5ff] border border-[#334155] text-xs">
                    {anom.sector}
                  </span>
                </div>

                <div className="flex items-center space-x-3 text-xs">
                  <span className="text-[#8595a8]">Z-Score: <strong className="text-[#00e5ff]">{anom.zScore}σ</strong></span>
                  <span className="text-[#00ff9d] font-bold font-mono text-sm">{anom.confidenceScore}% CONFIDENCE</span>
                </div>
              </div>

              {/* Forensic Metric Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="glass-card p-3 rounded-xl border border-white/10">
                  <span className="text-[#8595a8] block text-[10px] uppercase">TARGET ENTITY</span>
                  <span className="text-white font-semibold truncate block mt-0.5">{anom.entity}</span>
                </div>
                <div className="glass-card p-3 rounded-xl border border-white/10">
                  <span className="text-[#8595a8] block text-[10px] uppercase">LOCATION CORRIDOR</span>
                  <span className="text-[#b6c2d2] block truncate mt-0.5">{anom.location}</span>
                </div>
                <div className="glass-card p-3 rounded-xl border border-white/10">
                  <span className="text-[#8595a8] block text-[10px] uppercase">REAL-TIME ANOMALY DEVIATION</span>
                  <span className={`font-bold block mt-0.5 ${isCritical ? "text-[#f43f5e]" : "text-[#fb923c]"}`}>
                    {anom.deviation}
                  </span>
                </div>
                <div className="glass-card p-3 rounded-xl border border-white/10">
                  <span className="text-[#8595a8] block text-[10px] uppercase">SERVER TIMESTAMP</span>
                  <span className="text-[#00e5ff] block font-mono mt-0.5">
                    {new Date(anom.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
}

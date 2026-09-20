"use client";
import React, { useState, useEffect } from "react";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import {
  TELEMETRY_STREAM_PIPELINE,
  TOTAL_STATE_OF_ART_STREAMS,
  GEORGIA_FORENSIC_ANOMALIES,
  GeorgiaForensicSpecificAnomaly
} from "../../lib/telemetry-stream-engine";
import {
  Radio,
  Activity,
  Layers,
  ShieldAlert,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Building,
  UserCheck,
  Zap,
  Globe
} from "lucide-react";

export default function ForensicTelemetryPage() {
  const [streamCount, setStreamCount] = useState<number>(TOTAL_STATE_OF_ART_STREAMS);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedEntityFilter, setSelectedEntityFilter] = useState<string>("ALL");
  const [selectedStateFilter, setSelectedStateFilter] = useState<string>("ALL");
  const [livePings, setLivePings] = useState<number>(142980);

  // Simulating continuous automated autonomous feed discovery (+1 stream every 8 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setStreamCount((prev) => prev + 1);
      setLivePings((prev) => prev + Math.floor(Math.random() * 12) + 3);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const filteredAnomalies = GEORGIA_FORENSIC_ANOMALIES.filter((a) => {
    const matchesSearch =
      a.entityName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.county.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.primaryTelemetryEvidence.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesEntity = selectedEntityFilter === "ALL" || a.entityType === selectedEntityFilter;
    const matchesState = selectedStateFilter === "ALL" || a.competitorActionableRecommendation.targetCompetitor === selectedStateFilter;
    return matchesSearch && matchesEntity && matchesState;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header */}
      <PageEmblemHeader
        badgeText="+7,000 SOTA Stream Telemetry & Real-Time Georgia Forensics"
        badgeIcon={<Radio className="w-4 h-4 text-emerald-400 animate-pulse" />}
        title="POST-DOCTORATE REAL-TIME TELEMETRY ENGINE & DEDICATED GEORGIA FORENSICS"
        description="Autonomous ingestion fabric continuously scanning 7,000+ verified Tier-1 data streams across ADS-B, AIS, CelesTrak, FIRMS, FERC-714, and SEC EDGAR. Delivers continuous, high-frequency forensic telemetry on Georgia individual elites, corporations, and critical assets with tailored competitor profit recommendations."
        rightElement={
          <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-right shadow-lg">
            <div className="text-[10px] text-slate-500">CONTINUOUS STREAM INGEST</div>
            <div className="text-emerald-400 font-bold text-lg flex items-center justify-end space-x-1.5">
              <span>{streamCount.toLocaleString()}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-normal">
                LIVE
              </span>
            </div>
            <div className="text-[10px] text-sky-400">{livePings.toLocaleString()} pings/min</div>
          </div>
        }
      />

      {/* SOTA Telemetry Ingest Pipeline Grid */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-white flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-sky-400" />
            <span>CONTINUOUS TIER-1 INGESTION FABRIC ({streamCount.toLocaleString()} ACTIVE FEEDS)</span>
          </h2>
          <span className="text-[11px] text-emerald-400 flex items-center space-x-1">
            <RefreshCw className="w-3 h-3 animate-spin text-emerald-400" />
            <span>Autonomous Discovery Bot: Scanning Web & Repositories</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {TELEMETRY_STREAM_PIPELINE.map((cat) => (
            <div key={cat.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 rounded bg-sky-500/15 text-sky-300 font-bold text-[10px]">
                  {cat.ingestProtocol}
                </span>
                <span className="text-emerald-400 font-bold text-[10px] flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>{cat.status}</span>
                </span>
              </div>
              <div className="text-white font-bold line-clamp-1">{cat.name}</div>
              <div className="text-slate-400 text-[11px]">Streams: <strong className="text-emerald-300">{cat.totalActiveStreams.toLocaleString()}</strong></div>
              <div className="text-slate-500 text-[10px]">Sampling: {cat.samplingFrequency}</div>
              <div className="text-[10px] text-slate-400 border-t border-slate-900 pt-1 flex justify-between">
                <span>Audit: {cat.auditStandard}</span>
                <span className="text-sky-400 truncate max-w-[120px]">{cat.primaryProvider}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Georgia State Individual & Corporate Forensic Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
              <ShieldAlert className="w-5 h-5 text-rose-500" />
              <span>DEDICATED GEORGIA FORENSICS: ENTITY-LEVEL ANOMALIES & EXPLOIT DIRECTIVES</span>
            </h3>
            <p className="text-xs text-slate-400 font-sans mt-0.5">
              Audited mathematical anomalies (Z-Score &gt; 2.5σ) across Georgia enterprises, infrastructure nodes, and high-net-worth leadership cohorts.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search entity, county, evidence..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-slate-950 border border-slate-800 pl-8 pr-3 py-1.5 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-sky-500"
              />
            </div>

            <select
              value={selectedEntityFilter}
              onChange={(e) => setSelectedEntityFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Entity Types</option>
              <option value="Corporate Enterprise">Corporate Enterprise</option>
              <option value="Critical Infrastructure Asset">Critical Infrastructure Asset</option>
              <option value="Individual Elite Executive">Individual Elite Executive</option>
            </select>

            <select
              value={selectedStateFilter}
              onChange={(e) => setSelectedStateFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-xs text-slate-300 focus:outline-none"
            >
              <option value="ALL">All Exploiting States</option>
              <option value="North Carolina">North Carolina (NC)</option>
              <option value="Tennessee">Tennessee (TN)</option>
              <option value="South Carolina">South Carolina (SC)</option>
              <option value="Florida">Florida (FL)</option>
              <option value="Texas">Texas (TX)</option>
              <option value="Virginia">Virginia (VA)</option>
              <option value="Alabama">Alabama (AL)</option>
            </select>
          </div>
        </div>

        {/* Forensic Anomalies Cards */}
        <div className="grid grid-cols-1 gap-4">
          {filteredAnomalies.map((anom) => (
            <div
              key={anom.id}
              className="bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl p-5 space-y-4 transition-all"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-900 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-2.5 py-1 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-bold flex items-center space-x-1.5">
                    <Activity className="w-3.5 h-3.5 text-rose-400" />
                    <span>Z = +{anom.zScore}σ ({anom.anomalyProbability}% PROB)</span>
                  </span>
                  <span className="text-white font-bold text-sm sm:text-base">{anom.entityName}</span>
                  <span className="text-slate-400 text-xs font-mono">[{anom.county}]</span>
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-sky-400 border border-slate-800 text-[10px]">
                    {anom.entityType}
                  </span>
                </div>
                <div className="text-emerald-400 text-xs font-bold">{anom.auditGrade}</div>
              </div>

              {/* Primary Evidence & Trigger */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-rose-400 font-bold block text-[10px]">PRIMARY TELEMETRY OBSERVATION:</span>
                  <p className="text-slate-200 font-sans leading-relaxed">{anom.primaryTelemetryEvidence}</p>
                </div>
                <div className="bg-slate-900/60 p-3 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-sky-400 font-bold block text-[10px]">STATUTORY / SENSOR TRIGGER:</span>
                  <p className="text-slate-200 font-sans leading-relaxed">{anom.statutoryOrFinancialTrigger}</p>
                </div>
              </div>

              {/* Tailored Competitor Action Recommendation */}
              <div className="bg-emerald-950/20 border border-emerald-800/40 p-4 rounded-xl space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/30 text-emerald-300 font-bold text-[11px]">
                      COMPETITOR ACTION: {anom.competitorActionableRecommendation.targetCompetitor.toUpperCase()}
                    </span>
                    <span className="text-slate-400 text-[10px]">Cadence: {anom.competitorActionableRecommendation.actionCadence}</span>
                  </div>
                  <span className="text-emerald-400 font-bold text-[11px]">
                    {anom.competitorActionableRecommendation.quantifiableFinancialYield}
                  </span>
                </div>
                <p className="text-emerald-100 font-sans leading-relaxed text-xs">
                  <strong>Executive Directive:</strong> {anom.competitorActionableRecommendation.actionableDirective}
                </p>
              </div>

            </div>
          ))}
        </div>

      </div>

    </div>
  );
}

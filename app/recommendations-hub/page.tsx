"use client";
import React, { useState, useEffect } from "react";
import { useTelemetryStore } from "../../lib/telemetry-store";
import { globalRecommendationEngine, RecommendationVector } from "../../lib/recommendation-engine";
import { VALIDATED_RECOMMENDATIONS_CATALOG, TOTAL_RECOMMENDATIONS_COUNT } from "../../lib/recommendations-catalog";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import {
  Award,
  Search,
  Filter,
  Download,
  Activity,
  ArrowUpRight,
  TrendingUp,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Zap,
  Radio,
  SlidersHorizontal
} from "lucide-react";

export default function RecommendationsHubPage() {
  const [search, setSearch] = useState("");
  const [selectedState, setSelectedState] = useState<string>("ALL");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");

  // Read continuously from global SSE store
  const gridLoadMW = useTelemetryStore((s) => s.gridLoadMW);
  const portTEUVelocity = useTelemetryStore((s) => s.portTEUVelocity);
  const vessels = useTelemetryStore((s) => s.vessels);
  const connectionStatus = useTelemetryStore((s) => s.connectionStatus);
  const timestamp = useTelemetryStore((s) => s.timestamp);

  // Closed-loop dynamic recommendations re-ranked on each telemetry tick
  const [closedLoopDirectives, setClosedLoopDirectives] = useState<RecommendationVector[]>([]);

  useEffect(() => {
    const ranked = globalRecommendationEngine.generate({
      gridLoadMW,
      portTEUVelocity,
      vesselsCount: vessels.length
    }, 5);
    setClosedLoopDirectives(ranked);
  }, [gridLoadMW, portTEUVelocity, vessels.length, timestamp]);

  const states = ["ALL", "North Carolina", "Tennessee", "South Carolina", "Florida", "Texas", "Virginia", "Alabama"];
  const sectors = ["ALL", "Advanced Manufacturing", "Hyperscale Compute & AI", "Maritime & Intermodal Logistics", "Executive Wealth & FinTech", "Aerospace & Defense", "Biopharma & Clinical Research", "Cold Chain Agribusiness"];

  const filteredCatalog = VALIDATED_RECOMMENDATIONS_CATALOG.filter((item) => {
    const matchState = selectedState === "ALL" || item.targetCompetitorState === selectedState;
    const matchSector = selectedSector === "ALL" || item.targetSector === selectedSector;
    const matchSearch =
      item.strategicObjective.toLowerCase().includes(search.toLowerCase()) ||
      item.georgiaStructuralVulnerabilityAnchor.toLowerCase().includes(search.toLowerCase()) ||
      item.recId.toLowerCase().includes(search.toLowerCase());
    return matchState && matchSector && matchSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono pb-16">
      
      {/* Branded Header */}
      <PageEmblemHeader
        badgeText={`Catalog Index: ${TOTAL_RECOMMENDATIONS_COUNT.toLocaleString()}+ Audited Directives`}
        badgeIcon={<Award className="w-5 h-5 text-[#00ff9d]" />}
        title="POST-DOCTORATE P1 TIER-1 STRATEGIC RECOMMENDATIONS & EXPLOITATION HUB"
        description="Closed-loop real-time recommendation scoring continuously re-ranked against live telemetry sensor drift. Audited under NATO/Admiralty A1 criteria across North Carolina, Tennessee, South Carolina, Florida, Texas, Virginia, and Alabama."
        rightElement={
          <div className="glass-panel px-4 py-2.5 rounded-xl border border-white/10 text-right shadow-lg">
            <div className="text-[11px] text-[#8595a8] flex items-center justify-end space-x-1.5">
              <span className={`w-2 h-2 rounded-full ${connectionStatus === 'streaming' ? 'bg-[#00ff9d] animate-ping' : 'bg-[#38bdf8]'}`} />
              <span className="font-bold">{connectionStatus === 'streaming' ? 'CLOSED-LOOP SCORING LIVE' : 'SYNCING...'}</span>
            </div>
            <div className="text-[#00e5ff] font-bold text-lg">{filteredCatalog.length.toLocaleString()} ACTIVE VECTORS</div>
            <div className="text-[10px] text-[#00ff9d]">Tick: {new Date(timestamp).toLocaleTimeString()}</div>
          </div>
        }
      />

      {/* Closed-Loop Real-Time Ranked Directives (Telemetry-Driven Hot List) */}
      <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-white/15 space-y-4 shadow-2xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-3 gap-2">
          <div className="flex items-center space-x-2">
            <Zap className="w-5 h-5 text-[#00e5ff] animate-pulse" />
            <h3 className="text-base sm:text-lg font-bold text-white uppercase tracking-wider">
              Real-Time Closed-Loop Ranked Directives (Live Sensor Input)
            </h3>
          </div>
          <span className="text-xs text-[#00ff9d] font-mono px-3 py-1 rounded-full bg-[#00ff9d]/15 border border-[#00ff9d]/30 font-bold">
            AMC Adaptive Format Engine Active
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {closedLoopDirectives.map((rec) => (
            <div key={rec.id} className="glass-card p-4 rounded-xl border border-white/10 space-y-2.5 hover:border-[#00e5ff]/50 transition-all">
              <div className="flex items-center justify-between text-xs">
                <span className="px-2 py-0.5 rounded bg-[#00e5ff]/20 text-[#00e5ff] border border-[#00e5ff]/40 font-bold">
                  {rec.category} • Z={rec.currentZScore}σ
                </span>
                <span className="font-bold text-[#00ff9d]">Score: {rec.liveScore}</span>
              </div>
              <h4 className="text-sm font-bold text-white leading-snug">{rec.title}</h4>
              <p className="text-xs text-[#b6c2d2] line-clamp-2">{rec.strategicDirective}</p>
              <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                <span className="text-[#8595a8]">Target: <strong className="text-white">{rec.targetCompetitorState}</strong></span>
                <span className="text-[#00ff9d] font-bold">{rec.baseROI}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel p-4 sm:p-5 rounded-2xl border border-white/10 space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 text-[#8595a8] absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search recommendations by ID, objective, or vulnerability..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full glass-card border border-white/15 pl-9 pr-3 py-2 rounded-xl text-sm text-white focus:outline-none focus:border-[#00e5ff]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="glass-card border border-white/15 px-3 py-2 rounded-xl text-xs text-[#b6c2d2] focus:outline-none focus:border-[#00e5ff]"
            >
              {states.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="glass-card border border-white/15 px-3 py-2 rounded-xl text-xs text-[#b6c2d2] focus:outline-none focus:border-[#00e5ff]"
            >
              {sectors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Catalog Grid View */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredCatalog.slice(0, 50).map((item) => (
          <div
            key={item.recId}
            className="glass-panel border border-white/10 hover:border-slate-600 p-5 rounded-2xl shadow-xl flex flex-col justify-between space-y-3 transition-all"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="px-2.5 py-0.5 rounded bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 font-bold font-mono">
                  {item.recId} • {item.recommendationTier}
                </span>
                <span className="text-[#00e5ff] font-bold text-xs">{item.targetCompetitorState}</span>
              </div>

              <h4 className="text-base font-bold text-white leading-snug">
                {item.strategicObjective}
              </h4>

              <div className="glass-card p-3 rounded-xl border border-white/10 text-xs space-y-1.5">
                <div>
                  <span className="text-[#8595a8] uppercase text-[10px] block font-semibold">STRUCTURAL VULNERABILITY:</span>
                  <span className="text-[#b6c2d2]">{item.georgiaStructuralVulnerabilityAnchor}</span>
                </div>
                <div className="pt-1 border-t border-white/5">
                  <span className="text-[#8595a8] uppercase text-[10px] block font-semibold">INTERVENTION MECHANICS:</span>
                  <span className="text-[#cbd5e1]">{item.interventionMechanics}</span>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-3 flex items-center justify-between text-xs">
              <span className="text-[#8595a8]">Velocity: <strong className="text-white">{item.executionVelocity}</strong></span>
              <span className="text-[#00ff9d] font-bold">{item.quantifiableYieldROI}</span>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

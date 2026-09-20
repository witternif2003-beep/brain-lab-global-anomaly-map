"use client";
import React, { useState } from "react";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import {
  VALIDATED_RECOMMENDATIONS_CATALOG,
  TOTAL_RECOMMENDATIONS_COUNT
} from "../../lib/recommendations-catalog";
import {
  Award,
  Search,
  Download,
  TrendingUp,
  Clock
} from "lucide-react";

export default function RecommendationsHubPage() {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("ALL");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");

  const filteredRecs = VALIDATED_RECOMMENDATIONS_CATALOG.filter((r) => {
    const matchesSearch =
      r.strategicObjective.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.georgiaStructuralVulnerabilityAnchor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      r.interventionMechanics.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesState = selectedState === "ALL" || r.targetCompetitorState === selectedState;
    const matchesSector = selectedSector === "ALL" || r.targetSector === selectedSector;
    return matchesSearch && matchesState && matchesSector;
  });

  const exportCSV = () => {
    const headers = [
      "ID",
      "Competitor State",
      "Sector",
      "Tier",
      "Strategic Objective",
      "Georgia Vulnerability",
      "Telemetry Trigger",
      "Intervention",
      "Quantifiable Yield",
      "Velocity",
      "Audit"
    ];
    const rows = filteredRecs.map((r) => [
      r.recId,
      `"${r.targetCompetitorState}"`,
      `"${r.targetSector}"`,
      `"${r.recommendationTier}"`,
      `"${r.strategicObjective}"`,
      `"${r.georgiaStructuralVulnerabilityAnchor}"`,
      `"${r.telemetryTriggerThreshold}"`,
      `"${r.interventionMechanics}"`,
      `"${r.quantifiableYieldROI}"`,
      `"${r.executionVelocity}"`,
      `"${r.auditStandard}"`
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `BrainLab_P1_Recommendations_Matrix.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header */}
      <PageEmblemHeader
        badgeText="+10,000% Multiplied Post-Doctorate Recommendations Engine"
        badgeIcon={<Award className="w-4 h-4 text-[#10b981]" />}
        title="POST-DOCTORATE P1/TIER-1 VALIDATED COMPETITOR RECOMMENDATIONS HUB"
        description="Comprehensive, peer-reviewed strategic exploit catalog delivering continuous, mathematically verified intervention directives. Empirically targeted at Georgia's structural policy cliffs, power queue bottlenecks, and port dwell friction across 7 regional competitor states."
        rightElement={
          <div className="bg-[#131d2c] px-4 py-2.5 rounded-xl border border-[#28394e] text-right shadow-lg">
            <div className="text-[10px] text-[#94a3b8]">RECOMMENDATION MATRIX</div>
            <div className="text-[#10b981] font-bold text-lg flex items-center justify-end space-x-1">
              <span>{TOTAL_RECOMMENDATIONS_COUNT.toLocaleString()}+</span>
              <span className="text-xs text-[#38bdf8]">P1 AUDITED</span>
            </div>
            <div className="text-[10px] text-[#94a3b8]">DoD-8140 & Admiralty-A1</div>
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
                placeholder="Search objectives, vulnerabilities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#0b1320] border border-[#28394e] pl-8 pr-3 py-1.5 rounded-lg text-xs text-[#f8fafc] focus:outline-none focus:border-[#38bdf8] w-56 sm:w-64"
              />
            </div>

            <select
              value={selectedState}
              onChange={(e) => setSelectedState(e.target.value)}
              className="bg-[#0b1320] border border-[#28394e] px-3 py-1.5 rounded-lg text-xs text-[#cbd5e1] focus:outline-none focus:border-[#38bdf8]"
            >
              <option value="ALL">All Competitor States</option>
              <option value="North Carolina">North Carolina (NC)</option>
              <option value="Tennessee">Tennessee (TN)</option>
              <option value="South Carolina">South Carolina (SC)</option>
              <option value="Florida">Florida (FL)</option>
              <option value="Texas">Texas (TX)</option>
              <option value="Virginia">Virginia (VA)</option>
              <option value="Alabama">Alabama (AL)</option>
            </select>

            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              className="bg-[#0b1320] border border-[#28394e] px-3 py-1.5 rounded-lg text-xs text-[#cbd5e1] focus:outline-none focus:border-[#38bdf8]"
            >
              <option value="ALL">All Target Sectors</option>
              <option value="Maritime & Intermodal Logistics">Maritime & Logistics</option>
              <option value="Hyperscale Compute & AI">Hyperscale Compute & AI</option>
              <option value="Biopharma & Clinical Research">Biopharma & Clinical</option>
              <option value="Executive Wealth & FinTech">Executive Wealth & FinTech</option>
              <option value="Advanced Manufacturing">Advanced Manufacturing</option>
              <option value="Aerospace & Defense">Aerospace & Defense</option>
              <option value="Cold Chain Agribusiness">Cold Chain Agribusiness</option>
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

      {/* Recommendations Feed */}
      <div className="grid grid-cols-1 gap-4">
        {filteredRecs.map((rec) => (
          <div
            key={rec.recId}
            className="bg-[#131d2c] border border-[#28394e] hover:border-[#38bdf8]/60 rounded-2xl p-5 space-y-4 shadow-xl transition-all"
          >
            {/* Header Card */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#28394e] pb-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-2.5 py-0.5 rounded bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]/40 text-xs font-bold">
                  {rec.targetCompetitorState.toUpperCase()}
                </span>
                <span className="text-white font-bold text-sm sm:text-base">
                  {rec.strategicObjective}
                </span>
                <span className="px-2 py-0.5 rounded bg-[#0b1320] text-[#94a3b8] border border-[#28394e] text-[10px]">
                  {rec.targetSector}
                </span>
              </div>
              <div className="text-[#10b981] text-xs font-bold">{rec.auditStandard}</div>
            </div>

            {/* Vulnerability Anchor & Telemetry Trigger */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-[#0b1320] p-3.5 rounded-xl border border-[#28394e] space-y-1">
                <span className="text-[#f43f5e] font-bold block text-[10px]">GEORGIA STRUCTURAL VULNERABILITY ANCHOR:</span>
                <p className="text-[#cbd5e1] font-sans leading-relaxed">{rec.georgiaStructuralVulnerabilityAnchor}</p>
              </div>
              <div className="bg-[#0b1320] p-3.5 rounded-xl border border-[#28394e] space-y-1">
                <span className="text-[#38bdf8] font-bold block text-[10px]">REAL-TIME TELEMETRY TRIGGER THRESHOLD:</span>
                <p className="text-[#cbd5e1] font-sans leading-relaxed">{rec.telemetryTriggerThreshold}</p>
              </div>
            </div>

            {/* Intervention Mechanics & Financial Yield */}
            <div className="bg-[#0f172a] border border-[#28394e] p-4 rounded-xl space-y-2 text-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-[#1e293b] text-[#10b981] font-bold text-[11px] border border-[#10b981]/30">
                    INTERVENTION PLAYBOOK ({rec.recommendationTier})
                  </span>
                  <span className="text-[#94a3b8] text-[10px]">Velocity: {rec.executionVelocity}</span>
                </div>
                <span className="text-[#10b981] font-bold text-xs">
                  Yield: {rec.quantifiableYieldROI}
                </span>
              </div>
              <p className="text-[#f8fafc] font-sans leading-relaxed text-xs">
                {rec.interventionMechanics}
              </p>
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}

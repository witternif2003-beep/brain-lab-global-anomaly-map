"use client";
import React, { useState } from "react";
import { TELEMETRY_STREAMS } from "../../lib/telemetry-catalog";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import { Radio, Search, CheckCircle2, ExternalLink, Zap, ShieldCheck } from "lucide-react";

export default function SourcesPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const categories = [
    "ALL",
    "Logistics & Maritime",
    "Macro & Labor",
    "Fiscal & Legislative",
    "Infrastructure & Energy",
    "Corporate & Capital",
    "Regulatory & Environmental"
  ];

  const filtered = TELEMETRY_STREAMS.filter((stream) => {
    const matchCategory = selectedCategory === "ALL" || stream.category === selectedCategory;
    const matchQuery =
      stream.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stream.samplingProtocol.toLowerCase().includes(searchQuery.toLowerCase()) ||
      stream.endpoint.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCategory && matchQuery;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header with Rotating Neon White Emblem & Watermark */}
      <PageEmblemHeader
        badgeText="Ingestion Fabric: 100+ Live Telemetry Feeds"
        badgeIcon={<Radio className="w-4 h-4 text-emerald-400" />}
        title="VALIDATED PUBLIC-SOURCE INGESTION STREAMS & DATA FABRIC"
        description="Public-source data streams continuously ingested, normalized to OCSF ontology, and evaluated through LSTM-AE dynamic thresholding and NATO/Admiralty credibility grading (A1/A2)."
        rightElement={
          <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-right shadow-lg">
            <div className="text-[10px] text-slate-500">SYNCHRONIZED STREAMS</div>
            <div className="text-emerald-400 font-bold text-lg">{TELEMETRY_STREAMS.length} ACTIVE PIPELINES</div>
          </div>
        }
      />

      {/* Filter and Search Bar */}
      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search streams by keyword, protocol or endpoint..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
            />
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>All Endpoints 100% Free / Public / Keyless Access</span>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex items-center space-x-1.5 overflow-x-auto py-1">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all whitespace-nowrap ${
                selectedCategory === cat
                  ? "bg-sky-500 text-black shadow"
                  : "bg-slate-900 text-slate-400 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Streams Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((stream) => (
          <div
            key={stream.id}
            className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-xl shadow-xl flex flex-col justify-between space-y-3 transition-all"
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                  {stream.status} • {stream.latencyMs}ms LATENCY
                </span>
                <span className="text-amber-400 font-bold">ADMIRALTY {stream.admiraltyRating}</span>
              </div>

              <h3 className="text-xs sm:text-sm font-bold text-white leading-snug">
                {stream.name}
              </h3>

              <div className="bg-slate-950 p-2.5 rounded border border-slate-800 text-[11px] space-y-1">
                <div className="text-slate-400 flex justify-between">
                  <span>Category:</span>
                  <span className="text-slate-200">{stream.category}</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>Sampling Rate:</span>
                  <span className="text-slate-200 text-right">{stream.sampleRate}</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>ML Protocol:</span>
                  <span className="text-sky-400 font-semibold text-right">{stream.samplingProtocol}</span>
                </div>
                <div className="text-slate-400 flex justify-between">
                  <span>Access Type:</span>
                  <span className="text-emerald-400 text-right">{stream.authType}</span>
                </div>
              </div>

              <div className="bg-sky-950/40 border border-sky-800/40 p-2 rounded text-[10px] text-sky-300">
                <strong>Target Pillar:</strong> {stream.primaryPillarTargeted}
              </div>
            </div>

            <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-[10px]">
              <span className="text-slate-400">Allies: {stream.exploitingStates.join(", ")}</span>
              <a
                href={stream.endpoint}
                target="_blank"
                rel="noreferrer"
                className="text-sky-400 hover:underline flex items-center space-x-1"
              >
                <span>Endpoint</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}

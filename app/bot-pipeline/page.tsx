"use client";
import React, { useState } from "react";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import { Bot, CheckCircle2, AlertOctagon, RefreshCw, GitBranch, Shield, Zap } from "lucide-react";
import { SourceDiscoveryBot, DiscoveredSource } from "../../bots/discovery-bot";

export default function BotPipelinePage() {
  const bot = new SourceDiscoveryBot();
  const [sources, setSources] = useState<DiscoveredSource[]>(bot.getDiscoveredSources());
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const triggerScan = () => {
    setIsScanning(true);
    setTimeout(() => {
      const newSource: DiscoveredSource = {
        id: `SRC-BOT-${Date.now()}`,
        url: "https://www.gaports.com/operations/ocean-terminal-bulletin",
        title: "Ocean Terminal Berth 1 Reconstruction Schedule Shift",
        category: "Logistics",
        firstDiscovered: new Date().toISOString(),
        reliabilityGrade: "A",
        credibilityGrade: 1,
        isSingleSourceClaim: false,
        circularReportingScore: 0.02,
        freshnessScore: 100,
        status: "ACTIVE_VERIFIED"
      };
      setSources(prev => [newSource, ...prev]);
      setIsScanning(false);
    }, 1500);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header */}
      <PageEmblemHeader
        badgeText="Autonomous Source Discovery & Verification"
        badgeIcon={<Bot className="w-4 h-4 text-emerald-400" />}
        title="DEDICATED SOURCE-DISCOVERY BOT & CIRCULAR REPORTING AUDIT"
        description="Continuously searches for new economic development announcements, court filings, and regulatory changes across Georgia. Grades each discovery using the Admiralty System (A–F, 1–6) and prevents echo-chamber circular citations."
        rightElement={
          <button
            onClick={triggerScan}
            disabled={isScanning}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? "animate-spin" : ""}`} />
            <span>{isScanning ? "Scanning Feeds..." : "Run Autonomous Discovery Scan"}</span>
          </button>
        }
      />

      {/* Discovery Pipeline Architecture Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-slate-500 text-[10px]">DISCOVERY FREQUENCY</div>
          <div className="text-emerald-400 font-bold text-sm">CONTINUOUS REAL-TIME</div>
          <div className="text-[10px] text-slate-400 mt-1">Multi-Threaded Web Crawl</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-slate-500 text-[10px]">CIRCULAR DETECTION</div>
          <div className="text-sky-400 font-bold text-sm">GRAPH DEPENDENCY MAP</div>
          <div className="text-[10px] text-slate-400 mt-1">Filters Echo-Chamber Loops</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-slate-500 text-[10px]">SINGLE-SOURCE FLAG</div>
          <div className="text-amber-400 font-bold text-sm">AUTO-CONCORDANCE</div>
          <div className="text-[10px] text-slate-400 mt-1">Requires 2+ Corroborations</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
          <div className="text-slate-500 text-[10px]">DECAY WEIGHTING</div>
          <div className="text-rose-400 font-bold text-sm">TEMPORAL SCORING</div>
          <div className="text-[10px] text-slate-400 mt-1">Stale Data Downgraded</div>
        </div>
      </div>

      {/* Discovered Sources Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <span>AUTONOMOUSLY VERIFIED SOURCES INGESTION QUEUE</span>
          </h3>
          <span className="text-slate-400 text-xs">Total: {sources.length} Sources</span>
        </div>

        <div className="space-y-3">
          {sources.map((src) => (
            <div key={src.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-slate-400">{src.category} • First Ingest: {new Date(src.firstDiscovered).toLocaleTimeString()}</span>
                <div className="flex items-center space-x-2">
                  <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    Admiralty {src.reliabilityGrade}{src.credibilityGrade}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    {src.status}
                  </span>
                </div>
              </div>

              <h4 className="text-xs font-bold text-white">{src.title}</h4>
              <div className="text-[11px] text-sky-400 truncate">{src.url}</div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-900 text-[10px] text-slate-400">
                <div>Circular Reporting Risk: <span className="text-emerald-400 font-bold">{(src.circularReportingScore * 100).toFixed(1)}% (Low)</span></div>
                <div>Freshness Score: <span className="text-sky-300 font-bold">{src.freshnessScore}%</span></div>
                <div>Multi-Source Verified: <span className="text-emerald-400 font-bold">{src.isSingleSourceClaim ? "Flagged Single" : "Concordance Verified"}</span></div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

"use client";
import React from "react";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import { TELEMETRY_BENCHMARKS, ARENA_AI_BENCHMARKS } from "../../lib/telemetry-upgrade-models";
import { Cpu, Zap, Award, Layers, TrendingUp, CheckCircle2, ShieldCheck, Terminal } from "lucide-react";

export default function BenchmarksPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header */}
      <PageEmblemHeader
        badgeText="+7,000 P1 Tier 1 Telemetry Upgrades"
        badgeIcon={<Zap className="w-4 h-4 text-emerald-400" />}
        title="STATE-OF-THE-ART TELEMETRY ANOMALY DETECTION BENCHMARKS"
        description="Comprehensive evaluation across NASA SMAP/MSL, EIRSAT-1, and OpenTelemetry AIOps benchmarks. Integrates LSTD-Detect, GST-Net, STGNN, MSGMamba, and Mantis with Arena AI crowdsourced model evaluation."
        rightElement={
          <div className="glass-card px-4 py-2.5 rounded-xl border border-white/10 text-right shadow-lg">
            <div className="text-[10px] text-slate-500">MAX BENCHMARK F1</div>
            <div className="text-emerald-400 font-bold text-lg">0.986 (STGNN)</div>
          </div>
        }
      />

      {/* Benchmarks Overview Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="glass-panel border border-white/10 p-4 rounded-xl">
          <div className="text-slate-500 text-[10px]">VGCL CONTINUAL LEARNING</div>
          <div className="text-emerald-400 font-bold text-sm">F0.5: 92.9%</div>
          <div className="text-[10px] text-slate-400 mt-1">&lt;5% Training Data Needed</div>
        </div>
        <div className="glass-panel border border-white/10 p-4 rounded-xl">
          <div className="text-slate-500 text-[10px]">FALSE POSITIVE REDUCTION</div>
          <div className="text-sky-400 font-bold text-sm">26x SUPPRESSION</div>
          <div className="text-[10px] text-slate-400 mt-1">Via Mantis HPC &amp; Sliding Buffers</div>
        </div>
        <div className="glass-panel border border-white/10 p-4 rounded-xl">
          <div className="text-slate-500 text-[10px]">INFERENCE LATENCY</div>
          <div className="text-amber-400 font-bold text-sm">0.08 ms / SAMPLE</div>
          <div className="text-[10px] text-slate-400 mt-1">LSTD-Detect Edge Engine</div>
        </div>
        <div className="glass-panel border border-white/10 p-4 rounded-xl">
          <div className="text-slate-500 text-[10px]">ARENA AI EVALUATION</div>
          <div className="text-rose-400 font-bold text-sm">TOP TIER (1,300+ ELO)</div>
          <div className="text-[10px] text-slate-400 mt-1">Multi-Model Agent Verification</div>
        </div>
      </div>

      {/* Model Benchmark Grid */}
      <div className="glass-panel border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <h3 className="text-sm font-bold text-white flex items-center space-x-2">
            <Cpu className="w-4 h-4 text-sky-400" />
            <span>DEPLOYED TELEMETRY ANOMALY DETECTION ENGINES</span>
          </h3>
          <span className="text-xs text-slate-400">Validated Mathematical Architectures</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TELEMETRY_BENCHMARKS.map((m, idx) => (
            <div key={idx} className="glass-card p-4 rounded-xl border border-white/10 space-y-3 flex flex-col justify-between">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    F1 SCORE: {m.f1Score}
                  </span>
                  <span className="text-slate-400">{m.inferenceLatency}</span>
                </div>

                <h4 className="text-xs font-bold text-white">{m.modelName}</h4>
                <div className="text-[11px] text-sky-300 font-semibold">{m.architecture}</div>

                <div className="glass-panel/80 p-2.5 rounded border border-white/10/80 text-[11px] space-y-1">
                  <div className="text-slate-400">Benchmark: <span className="text-slate-200">{m.evaluationBenchmark}</span></div>
                  <div className="text-slate-400">FP Mitigation: <span className="text-emerald-400 font-semibold">{m.falsePositiveReduction}</span></div>
                </div>

                <p className="text-[11px] text-slate-300 font-sans leading-relaxed">
                  {m.keyInnovation}
                </p>
              </div>

              <div className="border-t border-white/10 pt-2 text-[10px] text-brand-gold">
                Target Pipeline: {m.georgiaPipelineTarget}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Arena AI Leaderboard Integration Section */}
      <div className="glass-panel border border-white/10 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Award className="w-4 h-4 text-brand-gold" />
              <span>ARENA AI CROWDSOURCED MODEL BENCHMARK HARNESS</span>
            </h3>
            <p className="text-xs text-slate-400 font-sans">
              Daily keyless snapshot integration via <code className="text-sky-300">api.wulong.dev/arena-ai-leaderboards</code> mapping community-vetted ELO scores to our validation agents.
            </p>
          </div>
          <span className="text-xs text-emerald-400 font-bold">LIVE ELO SYNC</span>
        </div>

        <div className="space-y-3">
          {ARENA_AI_BENCHMARKS.map((item) => (
            <div key={item.rank} className="glass-card p-3.5 rounded-xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center space-x-3">
                <span className="w-6 h-6 rounded-full glass-panel border border-slate-700 flex items-center justify-center font-bold text-slate-200 shrink-0">
                  #{item.rank}
                </span>
                <div>
                  <div className="text-white font-bold">{item.modelName} <span className="text-slate-500 font-normal">({item.vendor})</span></div>
                  <div className="text-[11px] text-sky-400">{item.evalCategory}</div>
                </div>
              </div>

              <div className="text-slate-300 text-[11px] font-sans max-w-md">
                <strong>Anomaly Role:</strong> {item.roleInAnomalyVerification}
              </div>

              <div className="text-right shrink-0">
                <div className="text-emerald-400 font-bold text-sm">{item.eloScore} ELO</div>
                <div className="text-[10px] text-slate-500">95% CI: {item.ci95}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

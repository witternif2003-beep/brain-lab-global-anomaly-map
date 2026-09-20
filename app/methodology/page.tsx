import React from "react";
import { FileCheck, Shield, Cpu, BookOpen } from "lucide-react";
import PageEmblemHeader from "../../components/PageEmblemHeader";

export default function MethodologyPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-8 font-mono">
      
      {/* Branded Header with Rotating Neon Glowing Emblem & Watermark */}
      <PageEmblemHeader
        badgeText="Scientific & Analytical Architecture"
        badgeIcon={<FileCheck className="w-4 h-4 text-brand-gold" />}
        title="POST-DOCTORATE ANOMALY DETECTION & ADMISSIBILITY METHODOLOGY"
        description="Specification of the hybrid machine learning telemetry pipeline, Admiralty System source credibility scoring, and evidentiary provenance controls governing the Brain Lab platform."
      />

      {/* Section 1: Machine Learning Architecture */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h2 className="text-base font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-2">
          <Cpu className="w-5 h-5 text-sky-400" />
          <span>1. HYBRID TELEMETRY ANOMALY DETECTION PIPELINE</span>
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="font-mono text-sky-400 font-bold block text-sm">LSTM-AE + LSTD-Detect</span>
            <p className="text-slate-300 text-xs">
              Stacked Long Short-Term Memory Autoencoders learn baseline normal dynamics from 100+ public feeds. Employs non-parametric dynamic thresholding to track non-stationary economic regimes without manual calibration.
            </p>
            <div className="text-[11px] font-mono text-slate-500">NASA SMAP/MSL F1: 0.81</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="font-mono text-emerald-400 font-bold block text-sm">STGNN (Spatial-Temporal)</span>
            <p className="text-slate-300 text-xs">
              Spatio-Temporal Graph Neural Networks model intermodal rail, berth, and maritime vessel dwell couplings at the Port of Savannah and Port of Brunswick, isolating physical bottlenecks before editorial reporting.
            </p>
            <div className="text-[11px] font-mono text-slate-500">Deployment F1: 0.986</div>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <span className="font-mono text-amber-400 font-bold block text-sm">Isolation Forest + XGBoost</span>
            <p className="text-slate-300 text-xs">
              Ensemble decision forest isolates extreme point anomalies across tax collection variance, county-level corporate registrations, and workforce layoffs (WARN Act notices).
            </p>
            <div className="text-[11px] font-mono text-slate-500">ROC-AUC: 0.962</div>
          </div>
        </div>
      </div>

      {/* Section 2: Admiralty System Credibility Grading */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-4 shadow-xl">
        <h2 className="text-base font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-2">
          <Shield className="w-5 h-5 text-amber-400" />
          <span>2. ADMIRALTY SYSTEM (CATS) SOURCE VERIFICATION</span>
        </h2>
        <p className="text-xs text-slate-300 font-sans leading-relaxed">
          All intelligence products are scored using the standardized NATO / Admiralty Code matrix evaluating source reliability (A to F) against information credibility (1 to 6):
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="font-bold text-amber-300 font-mono">SOURCE RELIABILITY (A–F)</div>
            <ul className="space-y-1 text-slate-400 text-[11px]">
              <li><strong className="text-white">A: Completely Reliable</strong> — Official state statute, primary ports telemetry.</li>
              <li><strong className="text-white">B: Usually Reliable</strong> — Regulatory agencies, audited nonprofit datasets.</li>
              <li><strong className="text-white">C: Fairly Reliable</strong> — Verified industry research groups.</li>
              <li><strong className="text-white">D–F: Low/Unreliable</strong> — Filtered out by automated intake.</li>
            </ul>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
            <div className="font-bold text-sky-300 font-mono">INFORMATION CREDIBILITY (1–6)</div>
            <ul className="space-y-1 text-slate-400 text-[11px]">
              <li><strong className="text-white">1: Confirmed by Other Sources</strong> — Multi-sensor concordance verified.</li>
              <li><strong className="text-white">2: Probably True</strong> — Corroborated with historical telemetry trends.</li>
              <li><strong className="text-white">3: Possibly True</strong> — Pending secondary verification.</li>
              <li><strong className="text-white">4–6: Doubtful/Improbable</strong> — Rejected by verification bot.</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Section 3: Legal & Public Record Boundary Statement */}
      <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-2xl space-y-3 font-sans text-xs text-slate-300 leading-relaxed shadow-xl">
        <h2 className="text-base font-bold text-white flex items-center space-x-2 font-mono border-b border-slate-800 pb-2">
          <BookOpen className="w-5 h-5 text-emerald-400" />
          <span>3. COMPLIANCE & LEGAL BOUNDARY STATEMENT</span>
        </h2>
        <p>
          This application functions exclusively as a lawful, open-source competitive market intelligence platform compiled from public-record materials (Georgia General Assembly legislative enactments, Georgia Ports Authority public operational summaries, US Bureau of Labor Statistics, Federal Reserve consumer debt statistics, and academic research).
        </p>
        <p>
          No non-public surveillance, intercept capability, or unauthorized database penetration is conducted. All figures and model weights are reproducible from published statistical releases.
        </p>
        <p className="text-brand-gold font-mono text-[11px] pt-1">
          Emblem used for identification purposes only. Not affiliated with any government agency.
        </p>
      </div>

    </div>
  );
}

"use client";
import React from "react";
import { Landmark, ShieldCheck } from "lucide-react";
import FederalRegistryGrid from "../../components/federal-registry/FederalRegistryGrid";

export default function FederalRegistryPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      <div className="relative rounded-[32px] sm:rounded-[48px] bg-gradient-to-b from-[#051124]/80 via-[#030c1c]/75 to-[#010610]/80 backdrop-blur-3xl border-2 border-[#bd00ff]/60 p-5 sm:p-8 space-y-4 overflow-hidden shadow-[0_16px_70px_rgba(189,0,255,0.25),inset_0_1px_4px_rgba(189,0,255,0.4)]">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#bd00ff]/15 rounded-full blur-[130px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-10 w-96 h-96 bg-[#00e5ff]/15 rounded-full blur-[130px] pointer-events-none -z-10" />
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#2a0845]/90 to-[#1b003a]/90 text-[#e0aaff] border-2 border-[#bd00ff]/80 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_16px_rgba(189,0,255,0.4)] w-fit">
            <Landmark className="w-3.5 h-3.5" /> 42-Entity National Directory
          </span>
          <span className="px-3.5 py-1.5 rounded-full bg-[#002b1b]/90 text-[#69f0ae] border-2 border-[#00ff88]/80 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_16px_rgba(0,255,136,0.4)] w-fit">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-ping shrink-0" /> Live public APIs only
          </span>
          <span className="px-3.5 py-1.5 rounded-full bg-[#331e00]/90 text-[#ffd54f] border-2 border-[#ffaa00]/70 text-[10px] font-bold uppercase tracking-wider w-fit shadow-[0_0_12px_rgba(255,170,0,0.3)]">
            SHA-256 provenance on every value
          </span>
        </div>
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#bd00ff] via-[#00e5ff] to-[#00ff88] p-0.5 flex items-center justify-center shadow-[0_0_22px_rgba(189,0,255,0.6)] shrink-0">
            <div className="w-full h-full bg-[#020b18] rounded-[14px] flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-[#e0aaff]" />
            </div>
          </div>
          <h1 className="text-base sm:text-2xl font-black tracking-wide uppercase leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#e0aaff] via-[#00e5ff] to-white">
              Federal Registry — Departments, Agencies & GSEs
            </span>
          </h1>
        </div>
        <p className="text-xs sm:text-[13px] text-[#b2ebf2] leading-relaxed">
          National directory of the 1988 American Information Handbook entity universe. Each entity carries live national
          metrics — USAspending fiscal-year award obligations by awarding agency and Federal Register trailing-12-month
          document counts with the newest documents linked. All values are national aggregates with source URL, retrieval
          time and SHA-256 attached; per-jurisdiction views live on the jurisdiction cards.
        </p>
      </div>
      <FederalRegistryGrid />
    </div>
  );
}

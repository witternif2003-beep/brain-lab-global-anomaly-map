"use client";
import React from "react";
import { ShieldCheck } from "lucide-react";

export default function ComplianceNotice() {
  return (
    <aside
      aria-label="Compliance and Affiliation Notice"
      className="bg-[#0b1320]/80 backdrop-blur-md border-b border-white/10 text-xs text-[#94a3b8] px-3 sm:px-4 py-2"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-[#38bdf8] shrink-0" />
          <div className="flex flex-wrap items-center gap-x-1.5">
            <span className="font-semibold text-[#f8fafc] tracking-wide font-mono text-[10px] sm:text-xs">
              MANDATORY COMPLIANCE NOTICE:
            </span>
            <span className="text-[#cbd5e1] text-[10px] sm:text-xs font-mono">
              Emblem used for identification purposes only. Not affiliated with any government agency.
            </span>
          </div>
        </div>
        <div className="hidden md:flex items-center space-x-1.5 text-[11px] text-[#10b981] font-mono shrink-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse"></span>
          <span>Open-Source Research Workspace</span>
        </div>
      </div>
    </aside>
  );
}

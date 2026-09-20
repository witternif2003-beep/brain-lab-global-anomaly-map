"use client";
import React from "react";
import { ShieldCheck } from "lucide-react";

export default function ComplianceNotice() {
  return (
    <aside
      aria-label="Compliance and Affiliation Notice"
      className="bg-[#332a42] border-b border-[#54446d] text-xs text-[#e5bca8] px-3 sm:px-4 py-2"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 sm:gap-2">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-[#ffd87a] shrink-0" />
          <div className="flex flex-wrap items-center gap-x-1.5">
            <span className="font-semibold text-[#f5effa] tracking-wide font-mono text-[10px] sm:text-xs">
              MANDATORY COMPLIANCE NOTICE:
            </span>
            <span className="text-[#baaed3] text-[10px] sm:text-xs font-mono">
              Emblem used for identification purposes only. Not affiliated with any government agency.
            </span>
          </div>
        </div>
        <div className="hidden md:flex items-center space-x-1.5 text-[11px] text-[#62d3ee] font-mono shrink-0">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#88f4e2] animate-pulse"></span>
          <span>Open-Source Research Workspace</span>
        </div>
      </div>
    </aside>
  );
}

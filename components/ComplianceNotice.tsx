"use client";
import React from "react";
import { ShieldCheck, AlertCircle } from "lucide-react";

export default function ComplianceNotice() {
  return (
    <aside
      aria-label="Compliance and Affiliation Notice"
      className="bg-[#231a30] border-b border-[#624d77]/60 text-xs text-[#dfac97] px-4 py-2"
    >
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-4 h-4 text-[#ffd269] shrink-0" />
          <span className="font-semibold text-[#f5effa] tracking-wide font-mono text-[11px] sm:text-xs">
            MANDATORY COMPLIANCE NOTICE:
          </span>
          <span className="text-[#9f94ba] text-[11px] sm:text-xs font-mono">
            Emblem used for identification purposes only. Not affiliated with any government agency.
          </span>
        </div>
        <div className="hidden md:flex items-center space-x-1.5 text-[11px] text-[#5ecbe6] font-mono">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#7ef0dc] animate-pulse"></span>
          <span>Open-Source Research Workspace</span>
        </div>
      </div>
    </aside>
  );
}

import React from "react";
import { Landmark } from "lucide-react";
import ElectionSourcesPanel from "../../components/election-sources/ElectionSourcesPanel";

export default function ElectionSourcesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      <div className="relative rounded-[32px] sm:rounded-[48px] bg-gradient-to-b from-[#051124]/80 via-[#030c1c]/75 to-[#010610]/80 backdrop-blur-3xl border-2 border-[#00e5ff]/60 p-5 sm:p-8 space-y-3 shadow-[0_16px_70px_rgba(0,229,255,0.25),inset_0_1px_4px_rgba(0,229,255,0.4)]">
        <div className="flex items-center gap-3">
          <Landmark className="w-6 h-6 text-[#00e5ff]" />
          <h1 className="text-base sm:text-2xl font-black tracking-wide uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] via-[#69f0ae] to-white">
            Election Sources — 56 Official Offices
          </h1>
        </div>
        <p className="text-xs sm:text-[13px] text-[#b2ebf2] leading-relaxed">
          Source monitor for the official election-office website of every state, DC and the five territories, as listed in
          the USA.gov state election office directory. Each site is fetched live: HTTP status, latency, a SHA-256 of the
          visible page text, a check that the page names its own jurisdiction, a reliability band from the probes actually
          observed, and a line diff (Myers) whenever the page text changes. The pinned roster is compared against the live
          directory on every run. This monitors the public websites only; it holds no voter or person-level data.
        </p>
      </div>
      <ElectionSourcesPanel />
    </div>
  );
}

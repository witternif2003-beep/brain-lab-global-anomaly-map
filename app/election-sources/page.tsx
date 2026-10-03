import React from "react";
import { Landmark } from "lucide-react";
import ElectionSourcesPanel from "../../components/election-sources/ElectionSourcesPanel";

export default function ElectionSourcesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      <div className="relative rounded-[32px] sm:rounded-[48px] bg-gradient-to-b from-[#051124]/80 via-[#030c1c]/75 to-[#010610]/80 backdrop-blur-3xl border-2 border-[#00e5ff]/60 p-5 sm:p-8 space-y-4 overflow-hidden shadow-[0_16px_70px_rgba(0,229,255,0.25),inset_0_1px_4px_rgba(0,229,255,0.4)]">
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00e5ff]/15 rounded-full blur-[130px] pointer-events-none -z-10" />
        <div className="absolute bottom-0 left-10 w-96 h-96 bg-[#bd00ff]/15 rounded-full blur-[130px] pointer-events-none -z-10" />
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#2a0845]/90 to-[#1b003a]/90 text-[#e0aaff] border-2 border-[#bd00ff]/80 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_16px_rgba(189,0,255,0.4)] w-fit">
            <Landmark className="w-3.5 h-3.5" /> 56 Official Election Offices
          </span>
          <span className="px-3.5 py-1.5 rounded-full bg-[#002b1b]/90 text-[#69f0ae] border-2 border-[#00ff88]/80 text-[10px] font-bold uppercase tracking-wider flex items-center gap-2 shadow-[0_0_16px_rgba(0,255,136,0.4)] w-fit">
            <span className="w-2 h-2 rounded-full bg-[#00ff88] animate-ping shrink-0" /> Live site probes
          </span>
          <span className="px-3.5 py-1.5 rounded-full bg-[#33002a]/90 text-[#ff9ee8] border-2 border-[#ff2ec4]/70 text-[10px] font-bold uppercase tracking-wider w-fit shadow-[0_0_12px_rgba(255,46,196,0.3)]">
            Source: USA.gov directory
          </span>
        </div>
        <div className="flex items-start sm:items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#00e5ff] via-[#00ff88] to-[#bd00ff] p-0.5 flex items-center justify-center shadow-[0_0_22px_rgba(0,229,255,0.6)] shrink-0">
            <div className="w-full h-full bg-[#020b18] rounded-[14px] flex items-center justify-center">
              <Landmark className="w-5 h-5 text-[#00e5ff]" />
            </div>
          </div>
          <h1 className="text-base sm:text-2xl font-black tracking-wide uppercase leading-tight">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] via-[#69f0ae] to-white">
              Election Sources — 50 States, DC & 5 Territories
            </span>
          </h1>
        </div>
        <p className="text-xs sm:text-[13px] text-[#b2ebf2] leading-relaxed">
          Source monitor for the official election-office website of every state, DC and the five territories, as listed in
          the USA.gov state election office directory. Each site is fetched live: HTTP status, latency, a SHA-256 of the
          visible page text, a check that the page names its own jurisdiction, a reliability band from the probes actually
          observed, and a line diff (Myers) whenever the page text changes. The pinned roster is compared against the live
          directory on every run. Each card also shows the official registered-voter total from the EAC 2024 Election
          Administration and Voting Survey and the justice.gov press releases on noncitizen-voting cases issued by that
          jurisdiction's U.S. Attorney's Office. No voter file or person-level registration data is used.
        </p>
      </div>
      <ElectionSourcesPanel />
    </div>
  );
}

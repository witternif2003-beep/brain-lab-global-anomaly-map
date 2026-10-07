"use client";
import React from "react";
import { ListOrdered } from "lucide-react";
import JurisdictionRecordList from "../../components/jurisdiction-records/JurisdictionRecordList";

export default function JurisdictionRecordsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      <div className="relative rounded-[32px] sm:rounded-[48px] bg-gradient-to-b from-[#051124]/80 via-[#030c1c]/75 to-[#010610]/80 backdrop-blur-3xl border-2 border-[#00e5ff]/60 p-5 sm:p-8 space-y-3 shadow-[0_16px_70px_rgba(0,229,255,0.25),inset_0_1px_4px_rgba(0,229,255,0.4)]">
        <div className="flex items-center gap-3">
          <ListOrdered className="w-6 h-6 text-[#00e5ff]" />
          <h1 className="text-base sm:text-2xl font-black tracking-wide uppercase text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] via-[#69f0ae] to-white">
            Public Records — 56 Jurisdictions
          </h1>
        </div>
        <p className="text-xs sm:text-[13px] text-[#b2ebf2] leading-relaxed">
          Every record is a real public item: an OpenFEMA disaster declaration or a justice.gov national-security press
          release issued by that jurisdiction&apos;s U.S. Attorney&apos;s Office. Newest first, 25 per batch, each linked to its
          source. Record counts are whatever the agencies publish; nothing is generated to fill a quota. DOJ releases
          announce charges, pleas or sentences; charges are allegations.
        </p>
      </div>
      <JurisdictionRecordList />
    </div>
  );
}

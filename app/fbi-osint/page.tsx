"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Radar } from "lucide-react";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import FbiOsintBrowser from "../../components/FbiOsintBrowser";

function ago(iso: string | null, now: number): string {
  if (!iso) return "—";
  const min = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  return min < 1 ? "just now" : min < 60 ? `${min} min ago` : min < 2880 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`;
}

export default function FbiOsintPage() {
  const [meta, setMeta] = useState<{ total: number; available: number; fetchedAt: string } | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const onMeta = useCallback((m: { total: number; available: number; fetchedAt: string }) => setMeta(m), []);
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-16 space-y-6 font-mono">
      <PageEmblemHeader
        badgeText="Public OSINT · FBI priority areas"
        badgeIcon={<Radar className="w-4 h-4 text-[#38bdf8]" />}
        title="FBI-RELEVANT PUBLIC OSINT INDICATORS"
        description="Every public indicator currently published in FBI priority areas (cybercrime, ransomware, fraud, exploited vulnerabilities), merged from FBI, IC3, CISA, abuse.ch and ransomware.live feeds. Refreshes every 5 minutes. URLs, domains and IPs are defanged. No FBI Wanted data."
        rightElement={
          <div className="glass-panel px-4 py-2.5 rounded-xl border border-white/10 text-right shadow-lg">
            <div className="text-[10px] text-[#94a3b8]">INDICATORS SHOWN / AVAILABLE</div>
            <div className="text-[#38bdf8] font-bold text-lg">
              {meta ? `${meta.total.toLocaleString()} / ${meta.available.toLocaleString()}` : "…"}
            </div>
            <div className="text-[10px] text-[#94a3b8]">updated {ago(meta?.fetchedAt ?? null, now)}</div>
          </div>
        }
      />

      <FbiOsintBrowser onMeta={onMeta} />
    </div>
  );
}

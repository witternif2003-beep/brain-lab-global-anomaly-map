"use client";

import React, { useEffect, useState } from "react";
import { ExternalLink, RefreshCw } from "lucide-react";
import type { VoterDashboard, VoterDashboardCard } from "../../lib/elections/types";

const PILL = "px-3 py-1 rounded-full border font-mono font-bold uppercase tracking-wider backdrop-blur-md";
const TERRITORIES = new Set(["PR", "GU", "VI", "AS", "MP"]);

const BAND_STYLE: Record<string, string> = {
  high: "text-[#69f0ae] border-[#00ff88]/70 bg-[#002617]/70",
  medium: "text-[#ffd54f] border-[#ffaa00]/60 bg-[#331e00]/70",
  low: "text-[#ff8a80] border-[#ff3d00]/60 bg-[#2b0d00]/70",
};

const fmt = (n: number | null) => (n === null ? "—" : n.toLocaleString("en-US"));

function Card({ card }: { card: VoterDashboardCard }) {
  const { office, probe, eavs, dojReleases } = card;
  return (
    <section
      data-testid={`voter-card-${office.code}`}
      className="rounded-3xl border-2 border-[#00e5ff]/30 bg-[#020b18]/60 p-4 backdrop-blur-md space-y-2"
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-extrabold tracking-widest text-[#e0f7fa]">
            {office.code} — {office.jurisdiction}
          </h2>
          <p className="text-[10px] text-[#80deea]/70">{office.officeLabel}</p>
        </div>
        {probe && (
          <span className={`${PILL} px-2 py-0.5 text-[9px] shrink-0 ${BAND_STYLE[probe.band]}`}>
            {probe.band}
          </span>
        )}
      </header>

      <div className="text-[10px] text-[#80deea]/80">
        <a
          href={office.officeUrl}
          target="_blank"
          rel="noreferrer"
          className="text-[#00e5ff] hover:underline inline-flex items-center gap-1 break-all"
        >
          {office.officeUrl.replace(/^https?:\/\//, "").slice(0, 48)}
          <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
        {probe && (
          <div className="mt-1 text-[#80deea]/60">
            HTTP {probe.httpStatus ?? "?"} • {probe.latencyMs ?? "?"} ms
            {probe.namesJurisdiction === true && " • names jurisdiction ✓"}
            {probe.namesJurisdiction === false && " • name check ✗"}
            {probe.error && <span className="text-[#ff8a80]"> • {probe.error}</span>}
          </div>
        )}
        {probe?.pageTitle && (
          <div className="text-[#80deea]/50 truncate" title={probe.pageTitle}>
            live title: {probe.pageTitle}
          </div>
        )}
        {probe?.sha256VisibleText && (
          <div className="text-[#00e5ff]/40 truncate" title={probe.sha256VisibleText}>
            sha256 {probe.sha256VisibleText.slice(0, 16)}… • {probe.checkedAt.slice(0, 19)}Z
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[#bd00ff]/40 bg-[#1b0833]/40 px-3 py-2 text-[10px]">
        <div className="text-[9px] uppercase tracking-widest text-[#e0aaff]/70">
          EAC EAVS {eavs?.surveyYear ?? 2024} registered voters
        </div>
        {eavs ? (
          <>
            <div className="mt-1 grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[9px] text-[#e0aaff]/60 uppercase">total</div>
                <div className="text-sm font-extrabold text-[#e0f7fa]">{fmt(eavs.totalRegistered)}</div>
              </div>
              <div>
                <div className="text-[9px] text-[#e0aaff]/60 uppercase">active</div>
                <div className="text-sm font-extrabold text-[#69f0ae]">{fmt(eavs.totalActive)}</div>
              </div>
              <div>
                <div className="text-[9px] text-[#e0aaff]/60 uppercase">inactive</div>
                <div className="text-sm font-extrabold text-[#ffd54f]">{fmt(eavs.totalInactive)}</div>
              </div>
            </div>
            <div className="mt-1 text-[#e0aaff]/60">
              coverage {eavs.coverageResponded}/{eavs.coverageOf} jurisdictions
              {eavs.note && <span> • {eavs.note}</span>}
            </div>
          </>
        ) : (
          <div className="mt-1 text-[#ff8a80]">EAVS totals unavailable in this run</div>
        )}
      </div>

      {dojReleases.length > 0 && (
        <ul className="space-y-1">
          {dojReleases.map((r) => (
            <li key={r.url} className="text-[10px] text-[#ffab91]">
              <a href={r.url} target="_blank" rel="noreferrer" className="hover:underline">
                {r.title}
              </a>
              <span className="text-[#ffab91]/50"> • {r.attribution}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type Filter = "all" | "states" | "territories";

export default function VoterDashboardGrid() {
  const [data, setData] = useState<VoterDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = () => {
    setLoading(true);
    setError(null);
    fetch("/api/ingest/voter-dashboard?code=ALL", { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setData(j as VoterDashboard);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "request failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(), []);

  const cards = (data?.cards ?? []).filter((c) => {
    if (filter === "territories") return TERRITORIES.has(c.office.code);
    if (filter === "states") return !TERRITORIES.has(c.office.code);
    return true;
  });

  return (
    <div className="rounded-[32px] bg-gradient-to-b from-[#051124]/80 via-[#030c1c]/75 to-[#010610]/80 backdrop-blur-3xl border-2 border-[#bd00ff]/50 p-4 sm:p-6 space-y-4 font-mono shadow-[0_16px_70px_rgba(189,0,255,0.20)]">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as Filter)}
          className="rounded-full bg-[#020b18]/60 border-2 border-[#bd00ff]/50 px-4 py-2.5 text-xs text-[#e0f7fa] outline-none w-full sm:w-64"
        >
          <option value="all">All 56 — states, DC &amp; territories</option>
          <option value="states">States + DC only</option>
          <option value="territories">5 territories only</option>
        </select>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          {data && (
            <span className={`${PILL} text-[10px] text-[#69f0ae] border-[#00ff88]/60 bg-[#002617]/70`}>
              {cards.length} cards • {data.generatedAt.slice(0, 19)}Z
            </span>
          )}
          <button
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#3b005c]/80 to-[#220044]/80 text-[#e0aaff] hover:text-white border-2 border-[#bd00ff] text-xs font-extrabold uppercase tracking-wider transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Probing…" : "Re-probe"}
          </button>
        </div>
      </div>

      {loading && !data && (
        <p className="text-xs text-[#80deea]/70">Probing 56 office sites + EAC file — first run takes ~40s…</p>
      )}
      {error && <p className="text-xs text-[#ff8a80]">Error: {error}</p>}
      {data && data.unavailable.length > 0 && (
        <ul className="text-[10px] text-[#ffd54f]/80 space-y-0.5">
          {data.unavailable.map((u) => (
            <li key={u}>⚠ {u}</li>
          ))}
        </ul>
      )}
      {!data?.dojAvailable && data && (
        <p className="text-[10px] text-[#80deea]/60">
          DOJ press releases unavailable in this run (justice.gov blocks automated fetches) — section
          left empty, never estimated.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {cards.map((c) => (
          <Card key={c.office.code} card={c} />
        ))}
      </div>
    </div>
  );
}

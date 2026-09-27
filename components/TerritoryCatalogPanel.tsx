"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Globe, MapPin, Search, ChevronLeft, ChevronRight, Clock, ShieldCheck } from "lucide-react";
import { STATEWIDE_ANOMALIES_1000 } from "../lib/statewide-anomalies";
import {
  JURISDICTIONS,
  BATCH_SIZE,
  SECTOR_NAMES,
  batchCountFor,
  buildJurisdictionIndex,
  catalogTotals,
  generateSyntheticRecord,
  jurisdictionByCode,
  type CatalogIndexRow
} from "../lib/territory-catalog";

type StatusFilter = "ALL" | "CURATED" | "SYNTHETIC";

interface PanelRow {
  id: string;
  term: string;
  sub: string;
  batch: number;
  curated: boolean;
  sector: string;
}

const ET_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  month: "long",
  day: "numeric",
  year: "numeric"
});
const ET_TIME = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZoneName: "short"
});

export default function TerritoryCatalogPanel() {
  const [jurisdiction, setJurisdiction] = useState<string>("GA");
  const [batch, setBatch] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState<string>("");
  const [sector, setSector] = useState<string>("ALL_SECTORS");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // Live Eastern clock — mounted-gated so SSR hydration never mismatches.
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const totals = useMemo(() => catalogTotals(), []);
  const meta = jurisdictionByCode(jurisdiction);
  const isGA = jurisdiction === "GA";
  const batches = isGA ? 40 : batchCountFor(jurisdiction);

  // Synthetic index for non-GA tabs (deterministic, memoized per jurisdiction).
  const syntheticIndex = useMemo<CatalogIndexRow[]>(
    () => (isGA ? [] : buildJurisdictionIndex(jurisdiction)),
    [jurisdiction, isGA]
  );

  // Rows for the active tab + batch, before search/status/sector filtering.
  const tabRows = useMemo<PanelRow[]>(() => {
    if (isGA) {
      const start = (batch - 1) * BATCH_SIZE;
      return STATEWIDE_ANOMALIES_1000.slice(start, start + BATCH_SIZE).map((a) => ({
        id: a.id,
        term: a.term,
        sub: `Georgia • Interstate corridor • batch ${a.batchNumber}`,
        batch: a.batchNumber,
        curated: a.verified === true,
        sector: "CURATED CORPUS"
      }));
    }
    const start = (batch - 1) * BATCH_SIZE;
    return syntheticIndex.slice(start, start + BATCH_SIZE).map((r) => ({
      id: r.id,
      term: r.term,
      sub: `${meta.name} • ${r.sector} • batch ${r.batch}`,
      batch: r.batch,
      curated: false,
      sector: r.sector
    }));
  }, [isGA, batch, syntheticIndex, meta.name]);

  // Realtime query across the FULL tab corpus when searching/filtering by sector.
  const querying = query.trim().length > 0 || sector !== "ALL_SECTORS";
  const queryRows = useMemo<PanelRow[]>(() => {
    if (!querying) return [];
    const q = query.trim().toLowerCase();
    if (isGA) {
      return STATEWIDE_ANOMALIES_1000.filter((a) => !q || a.term.toLowerCase().includes(q)).map(
        (a) => ({
          id: a.id,
          term: a.term,
          sub: `Georgia • Interstate corridor • batch ${a.batchNumber}`,
          batch: a.batchNumber,
          curated: a.verified === true,
          sector: "CURATED CORPUS"
        })
      );
    }
    return syntheticIndex
      .filter(
        (r) =>
          (sector === "ALL_SECTORS" || r.sector === sector) &&
          (!q || r.term.toLowerCase().includes(q) || r.id.toLowerCase().includes(q))
      )
      .map((r) => ({
        id: r.id,
        term: r.term,
        sub: `${meta.name} • ${r.sector} • batch ${r.batch}`,
        batch: r.batch,
        curated: false,
        sector: r.sector
      }));
  }, [querying, query, sector, isGA, syntheticIndex, meta.name]);

  const baseRows = querying ? queryRows.slice(0, 50) : tabRows;
  const rows = baseRows.filter((r) =>
    statusFilter === "ALL" ? true : statusFilter === "CURATED" ? r.curated : !r.curated
  );

  const selectJurisdiction = (code: string) => {
    setJurisdiction(code);
    setBatch(1);
    setExpandedId(null);
    setQuery("");
    setSector("ALL_SECTORS");
  };

  return (
    <div className="rounded-[28px] border-2 border-[#b45309] bg-[#0d0a06]/98 p-4 sm:p-6 space-y-4 shadow-[0_16px_60px_rgba(0,0,0,0.9),inset_0_1px_3px_rgba(217,119,6,0.25)] font-mono">
      {/* Header — matches statewide amber spec exactly */}
      <div className="flex items-center gap-2 text-[#f5a623]">
        <Globe className="w-4 h-4 shrink-0" />
        <h3 className="text-xs sm:text-sm font-black tracking-widest uppercase">
          All U.S. States &amp; Territories — {totals.jurisdictions} Jurisdictions
        </h3>
      </div>

      {/* Live Eastern clock chip */}
      <div className="flex items-center gap-2 text-[10px] sm:text-[11px] font-bold text-[#69f0ae]">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        {now ? (
          <span className="tabular-nums">
            LIVE EASTERN — {ET_DATE.format(now).toUpperCase()} • {ET_TIME.format(now)}
          </span>
        ) : (
          <span className="animate-pulse">SYNCING EASTERN CLOCK…</span>
        )}
      </div>

      {/* Totals pill */}
      <div className="rounded-full border border-[#b45309] px-4 py-2 text-center text-[11px] sm:text-xs font-black tracking-widest text-[#f5a623] uppercase">
        {totals.total.toLocaleString()} records • GA {totals.ga.toLocaleString()} curated +{" "}
        {totals.synthetic.toLocaleString()} synthetic • batches of {BATCH_SIZE}
      </div>

      <div className="border-t border-[#b45309]/30" />

      {/* 56-tab jurisdiction grid — each territory gets a dedicated tab */}
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Jurisdictions">
        {JURISDICTIONS.map((j) => {
          const active = j.code === jurisdiction;
          return (
            <button
              key={j.code}
              role="tab"
              aria-selected={active}
              title={`${j.name} — ${j.quota.toLocaleString()} records`}
              onClick={() => selectJurisdiction(j.code)}
              className={`px-2 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all min-h-[28px] ${
                active
                  ? "bg-[#f5a623] text-[#0d0a06] shadow-[0_0_12px_rgba(245,166,35,0.6)]"
                  : j.code === "GA"
                    ? "text-[#f5a623] border border-[#b45309]/70 bg-[#f5a623]/10 hover:bg-[#f5a623]/20"
                    : j.type === "state"
                      ? "text-slate-200 hover:text-white hover:bg-white/10"
                      : "text-[#ffd54f]/80 hover:text-[#ffd54f] hover:bg-white/10"
              }`}
            >
              {j.code}
            </button>
          );
        })}
      </div>

      {/* Legend + honesty line */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-4 text-[10px] sm:text-[11px] text-[#f5a623]/80 font-bold">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-slate-200 inline-block" /> state
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-[#ffd54f] inline-block" />{" "}
            district / territory
          </span>
        </div>
        <p className="text-[11px] sm:text-xs text-[#69f0ae] font-bold leading-relaxed">
          GA carries the curated 1–1,000 corpus; all other jurisdictions are synthetic catalog
          records (unverified).
        </p>
      </div>

      {/* Realtime query controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex gap-1.5 shrink-0">
          {(["ALL", "CURATED", "SYNTHETIC"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black tracking-wider transition-all min-h-[32px] ${
                statusFilter === f
                  ? "bg-[#f5a623]/20 text-[#f5a623] border border-[#f5a623]"
                  : "text-slate-400 border border-transparent bg-white/5 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#b45309]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Realtime query — ${meta.name} P1 index…`}
            className="w-full rounded-lg bg-white/5 border border-[#b45309]/50 focus:border-[#f5a623] outline-none pl-9 pr-3 py-1.5 text-[11px] sm:text-xs text-slate-100 placeholder:text-slate-500 min-h-[32px]"
          />
        </div>
        {!isGA && (
          <select
            value={sector}
            onChange={(e) => setSector(e.target.value)}
            className="rounded-lg bg-white/5 border border-[#b45309]/50 focus:border-[#f5a623] outline-none px-2.5 py-1.5 text-[11px] sm:text-xs text-slate-100 min-h-[32px]"
          >
            <option value="ALL_SECTORS">ALL SECTORS</option>
            {SECTOR_NAMES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Batch pager */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setBatch((b) => Math.max(1, b - 1))}
          disabled={batch <= 1 || querying}
          className="p-1.5 rounded-lg border border-[#b45309]/50 text-[#f5a623] disabled:opacity-30 shrink-0"
          title="Previous batch"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 py-0.5">
          {querying ? (
            <span className="text-[11px] text-[#69f0ae] font-bold whitespace-nowrap px-1">
              QUERY RESULTS — {queryRows.length.toLocaleString()} MATCHES (FIRST 50 SHOWN)
            </span>
          ) : (
            Array.from({ length: batches }, (_, i) => i + 1).map((b) => (
              <button
                key={b}
                onClick={() => {
                  setBatch(b);
                  setExpandedId(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold whitespace-nowrap transition-all shrink-0 ${
                  b === batch
                    ? "bg-[#f5a623] text-[#0d0a06]"
                    : "text-[#f5a623]/70 hover:text-[#f5a623] hover:bg-white/5"
                }`}
              >
                {b}
              </button>
            ))
          )}
        </div>
        <button
          onClick={() => setBatch((b) => Math.min(batches, b + 1))}
          disabled={batch >= batches || querying}
          className="p-1.5 rounded-lg border border-[#b45309]/50 text-[#f5a623] disabled:opacity-30 shrink-0"
          title="Next batch"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Record cards */}
      <div className="space-y-2.5">
        {rows.length === 0 && (
          <p className="text-[11px] text-slate-400 font-bold px-1">
            No records match this filter in {meta.name}.
          </p>
        )}
        {rows.map((r) => {
          const expanded = expandedId === r.id;
          return (
            <div
              key={r.id}
              className="rounded-2xl border border-[#b45309]/60 bg-[#171006]/90 p-3 space-y-1.5"
            >
              <button
                onClick={() => setExpandedId(expanded ? null : r.id)}
                className="w-full text-left space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full border border-[#b45309] text-[#f5a623] text-[10px] sm:text-[11px] font-black">
                    {r.id} [P1 #{r.id.includes("-SYN-") ? r.id.split("-SYN-")[1].replace(/^0+/, "") || "0" : r.term.match(/Priority (\d+)/)?.[1] ?? ""}
                    ]
                  </span>
                  {r.curated ? (
                    <span className="px-2.5 py-0.5 rounded-md bg-[#00ff88]/15 text-[#69f0ae] border border-[#00ff88]/50 text-[10px] sm:text-[11px] font-black flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> CURATED
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-md bg-white/5 text-slate-300 border border-slate-500/60 text-[9px] sm:text-[10px] font-black">
                      SYNTHETIC — UNVERIFIED
                    </span>
                  )}
                </div>
                <div className="text-slate-100 font-bold text-[12px] sm:text-sm leading-snug truncate" title={r.term}>
                  {r.term}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[#f5a623]/90 font-bold">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{r.sub}</span>
                </div>
              </button>
              {expanded && (
                <RecordDetail id={r.id} curated={r.curated} jurisdiction={jurisdiction} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RecordDetail({
  id,
  curated,
  jurisdiction
}: {
  id: string;
  curated: boolean;
  jurisdiction: string;
}) {
  const detail = useMemo(() => {
    if (curated) {
      const a = STATEWIDE_ANOMALIES_1000.find((x) => x.id === id);
      if (!a) return null;
      return {
        kind: "curated" as const,
        definition: a.definition,
        implications: a.interstateImplications ?? "Georgia intrastate",
        validation: `${a.id}-VERIFIED`
      };
    }
    const m = id.match(/^[A-Z]{2}-SYN-(\d+)$/);
    if (!m) return null;
    const rec = generateSyntheticRecord(jurisdiction, parseInt(m[1], 10) - 1);
    return { kind: "synthetic" as const, rec };
  }, [id, curated, jurisdiction]);

  if (!detail) return null;
  if (detail.kind === "curated") {
    return (
      <div className="pt-2 mt-1 border-t border-[#b45309]/30 space-y-1.5 text-[11px] sm:text-xs leading-relaxed">
        <p className="text-slate-200">
          <span className="text-[#f5a623] font-black">DEFINITION: </span>
          {detail.definition.slice(0, 420)}
          {detail.definition.length > 420 ? "…" : ""}
        </p>
        <p className="text-slate-300">
          <span className="text-[#f5a623] font-black">INTERSTATE: </span>
          {detail.implications}
        </p>
        <p className="text-[#69f0ae] font-bold">{detail.validation} • Full dossier in GA panel below</p>
      </div>
    );
  }
  const r = detail.rec;
  return (
    <div className="pt-2 mt-1 border-t border-[#b45309]/30 space-y-1.5 text-[11px] sm:text-xs leading-relaxed">
      <p className="text-slate-200">{r.narrative}</p>
      <p className="text-slate-300">
        <span className="text-[#f5a623] font-black">VENUE PIN: </span>
        {r.venuePin.lat.toFixed(4)}, {r.venuePin.lng.toFixed(4)} (synthetic jitter)
      </p>
      <p className="text-slate-300">
        <span className="text-[#f5a623] font-black">FLAGS: </span>
        {r.forensicFlags.join(" • ")}
      </p>
      <p className="text-slate-400">{r.ledgerNote}</p>
      <p className="text-slate-300 font-bold">{r.validationCode}</p>
    </div>
  );
}

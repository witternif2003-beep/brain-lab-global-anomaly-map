"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Globe, MapPin, Search, ChevronLeft, ChevronRight, Clock, ShieldCheck } from "lucide-react";
import { STATEWIDE_ANOMALIES_1000 } from "../lib/statewide-anomalies";
import {
  JURISDICTIONS,
  BATCH_SIZE,
  batchCountFor,
  catalogTotals,
  jurisdictionByCode
} from "../lib/territory-catalog";
import { JURISDICTION_ADAPTERS } from "../lib/adapters/jurisdictions";
import { STATE_DATASETS, type StateDatasetConfig } from "../lib/adapters/state-datasets";

type StatusFilter = "ALL" | "CURATED";

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

const GROUPS = [
  { key: "state", label: "STATES" },
  { key: "district", label: "DISTRICT" },
  { key: "territory", label: "TERRITORIES" }
] as const;

export default function TerritoryCatalogPanel() {
  const [jurisdiction, setJurisdiction] = useState<string>("GA");
  const [batch, setBatch] = useState<number>(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [query, setQuery] = useState<string>("");
  const [probe, setProbe] = useState<{
    status: string;
    reachable: boolean;
    portal?: string;
    datasetsIndexed?: number | null;
    reason?: string;
    http?: number;
    checkedAt?: string;
  } | null>(null);
  const [probing, setProbing] = useState<boolean>(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [now, setNow] = useState<Date | null>(null);

  // Live Eastern clock — mounted-gated so SSR hydration never mismatches.
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Phase-2 ingest probe — live portal liveness per tab, never assumed.
  useEffect(() => {
    if (jurisdiction === "GA") {
      setProbe(null);
      return;
    }
    let cancelled = false;
    setProbing(true);
    setProbe(null);
    fetch(`/api/ingest/probe?code=${jurisdiction}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setProbe(d);
      })
      .catch(() => {
        if (!cancelled) setProbe({ status: "PROBE-REQUEST-FAILED", reachable: false });
      })
      .finally(() => {
        if (!cancelled) setProbing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [jurisdiction]);

  const totals = useMemo(() => catalogTotals(), []);
  const meta = jurisdictionByCode(jurisdiction);
  const isGA = jurisdiction === "GA";
  const batches = isGA ? 40 : batchCountFor(jurisdiction);

  // Phase 2: non-GA tabs serve records ONLY from mapped verified feeds (none yet).
  const adapter = JURISDICTION_ADAPTERS[jurisdiction];
  const stateFeeds = STATE_DATASETS[jurisdiction] ?? null;

  // Rows for the active tab + batch, before search/status filtering.
  const tabRows = useMemo<PanelRow[]>(() => {
    if (!isGA) return [];
    const start = (batch - 1) * BATCH_SIZE;
    return STATEWIDE_ANOMALIES_1000.slice(start, start + BATCH_SIZE).map((a) => ({
      id: a.id,
      term: a.term,
      sub: `Georgia • Interstate corridor • batch ${a.batchNumber}`,
      batch: a.batchNumber,
      curated: a.verified === true,
      sector: "CURATED CORPUS"
    }));
  }, [isGA, batch]);

  // Realtime query across the FULL GA corpus when searching. Non-GA tabs have no
  // mapped feed, so queries there honestly return zero matches.
  const querying = isGA && query.trim().length > 0;
  const queryRows = useMemo<PanelRow[]>(() => {
    if (!querying || !isGA) return [];
    const q = query.trim().toLowerCase();
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
  }, [querying, query, isGA]);

  const baseRows = querying ? queryRows.slice(0, 50) : tabRows;
  const rows = baseRows.filter((r) => (statusFilter === "ALL" ? true : r.curated));

  const selectJurisdiction = (code: string) => {
    setJurisdiction(code);
    setBatch(1);
    setExpandedId(null);
    setQuery("");
  };

  const batchStart = (batch - 1) * BATCH_SIZE + 1;
  const batchEnd = Math.min(batch * BATCH_SIZE, meta.quota);

  return (
    <div className="rounded-[28px] border-2 border-[#b45309] bg-[#0d0a06]/98 p-4 sm:p-6 space-y-4 shadow-[0_16px_60px_rgba(0,0,0,0.9),inset_0_1px_3px_rgba(217,119,6,0.25)] font-mono">
      {/* Classification strip — fictional UI theme for this demo console */}
      <div className="rounded-lg bg-[#f5a623]/10 border border-[#b45309]/50 px-3 py-1 text-center text-[8px] sm:text-[9px] font-bold tracking-[0.2em] text-[#f5a623] uppercase">
        NSA ADMIN LEVEL // LUCID-1 CATALOG // DEMO CONSOLE THEME
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 text-[#f5a623]">
        <Globe className="w-4 h-4 shrink-0" />
        <h3 className="text-xs sm:text-sm font-black tracking-widest uppercase leading-snug">
          All U.S. States &amp; Territories — {totals.jurisdictions} Jurisdictions
        </h3>
      </div>

      {/* LUCID-1 / AIP-20 chrome */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="px-2.5 py-0.5 rounded-full bg-[#002b1b]/90 text-[#69f0ae] border border-[#00ff88]/60 text-[9px] sm:text-[10px] font-bold tracking-wider flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88] animate-ping shrink-0" />
          LUCID-1 // ORACLE-SYNAPSE
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-[#1a0033]/80 text-[#e0aaff] border border-[#bd00ff]/60 text-[9px] sm:text-[10px] font-bold tracking-wider flex items-center gap-1.5">
          <ShieldCheck className="w-3 h-3 shrink-0" />
          AIP-20 HARDENING: ACTIVE
        </span>
        <span className="px-2.5 py-0.5 rounded-full bg-[#002b4d]/80 text-[#80deea] border border-[#00e5ff]/50 text-[9px] sm:text-[10px] font-bold tracking-wider">
          HONESTY PROTOCOL
        </span>
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
      <div className="rounded-2xl sm:rounded-full border border-[#b45309] px-4 py-2 text-center text-[10px] sm:text-xs font-black tracking-widest text-[#f5a623] uppercase leading-relaxed">
        {totals.total.toLocaleString()} records • GA {totals.ga.toLocaleString()} curated +{" "}
        {totals.sourced.toLocaleString()} sourced • {totals.awaiting} awaiting ingestion • batches
        of {BATCH_SIZE}
      </div>

      <FedTotalsLine />

      <div className="border-t border-[#b45309]/30" />

      {/* Grouped jurisdiction tabs — states / district / territories */}
      <div className="space-y-2.5" role="tablist" aria-label="Jurisdictions">
        {GROUPS.map((g) => {
          const codes = JURISDICTIONS.filter((j) => j.type === g.key);
          if (codes.length === 0) return null;
          return (
            <div key={g.key} className="space-y-1.5">
              <div className="text-[9px] sm:text-[10px] font-black tracking-[0.2em] text-[#b45309] uppercase">
                {g.label} ({codes.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {codes.map((j) => {
                  const active = j.code === jurisdiction;
                  return (
                    <button
                      key={j.code}
                      role="tab"
                      aria-selected={active}
                      title={`${j.name} — ${j.quota.toLocaleString()} records`}
                      onClick={() => selectJurisdiction(j.code)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] sm:text-xs font-bold transition-all min-h-[32px] min-w-[44px] ${
                        active
                          ? "bg-[#f5a623] text-[#0d0a06] shadow-[0_0_12px_rgba(245,166,35,0.6)]"
                          : j.code === "GA"
                            ? "text-[#f5a623] border border-[#b45309]/70 bg-[#f5a623]/10 hover:bg-[#f5a623]/20"
                            : j.type === "state"
                              ? "text-slate-200 border border-white/10 bg-white/5 hover:text-white hover:border-white/30"
                              : "text-[#ffd54f]/90 border border-[#ffd54f]/25 bg-[#ffd54f]/5 hover:border-[#ffd54f]/60"
                      }`}
                    >
                      {j.code}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend + honesty line */}
      <div className="space-y-1.5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] sm:text-[11px] text-[#f5a623]/80 font-bold">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-slate-200 inline-block" /> state
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border border-[#ffd54f] inline-block" />{" "}
            district / territory
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#f5a623] inline-block" /> selected tab
          </span>
        </div>
        <p className="text-[11px] sm:text-xs text-[#69f0ae] font-bold leading-relaxed">
          GA carries the curated 1–1,000 corpus. Territory tabs render live federal records
          (fetched per visit — sourced, not verified findings). All other jurisdictions serve
          records ONLY from mapped verified feeds — 0 records until a source is wired. No
          synthetic data.
        </p>
      </div>

      {/* Phase-2 source status — live probe per tab */}
      {!isGA && adapter && (
        <div className="rounded-xl border border-[#00e5ff]/40 bg-[#002b4d]/30 px-3 py-2 space-y-1 text-[10px] sm:text-[11px] font-bold">
          <div className="text-[#00e5ff] tracking-widest">
            SOURCE STATUS — {meta.name.toUpperCase()}: {stateFeeds ? "STATE FEEDS MAPPED — LIVE RECORDS BELOW" : "AWAITING REAL-TIME INGESTION"}
          </div>
          <div className="text-slate-300 break-all">PORTAL: {adapter.openDataPortal}</div>
          <div className="text-slate-300">
            {probing || !probe ? (
              <span className="animate-pulse">PROBING PORTAL…</span>
            ) : probe.reachable ? (
              <span className="text-[#69f0ae]">
                {probe.status} •{" "}
                {stateFeeds ? (
                  <>LIVE RECORDS BELOW</>
                ) : (
                  <>
                    {typeof probe.datasetsIndexed === "number"
                      ? `${probe.datasetsIndexed.toLocaleString()} ANOMALY-MATCHING DATASETS`
                      : "INDEX COUNT N/A"}{" "}
                    • FEED NOT MAPPED • 0 RECORDS SERVED
                  </>
                )}
              </span>
            ) : (
              <span className="text-[#ff80ab]">
                {probe.status}
                {probe.http ? ` (HTTP ${probe.http})` : ""}
                {probe.reason ? ` — ${probe.reason.slice(0, 120)}` : ""} • 0 RECORDS SERVED
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <a
              href={adapter.openDataPortal}
              target="_blank"
              rel="noreferrer"
              className="text-[#f5a623] underline underline-offset-2"
            >
              OPEN PORTAL ↗
            </a>
            <span className="text-slate-500">
              {probe?.checkedAt ? `CHECKED ${probe.checkedAt}` : "CHECK ON TAB SELECT"}
            </span>
          </div>
        </div>
      )}

      {!isGA && meta.type === "territory" && <FedFeedPanel code={jurisdiction} name={meta.name} />}
      {!isGA && meta.type === "territory" && <FedRecordCards code={jurisdiction} name={meta.name} />}
      {!isGA && stateFeeds && <StateRecordCards code={jurisdiction} name={meta.name} />}

      {/* Realtime query controls */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {(["ALL", "CURATED"] as StatusFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-[10px] sm:text-[11px] font-black tracking-wider transition-all min-h-[36px] ${
                statusFilter === f
                  ? "bg-[#f5a623]/20 text-[#f5a623] border border-[#f5a623]"
                  : "text-slate-400 border border-white/10 bg-white/5 hover:text-white"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[#b45309] pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={!isGA}
            placeholder={
              isGA
                ? `Realtime query — ${meta.name} P1 index…`
                : meta.type === "territory"
                  ? `Federal records render below — full text in VIEW JSON`
                  : stateFeeds
                    ? `State records render below — full text in VIEW JSON`
                    : `No feed mapped — query unavailable for ${meta.name}`
            }
            className="w-full rounded-lg bg-[#171006] border border-[#b45309]/60 focus:border-[#f5a623] outline-none pl-9 pr-3 py-2 text-[12px] sm:text-xs text-slate-100 placeholder:text-slate-500 min-h-[36px] [color-scheme:dark] disabled:opacity-40"
          />
        </div>
      </div>

      {/* Batch position readout + pager */}
      <div className="space-y-1.5">
        <div className="text-[10px] sm:text-[11px] text-[#69f0ae] font-bold tracking-wider px-0.5">
          {querying
            ? `QUERY RESULTS — ${queryRows.length.toLocaleString()} MATCHES (FIRST 50 SHOWN)`
            : isGA
              ? `BATCH ${batch} OF ${batches} • RECORDS ${batchStart.toLocaleString()}–${batchEnd.toLocaleString()} OF ${meta.quota.toLocaleString()} • ${meta.name.toUpperCase()}`
              : meta.type === "territory"
                ? `FEDERAL FEEDS MAPPED • ${meta.name.toUpperCase()} • LIVE RECORDS BELOW`
                : stateFeeds
                  ? `STATE FEEDS MAPPED • ${meta.name.toUpperCase()} • LIVE RECORDS BELOW`
                  : `NO BATCHES — FEED NOT MAPPED • ${meta.name.toUpperCase()} • 0 RECORDS`}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setBatch((b) => Math.max(1, b - 1))}
            disabled={batch <= 1 || querying}
            className="p-2 rounded-lg border border-[#b45309]/50 text-[#f5a623] disabled:opacity-30 shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="Previous batch"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-1 py-0.5">
            {!querying &&
              Array.from({ length: batches }, (_, i) => i + 1).map((b) => (
                <button
                  key={b}
                  onClick={() => {
                    setBatch(b);
                    setExpandedId(null);
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all shrink-0 min-h-[32px] min-w-[32px] ${
                    b === batch
                      ? "bg-[#f5a623] text-[#0d0a06]"
                      : "text-[#f5a623]/70 hover:text-[#f5a623] hover:bg-white/5 border border-transparent"
                  }`}
                >
                  {b}
                </button>
              ))}
          </div>
          <button
            onClick={() => setBatch((b) => Math.min(batches, b + 1))}
            disabled={batch >= batches || querying}
            className="p-2 rounded-lg border border-[#b45309]/50 text-[#f5a623] disabled:opacity-30 shrink-0 min-w-[36px] min-h-[36px] flex items-center justify-center"
            title="Next batch"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Record cards */}
      <div className="space-y-2.5">
        {rows.length === 0 && isGA && (
          <p className="text-[11px] text-slate-400 font-bold px-1">
            No records match this filter in {meta.name}.
          </p>
        )}
        {!isGA && meta.type !== "territory" && !stateFeeds && (
          <div className="rounded-2xl border border-dashed border-[#00e5ff]/50 bg-[#002b4d]/20 p-4 text-center space-y-1.5">
            <div className="text-[11px] sm:text-xs font-black tracking-[0.2em] text-[#00e5ff]">
              AWAITING REAL-TIME INGESTION
            </div>
            <p className="text-[11px] text-slate-300 font-bold leading-relaxed">
              No verified feed is mapped for {meta.name}, so this tab serves 0 records. Send a
              dataset URL or API endpoint to map this jurisdiction — records appear with
              provenance links, never as synthetic filler.
            </p>
          </div>
        )}
        {rows.map((r) => {
          const expanded = expandedId === r.id;
          const p1num = r.term.match(/Priority (\d+)/)?.[1] ?? "";
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
                  <span className="px-2.5 py-0.5 rounded-full border border-[#b45309] text-[#f5a623] text-[10px] sm:text-[11px] font-black whitespace-nowrap">
                    {r.id} [P1 #{p1num}]
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    <span className="px-2 py-0.5 rounded-md bg-[#ff1744]/15 text-[#ff80ab] border border-[#ff1744]/50 text-[9px] sm:text-[10px] font-black">
                      P1
                    </span>
                    {r.curated ? (
                      <span className="px-2.5 py-0.5 rounded-md bg-[#00ff88]/15 text-[#69f0ae] border border-[#00ff88]/50 text-[10px] sm:text-[11px] font-black flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" /> CURATED
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-md bg-white/5 text-slate-300 border border-slate-500/60 text-[9px] sm:text-[10px] font-black">
                        PENDING SOURCE
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-slate-100 font-bold text-[12px] sm:text-sm leading-snug break-words" title={r.term}>
                  {r.term}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-[#f5a623]/90 font-bold">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{r.sub}</span>
                </div>
              </button>
              {expanded && <RecordDetail id={r.id} curated={r.curated} />}
            </div>
          );
        })}
      </div>

      {/* Footer strip */}
      <div className="rounded-lg bg-[#f5a623]/5 border border-[#b45309]/30 px-3 py-1 text-center text-[8px] sm:text-[9px] font-bold tracking-[0.2em] text-[#f5a623]/70 uppercase">
        ORACLE-SYNAPSE // AIP-20 HARDENED // NO SYNTHETIC DATA — SOURCED RECORDS ONLY
      </div>
    </div>
  );
}

/* Federal sourced-data panel — territory tabs only. Renders live fetch counts
   from /api/ingest/territories/probe with raw-JSON view links. "Fetched" means
   a live API returned rows in this run — not a verified finding. */
function FedFeedPanel({ code, name }: { code: string; name: string }) {
  interface SourceResult {
    ok: boolean;
    count?: number;
    note?: string;
    error?: string;
  }
  interface ProbePayload {
    results?: Array<{ results?: Record<string, SourceResult | Record<string, SourceResult>> }>;
    elapsed_ms?: number;
  }
  const [payload, setPayload] = useState<ProbePayload | null>(null);
  const [failed, setFailed] = useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    setPayload(null);
    setFailed(false);
    fetch("/api/ingest/territories/probe?only=" + code + "&wb=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setPayload(d as ProbePayload);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);
  const tabResults = payload?.results?.[0]?.results;
  const entries: Array<[string, SourceResult | Record<string, SourceResult>]> = tabResults
    ? Object.entries(tabResults)
    : [];
  const viewUrl = (source: string, indicator?: string) =>
    "/api/ingest/territories/records?code=" + code + "&source=" + source + (indicator ? "&indicator=" + indicator : "");
  return (
    <div className="rounded-xl border border-[#69f0ae]/40 bg-[#002b1b]/30 px-3 py-2 space-y-1.5 text-[10px] sm:text-[11px] font-bold">
      <div className="text-[#69f0ae] tracking-widest">
        FEDERAL SOURCED DATA — {name.toUpperCase()} (FETCHED LIVE, NOT VERIFIED FINDINGS)
      </div>
      {!payload && !failed && (
        <span className="animate-pulse text-slate-300">PROBING FEDERAL FEEDS…</span>
      )}
      {failed && (
        <span className="text-[#ff80ab]">FEDERAL PROBE FAILED — RETRY BY RESELECTING TAB</span>
      )}
      {entries.map(([src, val]) => {
        if (src === "WORLDBANK" && typeof val === "object" && !("ok" in (val as object))) {
          const sub = Object.entries(val as Record<string, SourceResult>);
          return (
            <div key={src} className="space-y-1">
              <div className="text-slate-400">WORLDBANK:</div>
              {sub.map(([ind, r]) => (
                <div key={ind} className="flex flex-wrap items-center gap-x-2 pl-2 text-slate-300">
                  <span className="break-all">{ind}</span>
                  {r.ok ? (
                    <span className="text-[#69f0ae]">{r.count ?? 0} OBS</span>
                  ) : (
                    <span className="text-[#ff80ab]">ERROR</span>
                  )}
                  <a
                    href={viewUrl("WORLDBANK", ind)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#f5a623] underline underline-offset-2"
                  >
                    VIEW JSON
                  </a>
                </div>
              ))}
            </div>
          );
        }
        const r = val as SourceResult;
        return (
          <div key={src} className="flex flex-wrap items-center gap-x-2 text-slate-300">
            <span>{src}:</span>
            {r.ok ? (
              <span className="text-[#69f0ae]">{r.note ?? `${r.count ?? 0} RECORDS`}</span>
            ) : (
              <span className="text-[#ff80ab] break-all">{r.error ?? "ERROR"}</span>
            )}
            {r.ok && (
              <a
                href={viewUrl(src)}
                target="_blank"
                rel="noreferrer"
                className="text-[#f5a623] underline underline-offset-2"
              >
                VIEW JSON
              </a>
            )}
          </div>
        );
      })}
      {payload && (
        <div className="text-slate-500">
          PROBED IN {typeof payload.elapsed_ms === "number" ? `${payload.elapsed_ms}MS` : "—"} •
          EVERY RECORD CARRIES source_url + retrieved_at + sha256
        </div>
      )}
    </div>
  );
}

/* Live federal-record count across all 5 territories — fetched once per mount
   from /api/ingest/territories/probe. Sums BLS observations + EPA summaries +
   EDGAR registrants + World Bank observations. Fails silent (no line) if the
   probe is unreachable — never a guessed number. */
function FedTotalsLine() {
  const [total, setTotal] = useState<number | null>(null);
  const [failed, setFailed] = useState<boolean>(false);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/ingest/territories/probe?wb=1", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        let n = 0;
        const raw = (d as { results?: unknown }).results;
        const results: Array<{ results?: Record<string, unknown> }> = Array.isArray(raw)
          ? (raw as Array<{ results?: Record<string, unknown> }>)
          : [];
        for (const t of results) {
          const r = t.results ?? {};
          for (const [k, v] of Object.entries(r)) {
            if (k === "WORLDBANK" && v !== null && typeof v === "object" && !("ok" in v)) {
              for (const sub of Object.values(v as Record<string, { count?: unknown }>)) {
                if (typeof sub?.count === "number") n += sub.count;
              }
            } else if (v !== null && typeof v === "object" && "count" in v) {
              const c = (v as { count?: unknown }).count;
              if (typeof c === "number") n += c;
            }
          }
        }
        setTotal(n);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);
  if (failed) return null;
  if (total === null) {
    return (
      <div className="text-center text-[10px] sm:text-[11px] font-bold text-slate-500 animate-pulse">
        COUNTING LIVE FEDERAL RECORDS…
      </div>
    );
  }
  return (
    <div className="rounded-2xl sm:rounded-full border border-[#69f0ae]/50 px-4 py-1.5 text-center text-[10px] sm:text-[11px] font-black tracking-widest text-[#69f0ae] uppercase">
      Federal live: {total.toLocaleString()} records • 5 territories (BLS + EPA + EDGAR + WB)
    </div>
  );
}

const WB_LABELS: Record<string, string> = {
  "NY.GDP.MKTP.CD": "GDP (CURRENT US$)",
  "SP.POP.TOTL": "POPULATION, TOTAL",
  "SL.UEM.TOTL.ZS": "UNEMPLOYMENT (% OF LABOR FORCE)"
};

function fedSources(code: string): Array<{ key: string; label: string; url: string; cap: number }> {
  const base = "/api/ingest/territories/records?code=" + code;
  return [
    { key: "BLS-LAUS", label: "BLS LAUS — UNEMPLOYMENT RATE", url: base + "&source=BLS-LAUS", cap: 12 },
    { key: "EPA-ECHO", label: "EPA ECHO — COMPLIANCE SUMMARY", url: base + "&source=EPA-ECHO", cap: 4 },
    { key: "SEC-EDGAR", label: "SEC EDGAR — REGISTRANTS BY STATE", url: base + "&source=SEC-EDGAR", cap: 12 },
    { key: "WB-GDP", label: "WORLD BANK — " + (WB_LABELS["NY.GDP.MKTP.CD"] ?? "GDP"), url: base + "&source=WORLDBANK&indicator=NY.GDP.MKTP.CD", cap: 8 },
    { key: "WB-POP", label: "WORLD BANK — " + (WB_LABELS["SP.POP.TOTL"] ?? "POPULATION"), url: base + "&source=WORLDBANK&indicator=SP.POP.TOTL", cap: 8 },
    { key: "WB-UNE", label: "WORLD BANK — " + (WB_LABELS["SL.UEM.TOTL.ZS"] ?? "UNEMPLOYMENT"), url: base + "&source=WORLDBANK&indicator=SL.UEM.TOTL.ZS", cap: 8 }
  ];
}

/* Territory record cards — same output shape as the GA corpus cards, but every
   row is fetched live from a federal API in this visit. Caps keep tabs fast;
   VIEW FULL JSON links expose the complete payload with provenance. */
function FedRecordCards({ code, name }: { code: string; name: string }) {
  interface Prov {
    source_id: string;
    source_url: string;
    retrieved_at: string;
    sha256: string;
    http_status: number;
  }
  interface RecPayload {
    records?: Array<Record<string, any>>;
    provenance?: Prov | null;
    note?: string;
    error?: string;
  }
  const [data, setData] = useState<Record<string, RecPayload> | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    const sources = fedSources(code);
    Promise.all(
      sources.map((s) =>
        fetch(s.url, { cache: "no-store" })
          .then((r) => r.json())
          .then((d) => ({ key: s.key, payload: d as RecPayload }))
          .catch(() => ({ key: s.key, payload: { error: "fetch failed" } as RecPayload }))
      )
    ).then((pairs) => {
      if (cancelled) return;
      const out: Record<string, RecPayload> = {};
      for (const p of pairs) out[p.key] = p.payload;
      setData(out);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);
  const sources = fedSources(code);
  if (!data) {
    return (
      <div className="rounded-xl border border-[#69f0ae]/30 bg-[#002b1b]/20 px-3 py-2 text-[10px] sm:text-[11px] font-bold text-slate-300 animate-pulse">
        FETCHING FEDERAL RECORDS FOR {name.toUpperCase()}…
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {sources.map((s) => {
        const p = data[s.key] ?? {};
        const recs = Array.isArray(p.records) ? p.records : [];
        const prov = p.provenance ?? null;
        return (
          <div key={s.key} className="rounded-2xl border border-[#69f0ae]/40 bg-[#002b1b]/20 p-3 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-[11px] font-black">
              <span className="text-[#69f0ae] tracking-widest">{s.label}</span>
              <span className="text-slate-400">
                {recs.length > 0
                  ? `${recs.length} FETCHED • SHOWING ${Math.min(s.cap, recs.length)}`
                  : (p.note ?? p.error ?? "0 RECORDS")}
              </span>
              <a href={s.url} target="_blank" rel="noreferrer" className="text-[#f5a623] underline underline-offset-2">
                VIEW FULL JSON ↗
              </a>
            </div>
            {recs.length === 0 && p.note && (
              <p className="text-[11px] text-slate-400 font-bold">{p.note}</p>
            )}
            {recs.slice(0, s.cap).map((r, i) => (
              <FedCard key={s.key + "-" + i} source={s.key} r={r} />
            ))}
            {prov && (
              <div className="text-[9px] sm:text-[10px] text-slate-500 font-bold break-all">
                FETCHED {prov.retrieved_at} • HTTP {prov.http_status} • sha256 {prov.sha256.slice(0, 16)}… •{" "}
                <a href={prov.source_url} target="_blank" rel="noreferrer" className="text-[#f5a623] underline underline-offset-2">
                  SOURCE ↗
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FedCard({ source, r }: { source: string; r: Record<string, any> }) {
  const [open, setOpen] = useState(false);
  let title = "";
  let sub = "";
  let link: string | null = null;
  if (source === "BLS-LAUS") {
    title = `${String(r.period_name ?? "")} ${String(r.year ?? "")} — UNEMPLOYMENT ${String(r.value ?? "?")}%`;
    sub = String(r.series_id ?? "");
  } else if (source === "EPA-ECHO") {
    const n = Number(r.active_facilities ?? 0).toLocaleString();
    title = `${n} ACTIVE FACILITIES — ${String(r.territory ?? "")}`;
    sub = `CAA ${String(r.caa_rows ?? 0)} • CWA ${String(r.cwa_rows ?? 0)} • RCRA ${String(r.rcra_rows ?? 0)} • TRI ${String(r.tri_rows ?? 0)} • INSPECTIONS ${String(r.inspections ?? 0)} • PENALTIES ${String(r.total_penalties ?? "—")}`;
  } else if (source === "SEC-EDGAR") {
    title = `CIK ${String(r.cik ?? "?")} • ${String(r.state ?? "")}`;
    sub = `UPDATED ${String(r.updated ?? "?")} — COMPANY NAMES NOT SUPPLIED BY SEC`;
    link = typeof r.edgar_url === "string" && r.edgar_url.length > 0 ? r.edgar_url : null;
  } else {
    const v: unknown = r.value;
    title = `${String(r.year ?? "")} — ${String(r.indicator_name ?? r.indicator_id ?? "")}`;
    sub = `${typeof v === "number" ? v.toLocaleString() : "N/A"} • ${String(r.indicator_id ?? "")}`;
  }
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-1.5 space-y-0.5">
      <button onClick={() => setOpen(!open)} className="w-full text-left space-y-0.5">
        <div className="text-slate-100 font-bold text-[11px] sm:text-xs leading-snug break-words">{title}</div>
        <div className="text-[10px] sm:text-[11px] text-[#f5a623]/90 font-bold break-words">{sub}</div>
      </button>
      {open && (
        <div className="pt-1 mt-1 border-t border-white/10 space-y-0.5">
          {Object.entries(r).slice(0, 24).map(([k, v]) => (
            <div key={k} className="text-[10px] text-slate-300 font-bold break-words">
              <span className="text-[#f5a623]">{String(k).toUpperCase()}: </span>
              {v === null || v === undefined || v === ""
                ? "—"
                : String(typeof v === "object" ? JSON.stringify(v) : v).slice(0, 160)}
            </div>
          ))}
          <div className="text-[9px] text-slate-500 font-bold">TAP CARD TO COLLAPSE • FULL PAYLOAD IN VIEW FULL JSON</div>
        </div>
      )}
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="text-[10px] sm:text-[11px] text-[#f5a623] underline underline-offset-2 font-bold">
          FILING INDEX ↗
        </a>
      )}
    </div>
  );
}

/* State record cards — same output shape as the territory federal cards, but
   rows come from mapped state open-data datasets (STATE_DATASETS registry)
   via /api/ingest/states/records. Fetched live per tab visit; every section
   carries provenance with source_url + retrieved_at + sha256. */
function StateRecordCards({ code, name }: { code: string; name: string }) {
  interface Prov {
    source_id: string;
    source_url: string;
    retrieved_at: string;
    sha256: string;
    http_status: number;
  }
  interface RecPayload {
    records?: Array<Record<string, any>>;
    provenance?: Prov | null;
    note?: string;
    total_count?: number | null;
    error?: string;
  }
  const cfgs = STATE_DATASETS[code] ?? [];
  const [data, setData] = useState<Record<string, RecPayload> | null>(null);
  useEffect(() => {
    let cancelled = false;
    setData(null);
    Promise.all(
      cfgs.map((c) =>
        fetch(`/api/ingest/states/records?code=${code}&source=${c.source_id}&rows=${c.cap}`, {
          cache: "no-store"
        })
          .then((r) => r.json())
          .then((d) => ({ key: c.source_id, payload: d as RecPayload }))
          .catch(() => ({ key: c.source_id, payload: { error: "fetch failed" } as RecPayload }))
      )
    ).then((pairs) => {
      if (cancelled) return;
      const out: Record<string, RecPayload> = {};
      for (const p of pairs) out[p.key] = p.payload;
      setData(out);
    });
    return () => {
      cancelled = true;
    };
  }, [code]);
  if (!data) {
    return (
      <div className="rounded-xl border border-[#69f0ae]/30 bg-[#002b1b]/20 px-3 py-2 text-[10px] sm:text-[11px] font-bold text-slate-300 animate-pulse">
        FETCHING STATE RECORDS FOR {name.toUpperCase()}…
      </div>
    );
  }
  return (
    <div className="space-y-2.5">
      {cfgs.map((c) => {
        const p = data[c.source_id] ?? {};
        const recs = Array.isArray(p.records) ? p.records : [];
        const prov = p.provenance ?? null;
        const url = `/api/ingest/states/records?code=${code}&source=${c.source_id}&rows=${c.cap}`;
        return (
          <div key={c.source_id} className="rounded-2xl border border-[#69f0ae]/40 bg-[#002b1b]/20 p-3 space-y-1.5">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-[11px] font-black">
              <span className="text-[#69f0ae] tracking-widest">{c.label}</span>
              <span className="text-slate-400">{p.note ?? p.error ?? "0 RECORDS"}</span>
              <a href={url} target="_blank" rel="noreferrer" className="text-[#f5a623] underline underline-offset-2">
                VIEW FULL JSON ↗
              </a>
            </div>
            {recs.length === 0 && p.note && (
              <p className="text-[11px] text-slate-400 font-bold">{p.note}</p>
            )}
            {recs.slice(0, c.cap).map((r, i) => (
              <StateCard key={c.source_id + "-" + i} r={r} cfg={c} />
            ))}
            {prov && (
              <div className="text-[9px] sm:text-[10px] text-slate-500 font-bold break-all">
                FETCHED {prov.retrieved_at} • HTTP {prov.http_status} • sha256 {prov.sha256.slice(0, 16)}… •{" "}
                <a href={prov.source_url} target="_blank" rel="noreferrer" className="text-[#f5a623] underline underline-offset-2">
                  SOURCE ↗
                </a>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function renderCardTemplate(t: string, r: Record<string, any>): string {
  return t.replace(/\{([A-Za-z0-9_ ]+?)(?::(money|date))?\}/g, (_m: string, f: string, mod: string) => {
    const v: unknown = r[f];
    if (v === null || v === undefined || v === "") return "?";
    if (mod === "money") {
      const n = Number(v);
      return Number.isFinite(n)
        ? "$" + n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : "?";
    }
    if (mod === "date") return String(v).slice(0, 10);
    return String(v);
  });
}

function StateCard({ r, cfg }: { r: Record<string, any>; cfg: StateDatasetConfig }) {
  const [open, setOpen] = useState(false);
  const title = renderCardTemplate(cfg.card.title, r);
  const sub = renderCardTemplate(cfg.card.sub, r);
  let link: string | null = null;
  if (cfg.card.link_field) {
    const u: unknown = r[cfg.card.link_field];
    if (typeof u === "string" && u.length > 0) link = u;
    else if (typeof u === "object" && u !== null && typeof (u as { url?: unknown }).url === "string")
      link = String((u as { url: unknown }).url);
  }
  return (
    <div className="rounded-xl border border-white/10 bg-black/30 px-2.5 py-1.5 space-y-0.5">
      <button onClick={() => setOpen(!open)} className="w-full text-left space-y-0.5">
        <div className="text-slate-100 font-bold text-[11px] sm:text-xs leading-snug break-words">{title}</div>
        <div className="text-[10px] sm:text-[11px] text-[#f5a623]/90 font-bold break-words">{sub}</div>
      </button>
      {open && (
        <div className="pt-1 mt-1 border-t border-white/10 space-y-0.5">
          {Object.entries(r).slice(0, 24).map(([k, v]) => (
            <div key={k} className="text-[10px] text-slate-300 font-bold break-words">
              <span className="text-[#f5a623]">{String(k).toUpperCase()}: </span>
              {v === null || v === undefined || v === ""
                ? "—"
                : String(typeof v === "object" ? JSON.stringify(v) : v).slice(0, 160)}
            </div>
          ))}
          <div className="text-[9px] text-slate-500 font-bold">TAP CARD TO COLLAPSE • FULL PAYLOAD IN VIEW FULL JSON</div>
        </div>
      )}
      {link && (
        <a href={link} target="_blank" rel="noreferrer" className="text-[10px] sm:text-[11px] text-[#f5a623] underline underline-offset-2 font-bold">
          {cfg.card.link_label ?? "RECORD ↗"}
        </a>
      )}
    </div>
  );
}

function RecordDetail({ id, curated }: { id: string; curated: boolean }) {
  const detail = useMemo(() => {
    if (!curated) return null;
    const a = STATEWIDE_ANOMALIES_1000.find((x) => x.id === id);
    if (!a) return null;
    return {
      definition: a.definition,
      implications: a.interstateImplications ?? "Georgia intrastate",
      validation: `${a.id}-VERIFIED`
    };
  }, [id, curated]);

  if (!detail) return null;
  return (
    <div className="pt-2 mt-1 border-t border-[#b45309]/30 space-y-1.5 text-[11px] sm:text-xs leading-relaxed">
      <p className="text-slate-200 break-words">
        <span className="text-[#f5a623] font-black">DEFINITION: </span>
        {detail.definition.slice(0, 420)}
        {detail.definition.length > 420 ? "…" : ""}
      </p>
      <p className="text-slate-300 break-words">
        <span className="text-[#f5a623] font-black">INTERSTATE: </span>
        {detail.implications}
      </p>
      <p className="text-[#69f0ae] font-bold">{detail.validation} • Full dossier in GA panel below</p>
    </div>
  );
}

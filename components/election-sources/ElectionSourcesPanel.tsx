"use client";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, ShieldCheck } from "lucide-react";
import type { OfficeRow, OpsReport } from "../../lib/elections/ops";
import type { ReliabilityBand } from "../../lib/elections/source-reliability";

const BAND_STYLE: Record<ReliabilityBand, string> = {
  healthy: "text-[#69f0ae] border-[#00ff88]/70 bg-[#002b1b]/80 shadow-[0_0_10px_rgba(0,255,136,0.35)]",
  degraded: "text-[#ffd54f] border-[#ffaa00]/60 bg-[#331e00]/70 shadow-[0_0_10px_rgba(255,170,0,0.25)]",
  failing: "text-[#ff80ab] border-[#ff1744]/70 bg-[#3d0014]/80 shadow-[0_0_10px_rgba(255,23,68,0.35)]",
  unknown: "text-[#80deea] border-[#00e5ff]/40 bg-[#061836]/70"
};

const VERDICT_STYLE: Record<OfficeRow["verification"]["verdict"], string> = {
  verified: "text-[#69f0ae] border-[#00ff88]/60 bg-[#002b1b]/60",
  "not-found": "text-[#ff80ab] border-[#ff1744]/60 bg-[#3d0014]/60",
  unverifiable: "text-[#80deea] border-[#00e5ff]/40 bg-[#061836]/60"
};

type Filter = "all" | ReliabilityBand | "changed";

function Pill({ className, children, title }: { className: string; children: React.ReactNode; title?: string }) {
  return (
    <span title={title} className={`px-2.5 py-0.5 rounded-full border text-[10px] font-bold uppercase tracking-wider backdrop-blur-md ${className}`}>
      {children}
    </span>
  );
}

function Row({ r }: { r: OfficeRow }) {
  const [open, setOpen] = useState(false);
  const p = r.probe;
  return (
    <li className="list-none min-w-0 rounded-[28px] bg-gradient-to-br from-[#06152d]/70 via-[#030e20]/60 to-[#010712]/70 backdrop-blur-2xl border-2 border-[#00e5ff]/40 p-4 space-y-2 shadow-[0_8px_40px_rgba(0,229,255,0.15),inset_0_1px_3px_rgba(0,229,255,0.3)] hover:border-[#00e5ff]/80 hover:shadow-[0_8px_50px_rgba(0,229,255,0.3)] transition-all duration-300">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="shrink-0 min-w-[2.75rem] text-center px-2.5 py-0.5 rounded-full border-2 border-[#00e5ff]/70 bg-[#061836]/70 text-[#00e5ff] text-[11px] font-bold shadow-[0_0_10px_rgba(0,229,255,0.35)]">{r.code}</span>
          <span className="min-w-0 truncate text-sm sm:text-base font-extrabold tracking-wide text-[#e0f7fa] [text-shadow:0_0_12px_rgba(0,229,255,0.55)]">{r.name}</span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill className={BAND_STYLE[r.reliability.band]} title={r.reliability.reason}>
            {r.reliability.band}
          </Pill>
          <Pill className={VERDICT_STYLE[r.verification.verdict]} title={r.verification.reason ?? r.verification.matchContext}>
            {r.verification.verdict === "verified" ? "names jurisdiction" : r.verification.verdict}
          </Pill>
          {r.changeCount > 0 && <Pill className="text-[#e0aaff] border-[#bd00ff]/70 bg-[#1b0833]/70 shadow-[0_0_12px_rgba(189,0,255,0.35)]">changed ×{r.changeCount}</Pill>}
        </div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-1 text-[11px] text-[#80deea] rounded-2xl bg-[#020b18]/50 border border-[#00e5ff]/20 px-3 py-2 backdrop-blur-md">
        <span>Status: <b className="text-white">{p ? p.status : "—"}</b></span>
        <span>HTTP: <b className="text-white">{p?.httpStatus ?? "—"}</b></span>
        <span>Latency: <b className="text-white">{p ? `${p.latencyMs} ms` : "—"}</b></span>
        <span>Uptime: <b className="text-white">{r.reliability.uptime === null ? "—" : `${Math.round(r.reliability.uptime * 100)}% of ${r.reliability.samples}`}</b></span>
        <span title={p?.fingerprint}>SHA-256: <b className="text-white">{p?.fingerprint ? p.fingerprint.slice(0, 12) : "—"}</b></span>
      </div>
      {p?.error && <div className="text-[11px] text-[#ff80ab] break-all">{p.error}</div>}
      {p?.finalUrl && p.finalUrl !== r.url && <div className="text-[11px] text-[#ffd54f] break-all">Redirected to {p.finalUrl}</div>}
      {r.verification.matchContext && <div className="text-[11px] text-[#80deea] italic break-words">“…{r.verification.matchContext}…”</div>}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={r.url}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 px-3 py-0.5 rounded-full border border-[#00ff88]/70 bg-[#002b1b]/80 text-[#69f0ae] text-[10px] font-bold uppercase break-all shadow-[0_0_10px_rgba(0,255,136,0.3)]"
        >
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" /> {r.url.replace(/^https?:\/\//, "")} <ExternalLink className="w-3 h-3 shrink-0" />
        </a>
        {r.lastChange && (
          <button onClick={() => setOpen((o) => !o)} className="px-3 py-0.5 rounded-full border border-[#bd00ff]/70 bg-[#1b0833]/70 text-[#e0aaff] text-[10px] font-bold uppercase">
            {open ? "Hide" : "Show"} last change ({r.lastChange.diff.addedCount}+ / {r.lastChange.diff.removedCount}−)
          </button>
        )}
      </div>
      {open && r.lastChange && (
        <div className="rounded-2xl border border-[#bd00ff]/50 bg-[#1b0833]/50 backdrop-blur-md p-3 text-[11px] space-y-1 max-h-72 overflow-auto shadow-[0_0_14px_rgba(189,0,255,0.2)]">
          <div className="text-[#e0aaff]">
            {r.lastChange.capturedAt} · {r.lastChange.fromFingerprint.slice(0, 10)} → {r.lastChange.toFingerprint.slice(0, 10)} · {r.lastChange.diff.algorithm} diff
            {r.lastChange.diff.truncated ? " (truncated)" : ""}
          </div>
          {r.lastChange.diff.removed.map((l, i) => (
            <div key={`r${i}`} className="text-[#ff80ab] break-words">− {l}</div>
          ))}
          {r.lastChange.diff.added.map((l, i) => (
            <div key={`a${i}`} className="text-[#69f0ae] break-words">+ {l}</div>
          ))}
        </div>
      )}
    </li>
  );
}

export default function ElectionSourcesPanel() {
  const [report, setReport] = useState<OpsReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback((probe: boolean) => {
    setLoading(true);
    setError(null);
    fetch(`/api/elections/ops${probe ? "?probe=1" : ""}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: OpsReport | { error: string }) => {
        if ("error" in d) setError(d.error);
        else setReport(d);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(false);
  }, [load]);

  const rows = useMemo(() => {
    const all = report?.rows ?? [];
    if (filter === "all") return all;
    if (filter === "changed") return all.filter((r) => r.changeCount > 0);
    return all.filter((r) => r.reliability.band === filter);
  }, [report, filter]);

  const c = report?.counts;
  const filters: Array<[Filter, string, number | undefined]> = [
    ["all", "All", c?.offices],
    ["healthy", "Healthy", c?.healthy],
    ["degraded", "Degraded", c?.degraded],
    ["failing", "Failing", c?.failing],
    ["unknown", "Unknown", c?.unknown],
    ["changed", "Changed", c?.changed]
  ];

  return (
    <div className="space-y-4 font-mono">
      <div className="flex flex-wrap items-center gap-2">
        {filters.map(([f, label, n]) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full border-2 text-[11px] font-bold uppercase tracking-wider backdrop-blur-md ${
              filter === f ? "border-[#00e5ff] bg-[#00e5ff]/20 text-white shadow-[0_0_16px_rgba(0,229,255,0.45)]" : "border-[#00e5ff]/40 bg-[#030c1c]/70 text-[#80deea] hover:border-[#00e5ff]/80"
            }`}
          >
            {label} {n ?? "…"}
          </button>
        ))}
        <button
          onClick={() => load(true)}
          disabled={loading}
          className="ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-full border-2 border-[#69f0ae]/70 bg-[#002b1b]/70 text-[#69f0ae] text-[11px] font-bold uppercase tracking-wider shadow-[0_0_16px_rgba(0,255,136,0.35)] disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Re-probe
        </button>
      </div>

      {report && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
          <div className="rounded-[28px] bg-gradient-to-br from-[#06152d]/70 via-[#030e20]/60 to-[#010712]/70 border-2 border-[#00e5ff]/40 backdrop-blur-2xl p-4 space-y-1 text-[#b2ebf2] shadow-[0_8px_40px_rgba(0,229,255,0.15),inset_0_1px_3px_rgba(0,229,255,0.3)]">
            <div className="font-bold uppercase tracking-wider text-[#00e5ff]">Last probe run</div>
            {report.lastRun ? (
              <>
                <div>{report.lastRun.finishedAt} · {(report.lastRun.durationMs / 1000).toFixed(1)} s · {report.lastRun.total} sites</div>
                <div>
                  ok {report.lastRun.summary.ok} · blocked {report.lastRun.summary.blocked} · http {report.lastRun.summary.httpError} · dns {report.lastRun.summary.dnsError} · tls {report.lastRun.summary.tlsError} · timeout {report.lastRun.summary.timeout} · changed {report.lastRun.summary.changed}
                </div>
              </>
            ) : (
              <div>No run yet on this server instance.</div>
            )}
            <div>
              Page names its jurisdiction: {report.counts.verified} · not found {report.counts.notFound} · unverifiable {report.counts.unverifiable}
            </div>
            <div className="text-[#80deea]/80">History store: {report.store} (per server instance; the daily CI run keeps a persistent history).</div>
          </div>
          <div className="rounded-[28px] border-2 border-[#ffaa00]/50 bg-[#140d02]/70 backdrop-blur-2xl p-4 space-y-1 text-[#ffe0b2] shadow-[0_8px_40px_rgba(255,170,0,0.12),inset_0_1px_3px_rgba(255,170,0,0.25)]">
            <div className="font-bold uppercase tracking-wider text-[#ffaa00]">Roster drift vs USA.gov directory</div>
            <a href={report.directory.url} target="_blank" rel="noreferrer" className="underline break-all">{report.directory.url}</a>
            <div>Pinned {report.directory.pinnedAt} from {report.directory.publisher}</div>
            {report.drift ? (
              report.drift.status === "ok" ? (
                <>
                  <div>
                    Live directory: {report.drift.entryCount} entries · changed {report.drift.changed.length} · missing {report.drift.missing.length} · outside the 56: {report.drift.outOfScope.map((e) => e.code).join(", ") || "none"}
                  </div>
                  {report.drift.changed.map((d) => (
                    <div key={d.code} className="text-[#ff80ab] break-all">{d.code}: {d.pinned} → {d.live}</div>
                  ))}
                  {report.drift.missing.length > 0 && <div className="text-[#ff80ab]">No longer listed: {report.drift.missing.join(", ")}</div>}
                </>
              ) : (
                <div className="text-[#ff80ab]">Directory check failed: {report.drift.error}</div>
              )
            ) : (
              <div>Not checked yet.</div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading && !report && <div className="px-4 py-6 text-xs text-[#80deea]">Probing 56 official election-office sites…</div>}
        {loading && report && <div className="px-4 pt-3 text-xs text-[#80deea]">Re-probing…</div>}
        {error && <div className="px-4 py-6 text-xs text-[#ff80ab]">Ops request failed: {error}</div>}
        {report && rows.length === 0 && <div className="px-4 py-6 text-xs text-[#80deea]">No offices in this filter.</div>}
        <ul className="list-none p-0 m-0 grid grid-cols-1 lg:grid-cols-2 gap-3">
          {rows.map((r) => (
            <Row key={r.code} r={r} />
          ))}
        </ul>
      </div>
    </div>
  );
}

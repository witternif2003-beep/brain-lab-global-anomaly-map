"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Database,
  Download,
  Eye,
  Filter,
  Gauge,
  KeyRound,
  Lock,
  RefreshCw,
  Search,
  Server,
  Shield,
  Terminal,
  X,
} from "lucide-react";
import type {
  AuthMethod,
  EntityMeta,
  GovEntityType,
  HealthSummary,
  ProbeStatus,
  TelemetryPacket,
} from "@/lib/gov/types";

type PacketMap = Record<string, TelemetryPacket>;
type StatusFilter = "all" | "healthy" | "degraded" | "pending" | "no-api";
type SortKey = "name" | "coverage" | "latency";

interface LogLine {
  id: number;
  at: string;
  level: "info" | "ok" | "warn" | "err";
  text: string;
}

interface CycleStat {
  cycle: number;
  durationMs: number;
  live: number;
  total: number;
}

const TYPE_LABEL: Record<GovEntityType, string> = {
  department: "Cabinet Departments",
  agency: "Independent Agencies",
  commission: "Regulatory Commissions",
  board: "Boards",
  GSE: "GSEs",
};

const AUTH_LABEL: Record<AuthMethod, string> = { none: "OPEN", api_key: "API KEY", oauth: "OAUTH2" };

const STATUS_TONE: Record<ProbeStatus | "awaiting", string> = {
  live: "text-emerald-300 border-emerald-400/60 bg-emerald-500/10",
  http_error: "text-rose-300 border-rose-400/60 bg-rose-500/10",
  network_error: "text-rose-300 border-rose-400/60 bg-rose-500/10",
  api_key_pending: "text-amber-300 border-amber-400/60 bg-amber-500/10",
  oauth_pending: "text-violet-300 border-violet-400/60 bg-violet-500/10",
  unknown_entity: "text-slate-300 border-slate-400/60 bg-slate-500/10",
  awaiting: "text-slate-400 border-slate-500/40 bg-slate-500/5",
};

const STATUS_LABEL: Record<ProbeStatus | "awaiting", string> = {
  live: "LIVE",
  http_error: "HTTP ERR",
  network_error: "NET ERR",
  api_key_pending: "KEY PENDING",
  oauth_pending: "OAUTH PENDING",
  unknown_entity: "UNKNOWN",
  awaiting: "AWAITING",
};

const LATENCY_BUCKETS = [250, 500, 1000, 2000, 4000, Infinity];
const MAX_LOG = 200;
const MAX_CYCLES = 40;

const keyOf = (entityId: string, endpoint: string) => `${entityId}::${endpoint}`;
const isError = (s: ProbeStatus) => s === "http_error" || s === "network_error";
const isPending = (s: ProbeStatus) => s === "api_key_pending" || s === "oauth_pending";

function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

function download(filename: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvCell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

interface EntityRollup {
  meta: EntityMeta;
  packets: TelemetryPacket[];
  live: number;
  errors: number;
  pending: number;
  awaiting: number;
  medianLatency: number;
  health: Exclude<StatusFilter, "all">;
}

function rollup(meta: EntityMeta, packets: PacketMap): EntityRollup {
  const ps = meta.bindings
    .map((b) => packets[keyOf(meta.id, b.endpoint)])
    .filter((p): p is TelemetryPacket => Boolean(p));
  const live = ps.filter((p) => p.status === "live").length;
  const errors = ps.filter((p) => isError(p.status)).length;
  const pending = ps.filter((p) => isPending(p.status)).length;
  const awaiting = meta.bindingCount - ps.length;
  const health: EntityRollup["health"] =
    meta.bindingCount === 0
      ? "no-api"
      : live === meta.bindingCount
        ? "healthy"
        : errors > 0
          ? "degraded"
          : pending > 0 || awaiting > 0
            ? "pending"
            : "degraded";
  return {
    meta,
    packets: ps,
    live,
    errors,
    pending,
    awaiting,
    medianLatency: percentile(ps.filter((p) => p.status === "live").map((p) => p.latencyMs), 50),
    health,
  };
}

export default function GovTelemetryDashboard() {
  const [entities, setEntities] = useState<EntityMeta[]>([]);
  const [summary, setSummary] = useState<HealthSummary | null>(null);
  const [packets, setPackets] = useState<PacketMap>({});
  const [connected, setConnected] = useState(false);
  const [cycle, setCycle] = useState(0);
  const [cycles, setCycles] = useState<CycleStat[]>([]);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [log, setLog] = useState<LogLine[]>([]);
  const [now, setNow] = useState<Date | null>(null);

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<GovEntityType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [authFilter, setAuthFilter] = useState<AuthMethod | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [adminMode, setAdminMode] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [reprobing, setReprobing] = useState(false);

  const pushLog = useCallback((level: LogLine["level"], text: string) => {
    setLog((l) => [{ id: Date.now() + Math.random(), at: new Date().toISOString(), level, text }, ...l].slice(0, MAX_LOG));
  }, []);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const es = new EventSource("/api/gov/telemetry/stream?interval=20");
    let cycleLive = 0;
    let cycleTotal = 0;

    es.onopen = () => {
      setConnected(true);
      pushLog("info", "SSE channel opened → /api/gov/telemetry/stream");
    };
    es.addEventListener("meta", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { entities: EntityMeta[]; summary: HealthSummary };
      setEntities(data.entities);
      setSummary(data.summary);
      pushLog("info", `Registry loaded: ${data.summary.totalEntities} entities / ${data.summary.totalBindings} bindings`);
    });
    es.addEventListener("cycle-start", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { cycle: number };
      cycleLive = 0;
      cycleTotal = 0;
      setCycle((c) => c + 1);
      pushLog("info", `Probe cycle #${data.cycle} dispatched`);
    });
    es.addEventListener("packet", (ev) => {
      const { packet } = JSON.parse((ev as MessageEvent).data) as { packet: TelemetryPacket };
      cycleTotal += 1;
      if (packet.status === "live") cycleLive += 1;
      setPackets((p) => ({ ...p, [keyOf(packet.entityId, packet.sourceEndpoint)]: packet }));
      setLastUpdated(packet.fetchedAt);
      if (isError(packet.status)) {
        pushLog("err", `${packet.entityId} ${packet.httpStatus || "—"} ${packet.error ?? ""}`.trim());
      } else if (packet.status === "live" && !packet.cached) {
        pushLog("ok", `${packet.entityId} ${packet.httpStatus} ${packet.latencyMs}ms ${new URL(packet.sourceEndpoint).host}`);
      }
    });
    es.addEventListener("cycle-end", (ev) => {
      const data = JSON.parse((ev as MessageEvent).data) as { cycle: number; durationMs: number };
      const stat = { cycle: data.cycle, durationMs: data.durationMs, live: cycleLive, total: cycleTotal };
      setCycles((c) => [...c, stat].slice(-MAX_CYCLES));
      pushLog("ok", `Cycle complete: ${cycleLive}/${cycleTotal} live in ${(data.durationMs / 1000).toFixed(1)}s`);
    });
    es.addEventListener("rotate", () => pushLog("info", "Stream budget reached — rotating connection"));
    es.onerror = () => {
      setConnected(false);
      pushLog("warn", "SSE channel interrupted — auto-reconnecting");
    };
    return () => es.close();
  }, [pushLog]);

  const rollups = useMemo(() => entities.map((e) => rollup(e, packets)), [entities, packets]);

  const allPackets = useMemo(() => Object.values(packets), [packets]);

  const stats = useMemo(() => {
    const totalBindings = summary?.totalBindings ?? 0;
    const live = allPackets.filter((p) => p.status === "live");
    const latencies = live.map((p) => p.latencyMs);
    return {
      totalBindings,
      live: live.length,
      errored: allPackets.filter((p) => isError(p.status)).length,
      keyPending: allPackets.filter((p) => p.status === "api_key_pending").length,
      oauthPending: allPackets.filter((p) => p.status === "oauth_pending").length,
      awaiting: Math.max(0, totalBindings - allPackets.length),
      p50: percentile(latencies, 50),
      p95: percentile(latencies, 95),
      coverage: totalBindings ? Math.round((live.length / totalBindings) * 100) : 0,
      bytes: live.reduce((a, p) => a + p.bytes, 0),
    };
  }, [allPackets, summary]);

  const sectorMatrix = useMemo(() => {
    const rows = new Map<GovEntityType, { entities: number; bindings: number; live: number; noApi: number }>();
    for (const r of rollups) {
      const row = rows.get(r.meta.type) ?? { entities: 0, bindings: 0, live: 0, noApi: 0 };
      row.entities += 1;
      row.bindings += r.meta.bindingCount;
      row.live += r.live;
      if (r.meta.bindingCount === 0) row.noApi += 1;
      rows.set(r.meta.type, row);
    }
    return (Object.keys(TYPE_LABEL) as GovEntityType[]).filter((t) => rows.has(t)).map((t) => ({ type: t, ...rows.get(t)! }));
  }, [rollups]);

  const authMatrix = useMemo(() => {
    const methods: AuthMethod[] = ["none", "api_key", "oauth"];
    return methods.map((m) => {
      const ps = allPackets.filter((p) => p.authMethod === m);
      const bindings = entities.reduce((a, e) => a + e.bindings.filter((b) => b.authMethod === m).length, 0);
      return {
        method: m,
        bindings,
        live: ps.filter((p) => p.status === "live").length,
        errored: ps.filter((p) => isError(p.status)).length,
        pending: ps.filter((p) => isPending(p.status)).length,
      };
    });
  }, [allPackets, entities]);

  const histogram = useMemo(() => {
    const counts = LATENCY_BUCKETS.map(() => 0);
    for (const p of allPackets) {
      if (p.status !== "live") continue;
      counts[LATENCY_BUCKETS.findIndex((b) => p.latencyMs < b)] += 1;
    }
    return counts;
  }, [allPackets]);

  const slowest = useMemo(
    () => [...allPackets].filter((p) => p.status === "live").sort((a, b) => b.latencyMs - a.latencyMs).slice(0, 8),
    [allPackets]
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rollups.filter((r) => {
      if (typeFilter !== "all" && r.meta.type !== typeFilter) return false;
      if (statusFilter !== "all" && r.health !== statusFilter) return false;
      if (authFilter !== "all" && !r.meta.authMethods.includes(authFilter)) return false;
      if (!q) return true;
      return (
        r.meta.name.toLowerCase().includes(q) ||
        r.meta.id.toLowerCase().includes(q) ||
        r.meta.parentDept.toLowerCase().includes(q) ||
        r.meta.bindings.some((b) => b.endpoint.toLowerCase().includes(q))
      );
    });
    const coverage = (r: EntityRollup) => (r.meta.bindingCount ? r.live / r.meta.bindingCount : -1);
    return list.sort((a, b) =>
      sortKey === "coverage"
        ? coverage(b) - coverage(a)
        : sortKey === "latency"
          ? b.medianLatency - a.medianLatency
          : a.meta.name.localeCompare(b.meta.name)
    );
  }, [rollups, query, typeFilter, statusFilter, authFilter, sortKey]);

  const selectedRollup = selected ? rollups.find((r) => r.meta.id === selected) ?? null : null;

  const reprobe = useCallback(
    async (id: string) => {
      setReprobing(true);
      pushLog("info", `Manual re-probe requested for ${id}`);
      try {
        const res = await fetch(`/api/gov/telemetry?id=${encodeURIComponent(id)}&fresh=1`, { cache: "no-store" });
        const json = (await res.json()) as { packets: TelemetryPacket[] };
        setPackets((p) => {
          const next = { ...p };
          for (const pk of json.packets) next[keyOf(pk.entityId, pk.sourceEndpoint)] = pk;
          return next;
        });
        pushLog("ok", `${id}: ${json.packets.filter((p) => p.status === "live").length}/${json.packets.length} live after re-probe`);
      } catch (err) {
        pushLog("err", `${id}: re-probe failed — ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setReprobing(false);
      }
    },
    [pushLog]
  );

  const exportJson = () =>
    download(
      `lucid1-gov-telemetry-${Date.now()}.json`,
      JSON.stringify({ exportedAt: new Date().toISOString(), summary, packets: allPackets }, null, 2),
      "application/json"
    );

  const exportCsv = () => {
    const header = ["entityId", "endpoint", "auth", "status", "httpStatus", "latencyMs", "bytes", "contentType", "fetchedAt", "error"];
    const rows = allPackets.map((p) =>
      [p.entityId, p.sourceEndpoint, p.authMethod, p.status, p.httpStatus, p.latencyMs, p.bytes, p.contentType ?? "", p.fetchedAt, p.error ?? ""]
        .map(csvCell)
        .join(",")
    );
    download(`lucid1-gov-telemetry-${Date.now()}.csv`, [header.join(","), ...rows].join("\n"), "text/csv");
  };

  const maxHist = Math.max(1, ...histogram);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono text-slate-100">
      {/* Command header */}
      <section className="glass-panel rounded-2xl p-5 sm:p-6 border border-sky-400/30 shadow-[0_16px_70px_rgba(56,189,248,0.18)]">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-sky-400/50 bg-sky-500/10 text-[10px] tracking-[0.2em] text-sky-300">
              <Shield className="w-3.5 h-3.5" /> NSA ADMIN MODE • LUCID-1 ORACLE-SYNAPSE
            </div>
            <h1 className="mt-3 text-xl sm:text-2xl font-bold tracking-wider text-sky-300">
              FEDERAL GOVERNMENT TELEMETRY COMMAND CENTER
            </h1>
            <p className="mt-1 text-xs text-slate-400 max-w-3xl">
              {summary?.totalEntities ?? "—"} federal entities • {summary?.totalBindings ?? "—"} public-API bindings •
              server-side reachability probes streamed over SSE. Every value below is a real HTTP response from a public
              federal endpoint — nothing is simulated.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[10px]">
            <span
              className={`px-3 py-1.5 rounded-full font-bold tracking-wider border ${
                connected ? "text-emerald-300 border-emerald-400 bg-emerald-500/10" : "text-amber-300 border-amber-400 bg-amber-500/10"
              }`}
            >
              {connected ? "● STREAM LIVE" : "○ RECONNECTING"}
            </span>
            <span className="px-3 py-1.5 rounded-full border border-white/15 text-slate-300">CYCLE #{cycle}</span>
            <span className="px-3 py-1.5 rounded-full border border-white/15 text-slate-300">
              UTC {now ? now.toISOString().slice(11, 19) : "--:--:--"}
            </span>
            <span className="px-3 py-1.5 rounded-full border border-white/15 text-slate-300">
              LAST {lastUpdated ? new Date(lastUpdated).toISOString().slice(11, 19) : "AWAITING"}
            </span>
            <button
              onClick={() => setAdminMode((v) => !v)}
              className={`px-3 py-1.5 rounded-full border font-bold ${
                adminMode ? "border-sky-400 text-sky-300 bg-sky-500/10" : "border-white/20 text-slate-400"
              }`}
            >
              {adminMode ? "ADMIN VIEW" : "OPERATOR VIEW"}
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3 mt-5">
          <Kpi icon={<Database className="w-3.5 h-3.5" />} label="BINDINGS" value={stats.totalBindings} tone="sky" />
          <Kpi icon={<Activity className="w-3.5 h-3.5" />} label="LIVE 2xx" value={stats.live} tone="emerald" />
          <Kpi icon={<X className="w-3.5 h-3.5" />} label="ERRORED" value={stats.errored} tone="rose" />
          <Kpi icon={<KeyRound className="w-3.5 h-3.5" />} label="KEY PENDING" value={stats.keyPending} tone="amber" />
          <Kpi icon={<Lock className="w-3.5 h-3.5" />} label="OAUTH PENDING" value={stats.oauthPending} tone="violet" />
          <Kpi icon={<RefreshCw className="w-3.5 h-3.5" />} label="AWAITING" value={stats.awaiting} tone="slate" />
          <Kpi icon={<Gauge className="w-3.5 h-3.5" />} label="P50 / P95 ms" value={`${stats.p50} / ${stats.p95}`} tone="sky" />
          <Kpi icon={<Eye className="w-3.5 h-3.5" />} label="LIVE COVERAGE" value={`${stats.coverage}%`} tone="emerald" />
        </div>
        <div className="mt-3 h-2 rounded-full bg-white/5 overflow-hidden flex">
          <div className="bg-emerald-400/80" style={{ width: pct(stats.live, stats.totalBindings) }} />
          <div className="bg-rose-400/80" style={{ width: pct(stats.errored, stats.totalBindings) }} />
          <div className="bg-amber-400/80" style={{ width: pct(stats.keyPending, stats.totalBindings) }} />
          <div className="bg-violet-400/80" style={{ width: pct(stats.oauthPending, stats.totalBindings) }} />
        </div>
      </section>

      {/* Analytics row */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="SECTOR COVERAGE MATRIX" icon={<Server className="w-4 h-4" />}>
          <div className="space-y-3">
            {sectorMatrix.map((row) => (
              <div key={row.type}>
                <div className="flex justify-between text-[11px]">
                  <button className="text-slate-200 hover:text-sky-300" onClick={() => setTypeFilter(row.type)}>
                    {TYPE_LABEL[row.type]}
                  </button>
                  <span className="text-slate-400">
                    {row.live}/{row.bindings} live • {row.entities} ent{row.noApi ? ` • ${row.noApi} no-API` : ""}
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-sky-400/80" style={{ width: pct(row.live, row.bindings) }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="AUTHENTICATION POSTURE" icon={<Lock className="w-4 h-4" />}>
          <table className="w-full text-[11px]">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left font-normal pb-2">METHOD</th>
                <th className="text-right font-normal pb-2">BIND</th>
                <th className="text-right font-normal pb-2">LIVE</th>
                <th className="text-right font-normal pb-2">ERR</th>
                <th className="text-right font-normal pb-2">PEND</th>
              </tr>
            </thead>
            <tbody>
              {authMatrix.map((r) => (
                <tr key={r.method} className="border-t border-white/5">
                  <td className="py-1.5">
                    <button className="hover:text-sky-300" onClick={() => setAuthFilter(r.method)}>
                      {AUTH_LABEL[r.method]}
                    </button>
                  </td>
                  <td className="text-right text-slate-300">{r.bindings}</td>
                  <td className="text-right text-emerald-300">{r.live}</td>
                  <td className="text-right text-rose-300">{r.errored}</td>
                  <td className="text-right text-amber-300">{r.pending}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {summary && summary.missingEnv.length > 0 && (
            <div className="mt-3 text-[10px] text-amber-300/90 leading-relaxed">
              <div className="text-slate-500 mb-1">UNSET API-KEY ENV VARS ({summary.missingEnv.length})</div>
              <div className="flex flex-wrap gap-1">
                {summary.missingEnv.map((e) => (
                  <span key={e} className="px-1.5 py-0.5 rounded border border-amber-400/40 bg-amber-500/5">
                    {e}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>

        <Panel title="LATENCY DISTRIBUTION" icon={<Gauge className="w-4 h-4" />}>
          <div className="flex items-end gap-2 h-24">
            {histogram.map((count, i) => (
              <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                <div className="text-[9px] text-slate-400 mb-1">{count}</div>
                <div className="w-full rounded-t bg-sky-400/70" style={{ height: `${(count / maxHist) * 100}%`, minHeight: count ? 2 : 0 }} />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-1 text-[9px] text-slate-500">
            {LATENCY_BUCKETS.map((b, i) => (
              <div key={i} className="flex-1 text-center">
                {b === Infinity ? "≥4s" : `<${b >= 1000 ? `${b / 1000}s` : b}`}
              </div>
            ))}
          </div>
          <CycleSparkline cycles={cycles} />
        </Panel>
      </section>

      {/* Filters */}
      <section className="glass-card rounded-2xl p-4 border border-white/10 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search entity, ID, parent dept, or endpoint host…"
            className="w-full bg-black/30 border border-white/15 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-sky-400"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center text-[11px]">
          <Filter className="w-4 h-4 text-slate-500" />
          <Select value={typeFilter} onChange={(v) => setTypeFilter(v as GovEntityType | "all")} options={[["all", "All sectors"], ...(Object.entries(TYPE_LABEL) as [string, string][])]} />
          <Select
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={[["all", "All health"], ["healthy", "Healthy"], ["degraded", "Degraded"], ["pending", "Pending"], ["no-api", "No public API"]]}
          />
          <Select value={authFilter} onChange={(v) => setAuthFilter(v as AuthMethod | "all")} options={[["all", "All auth"], ["none", "Open"], ["api_key", "API key"], ["oauth", "OAuth2"]]} />
          <Select value={sortKey} onChange={(v) => setSortKey(v as SortKey)} options={[["name", "Sort: name"], ["coverage", "Sort: coverage"], ["latency", "Sort: latency"]]} />
          <button onClick={exportCsv} className="px-3 py-2 rounded-xl border border-white/15 hover:border-sky-400 flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> CSV
          </button>
          <button onClick={exportJson} className="px-3 py-2 rounded-xl border border-white/15 hover:border-sky-400 flex items-center gap-1">
            <Download className="w-3.5 h-3.5" /> JSON
          </button>
        </div>
      </section>

      {/* Entity grid + console */}
      <section className={`grid grid-cols-1 gap-4 ${adminMode ? "xl:grid-cols-[1fr_360px]" : ""}`}>
        <div>
          <div className="text-[10px] text-slate-500 mb-2">
            SHOWING {visible.length} OF {rollups.length} ENTITIES
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-3">
            {visible.map((r) => (
              <EntityCard key={r.meta.id} r={r} admin={adminMode} onSelect={() => setSelected(r.meta.id)} />
            ))}
          </div>
        </div>

        {adminMode && (
          <div className="space-y-4">
            <Panel title="EVENT CONSOLE" icon={<Terminal className="w-4 h-4" />}>
              <div className="h-80 overflow-y-auto text-[10px] leading-relaxed space-y-0.5 bg-black/40 rounded-lg p-2">
                {log.length === 0 && <div className="text-slate-500">Awaiting stream…</div>}
                {log.map((l) => (
                  <div key={l.id} className="flex gap-2">
                    <span className="text-slate-600 shrink-0">{l.at.slice(11, 19)}</span>
                    <span
                      className={
                        l.level === "ok" ? "text-emerald-300" : l.level === "err" ? "text-rose-300" : l.level === "warn" ? "text-amber-300" : "text-sky-300"
                      }
                    >
                      {l.text}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel title="SLOWEST LIVE ENDPOINTS" icon={<Activity className="w-4 h-4" />}>
              <div className="space-y-1.5 text-[10px]">
                {slowest.length === 0 && <div className="text-slate-500">No live packets yet.</div>}
                {slowest.map((p) => (
                  <button
                    key={keyOf(p.entityId, p.sourceEndpoint)}
                    onClick={() => setSelected(p.entityId)}
                    className="w-full flex justify-between gap-2 text-left hover:text-sky-300"
                  >
                    <span className="truncate">
                      <span className="text-slate-500">{p.entityId}</span> {hostOf(p.sourceEndpoint)}
                    </span>
                    <span className="text-amber-300 shrink-0">{p.latencyMs}ms</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 text-[10px] text-slate-500">
                TRANSFERRED {(stats.bytes / 1024).toFixed(1)} KB ACROSS {stats.live} LIVE RESPONSES
              </div>
            </Panel>
          </div>
        )}
      </section>

      {selectedRollup && (
        <EntityDrawer
          r={selectedRollup}
          packets={packets}
          admin={adminMode}
          reprobing={reprobing}
          onReprobe={() => reprobe(selectedRollup.meta.id)}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function pct(n: number, d: number) {
  return d ? `${(n / d) * 100}%` : "0%";
}

function hostOf(url: string) {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

const KPI_TONE: Record<string, string> = {
  sky: "border-sky-400/40 text-sky-300",
  emerald: "border-emerald-400/40 text-emerald-300",
  rose: "border-rose-400/40 text-rose-300",
  amber: "border-amber-400/40 text-amber-300",
  violet: "border-violet-400/40 text-violet-300",
  slate: "border-slate-400/30 text-slate-300",
};

function Kpi({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number | string; tone: string }) {
  return (
    <div className={`rounded-xl border bg-black/30 p-3 ${KPI_TONE[tone]}`}>
      <div className="flex items-center gap-1.5 text-[9px] tracking-wider opacity-80">
        {icon}
        {label}
      </div>
      <div className="text-lg font-bold mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="glass-card rounded-2xl p-4 border border-white/10">
      <div className="flex items-center gap-2 text-[10px] tracking-[0.18em] text-sky-300 mb-3">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-black/40 border border-white/15 rounded-xl px-2 py-2 focus:outline-none focus:border-sky-400"
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  );
}

function CycleSparkline({ cycles }: { cycles: CycleStat[] }) {
  if (cycles.length < 2) {
    return <div className="mt-4 text-[10px] text-slate-500">Cycle trend appears after 2 probe cycles.</div>;
  }
  const w = 300;
  const h = 40;
  const maxD = Math.max(...cycles.map((c) => c.durationMs), 1);
  const x = (i: number) => (i / (cycles.length - 1)) * w;
  const dur = cycles.map((c, i) => `${x(i)},${h - (c.durationMs / maxD) * h}`).join(" ");
  const cov = cycles.map((c, i) => `${x(i)},${h - (c.total ? c.live / c.total : 0) * h}`).join(" ");
  return (
    <div className="mt-4">
      <div className="flex justify-between text-[9px] text-slate-500 mb-1">
        <span className="text-emerald-300">— live ratio</span>
        <span className="text-sky-300">— cycle duration</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-10" preserveAspectRatio="none">
        <polyline points={cov} fill="none" stroke="rgb(110 231 183)" strokeWidth="1.5" />
        <polyline points={dur} fill="none" stroke="rgb(125 211 252)" strokeWidth="1.5" />
      </svg>
    </div>
  );
}

const HEALTH_TONE: Record<EntityRollup["health"], string> = {
  healthy: "text-emerald-300 border-emerald-400/60",
  degraded: "text-rose-300 border-rose-400/60",
  pending: "text-amber-300 border-amber-400/60",
  "no-api": "text-slate-400 border-slate-500/50",
};

function EntityCard({ r, admin, onSelect }: { r: EntityRollup; admin: boolean; onSelect: () => void }) {
  const { meta } = r;
  return (
    <button onClick={onSelect} className="text-left glass-card rounded-2xl p-4 border border-white/10 hover:border-sky-400/60 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-[10px] text-slate-500 tracking-wider">{meta.id}</div>
          <div className="text-sm font-bold truncate">{meta.name}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 truncate">
            {meta.type.toUpperCase()} • {meta.parentDept}
          </div>
        </div>
        <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold border ${HEALTH_TONE[r.health]}`}>
          {r.health === "no-api" ? "NO API" : `${r.live}/${meta.bindingCount}`}
        </span>
      </div>
      {meta.bindingCount > 0 && (
        <div className="mt-3 flex gap-1">
          {meta.bindings.map((b) => {
            const p = r.packets.find((x) => x.sourceEndpoint === b.endpoint);
            const s = p?.status ?? "awaiting";
            return <span key={b.endpoint} title={`${hostOf(b.endpoint)} — ${STATUS_LABEL[s]}`} className={`h-1.5 flex-1 rounded-full border ${STATUS_TONE[s]}`} />;
          })}
        </div>
      )}
      {admin && (
        <div className="mt-2 flex flex-wrap gap-1 text-[9px] text-slate-400">
          {meta.authMethods.map((a) => (
            <span key={a} className="px-1.5 py-0.5 rounded border border-white/10">
              {AUTH_LABEL[a]}
            </span>
          ))}
          <span className="px-1.5 py-0.5 rounded border border-white/10">AVAIL {meta.dataAvailability.toUpperCase()}</span>
          {r.medianLatency > 0 && <span className="px-1.5 py-0.5 rounded border border-white/10">P50 {r.medianLatency}ms</span>}
        </div>
      )}
    </button>
  );
}

function EntityDrawer({
  r,
  packets,
  admin,
  reprobing,
  onReprobe,
  onClose,
}: {
  r: EntityRollup;
  packets: PacketMap;
  admin: boolean;
  reprobing: boolean;
  onReprobe: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex justify-end" onClick={onClose}>
      <div className="w-full max-w-2xl h-full overflow-y-auto bg-[#050b16] border-l border-sky-400/30 p-5 sm:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] text-slate-500">{r.meta.id}</div>
            <h2 className="text-lg font-bold text-sky-300">{r.meta.name}</h2>
            <div className="text-[11px] text-slate-400">
              {r.meta.type.toUpperCase()} • {r.meta.parentDept} • DATA AVAILABILITY {r.meta.dataAvailability.toUpperCase()}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {r.meta.bindingCount > 0 && (
              <button
                onClick={onReprobe}
                disabled={reprobing}
                className="px-3 py-1.5 rounded-full border border-sky-400/60 text-sky-300 text-[11px] flex items-center gap-1 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${reprobing ? "animate-spin" : ""}`} /> RE-PROBE
              </button>
            )}
            <button onClick={onClose} aria-label="Close" className="px-3 py-1.5 rounded-full border border-white/20 text-[11px]">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {r.meta.bindingCount === 0 && (
          <div className="mt-5 rounded-xl border border-slate-500/40 p-4 text-xs text-slate-400">
            No public machine-readable API is published for this entity. It is tracked in the registry but not probed.
          </div>
        )}

        <div className="mt-5 space-y-3">
          {r.meta.bindings.map((b) => {
            const p = packets[keyOf(r.meta.id, b.endpoint)];
            const s = p?.status ?? "awaiting";
            return (
              <div key={b.endpoint} className="rounded-xl border border-white/10 bg-black/30 p-4">
                <div className="flex items-center justify-between gap-2">
                  <a href={b.endpoint} target="_blank" rel="noreferrer" className="text-[11px] text-sky-300 hover:underline break-all">
                    {b.endpoint}
                  </a>
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-bold border ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>
                </div>
                <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">{b.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-slate-400">
                  <span className="px-1.5 py-0.5 rounded border border-white/10">{AUTH_LABEL[b.authMethod]}</span>
                  <span className="px-1.5 py-0.5 rounded border border-white/10">POLL {b.pollingIntervalSec}s</span>
                  {p && p.httpStatus > 0 && <span className="px-1.5 py-0.5 rounded border border-white/10">HTTP {p.httpStatus}</span>}
                  {p && p.latencyMs > 0 && <span className="px-1.5 py-0.5 rounded border border-white/10">{p.latencyMs}ms</span>}
                  {p && p.bytes > 0 && <span className="px-1.5 py-0.5 rounded border border-white/10">{(p.bytes / 1024).toFixed(1)} KB</span>}
                  {p?.contentType && <span className="px-1.5 py-0.5 rounded border border-white/10">{p.contentType.split(";")[0]}</span>}
                  {p?.cached && <span className="px-1.5 py-0.5 rounded border border-white/10">CACHED</span>}
                  {p && <span className="px-1.5 py-0.5 rounded border border-white/10">{p.fetchedAt.slice(11, 19)} UTC</span>}
                </div>
                {p?.error && <div className="mt-2 text-[11px] text-rose-300 break-all">{p.error}</div>}
                {p?.data && (
                  <div className="mt-2 text-[10px] text-slate-300 space-y-1">
                    {p.data.title && <div>TITLE: {p.data.title}</div>}
                    {p.data.recordCount !== undefined && <div>RECORDS: {p.data.recordCount}</div>}
                    {p.data.topLevelKeys && <div className="break-all">KEYS: {p.data.topLevelKeys.join(", ")}</div>}
                    {admin && p.data.preview && (
                      <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-black/50 p-2 text-[10px] text-slate-400 whitespace-pre-wrap break-all">
                        {p.data.preview}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

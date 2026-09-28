"use client";

import React, { useEffect, useMemo, useState } from "react";
import type { VerifiedAnomaly, VerifiedFeed } from "../lib/verified-anomalies";
import type { FederalProbe } from "../lib/gov/federal-sources";
import { US_JURISDICTIONS, JURISDICTION_BY_CODE } from "../lib/us-jurisdictions";
import { Activity, BarChart3, Clock3, Globe2, Radar, Server, ShieldCheck, Waves } from "lucide-react";

interface GovTelemetry {
  probedAt: string;
  total: number;
  reachable: number;
  availabilityPct: number;
  latency: { p50: number | null; p90: number | null; max: number | null };
  byDomain: Record<string, { total: number; reachable: number }>;
  probes: FederalProbe[];
}

interface Props {
  feed: VerifiedFeed | null;
  records: VerifiedAnomaly[];
  scopeLabel: string;
}

const GOV_REFRESH_MS = 120_000;
const HOURS = 24 * 7;

const SEVERITY_ORDER = ["Extreme", "Severe", "Moderate", "Minor", "Unknown"];
const SEVERITY_COLOR: Record<string, string> = {
  Extreme: "#ff1744",
  Severe: "#ff2bd6",
  Moderate: "#00e5ff",
  Minor: "#00ff88",
  Unknown: "#8595a8",
};

const SOURCE_COLOR: Record<VerifiedAnomaly["source"], string> = {
  NWS: "#00e5ff",
  USGS: "#ffb300",
  CISA_KEV: "#bd00ff",
  FEMA: "#ff2bd6",
  USGS_VOLCANO: "#ff6d00",
  NHC: "#0abab5",
};

function normSeverity(s: string) {
  if (SEVERITY_ORDER.includes(s)) return s;
  if (/critical|high/i.test(s)) return "Severe";
  if (/medium/i.test(s)) return "Moderate";
  if (/low/i.test(s)) return "Minor";
  return "Unknown";
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const w = max > 0 ? Math.max(2, (value / max) * 100) : 0;
  return (
    <div className="h-2 w-full rounded-full bg-white/5 overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${w}%`, background: color, boxShadow: `0 0 10px ${color}` }} />
    </div>
  );
}

function Card({ title, icon, accent, children }: { title: string; icon: React.ReactNode; accent: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[24px] p-4 sm:p-5 bg-[#020b18]/90 border space-y-3" style={{ borderColor: `${accent}66`, boxShadow: `0 0 30px ${accent}22, inset 0 1px 2px ${accent}44` }}>
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em]" style={{ color: accent }}>
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

export default function AnomalyAnalyticsPanel({ feed, records, scopeLabel }: Props) {
  const [gov, setGov] = useState<GovTelemetry | null>(null);
  const [govError, setGovError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/gov/telemetry", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as GovTelemetry;
        if (alive) { setGov(data); setGovError(null); }
      } catch (e) {
        if (alive) setGovError(e instanceof Error ? e.message : String(e));
      }
    };
    load();
    const t = setInterval(load, GOV_REFRESH_MS);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const severity = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of records) m.set(normSeverity(r.severity), (m.get(normSeverity(r.severity)) ?? 0) + 1);
    return SEVERITY_ORDER.map((k) => ({ k, n: m.get(k) ?? 0 })).filter((x) => x.n > 0);
  }, [records]);

  const sectors = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of records) m.set(r.sector, (m.get(r.sector) ?? 0) + 1);
    return [...m.entries()].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
  }, [records]);

  const sources = useMemo(() => {
    const m = new Map<VerifiedAnomaly["source"], number>();
    for (const r of records) m.set(r.source, (m.get(r.source) ?? 0) + 1);
    return [...m.entries()].map(([k, n]) => ({ k, n })).sort((a, b) => b.n - a.n);
  }, [records]);

  const topJurisdictions = useMemo(() => {
    if (!feed) return [];
    return US_JURISDICTIONS
      .map((j) => ({ code: j.code, name: j.name, n: feed.perJurisdiction[j.code] ?? 0 }))
      .filter((x) => x.n > 0)
      .sort((a, b) => b.n - a.n)
      .slice(0, 12);
  }, [feed]);

  const timeline = useMemo(() => {
    const now = Date.now();
    const bins = new Array<number>(28).fill(0);
    let inWindow = 0;
    for (const r of records) {
      const t = new Date(r.eventTime).getTime();
      if (Number.isNaN(t)) continue;
      const ageH = (now - t) / 3_600_000;
      if (ageH < 0 || ageH > HOURS) continue;
      bins[Math.min(27, Math.floor(ageH / 6))] += 1;
      inWindow += 1;
    }
    return { bins: bins.reverse(), inWindow, max: Math.max(1, ...bins) };
  }, [records]);

  const last24h = useMemo(() => {
    const cutoff = Date.now() - 86_400_000;
    return records.filter((r) => new Date(r.eventTime).getTime() >= cutoff).length;
  }, [records]);

  const geo = useMemo(() => records.filter((r) => r.coords).length, [records]);

  const extremeCount = severity.find((s) => s.k === "Extreme")?.n ?? 0;
  const severeCount = severity.find((s) => s.k === "Severe")?.n ?? 0;

  const kpis = [
    { label: "RECORDS IN SCOPE", value: records.length.toLocaleString("en-US"), accent: "#00e5ff", icon: <Radar className="w-4 h-4" /> },
    { label: "EVENTS LAST 24H", value: last24h.toLocaleString("en-US"), accent: "#00ff88", icon: <Clock3 className="w-4 h-4" /> },
    { label: "EXTREME + SEVERE", value: (extremeCount + severeCount).toLocaleString("en-US"), accent: "#ff2bd6", icon: <Activity className="w-4 h-4" /> },
    { label: "GEOLOCATED", value: geo.toLocaleString("en-US"), accent: "#0abab5", icon: <Globe2 className="w-4 h-4" /> },
    { label: "FEDERAL ENDPOINTS UP", value: gov ? `${gov.reachable}/${gov.total}` : "…", accent: "#bd00ff", icon: <Server className="w-4 h-4" /> },
    { label: "PROBE LATENCY P50", value: gov?.latency.p50 != null ? `${gov.latency.p50} ms` : "…", accent: "#ffb300", icon: <Waves className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl p-3.5 bg-[#020b18]/90 border space-y-1.5" style={{ borderColor: `${k.accent}55`, boxShadow: `0 0 20px ${k.accent}1f` }}>
            <div className="flex items-center gap-1.5 text-[9px] font-bold tracking-[0.15em] text-[#8595a8]">{k.icon}{k.label}</div>
            <div className="text-xl sm:text-2xl font-black tabular-nums" style={{ color: k.accent, textShadow: `0 0 14px ${k.accent}99` }}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card title={`Severity distribution — ${scopeLabel}`} icon={<Activity className="w-4 h-4" />} accent="#ff2bd6">
          {severity.length === 0 && <div className="text-xs text-[#80deea]">No records in scope.</div>}
          {severity.map((s) => (
            <div key={s.k} className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono"><span style={{ color: SEVERITY_COLOR[s.k] }}>{s.k.toUpperCase()}</span><span className="text-white tabular-nums">{s.n} · {((s.n / records.length) * 100).toFixed(1)}%</span></div>
              <Bar value={s.n} max={records.length} color={SEVERITY_COLOR[s.k]} />
            </div>
          ))}
        </Card>

        <Card title="Source contribution" icon={<ShieldCheck className="w-4 h-4" />} accent="#00e5ff">
          {sources.map((s) => (
            <div key={s.k} className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono"><span style={{ color: SOURCE_COLOR[s.k] }}>{s.k.replace("_", " ")}</span><span className="text-white tabular-nums">{s.n}</span></div>
              <Bar value={s.n} max={sources[0]?.n ?? 1} color={SOURCE_COLOR[s.k]} />
            </div>
          ))}
          {feed && (
            <div className="pt-2 text-[10px] font-mono text-[#8595a8]">
              {feed.feeds.filter((f) => f.ok).length}/{feed.feeds.length} anomaly feeds healthy · last poll {new Date(feed.retrievedAt).toISOString().replace("T", " ").slice(0, 19)}Z
            </div>
          )}
        </Card>

        <Card title="Event timeline — 7 days, 6 h bins (oldest → newest)" icon={<BarChart3 className="w-4 h-4" />} accent="#00ff88">
          <div className="flex items-end gap-[3px] h-24">
            {timeline.bins.map((n, i) => (
              <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-[#00ff88] to-[#00e5ff] transition-all duration-700" style={{ height: `${Math.max(3, (n / timeline.max) * 100)}%`, opacity: n ? 0.95 : 0.15 }} title={`${n} events`} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] font-mono text-[#8595a8]"><span>−7 d</span><span>{timeline.inWindow.toLocaleString("en-US")} timestamped events in window</span><span>now</span></div>
        </Card>

        <Card title="Sector breakdown" icon={<Radar className="w-4 h-4" />} accent="#bd00ff">
          {sectors.map((s) => (
            <div key={s.k} className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono"><span className="text-[#e0aaff]">{s.k.toUpperCase()}</span><span className="text-white tabular-nums">{s.n}</span></div>
              <Bar value={s.n} max={sectors[0]?.n ?? 1} color="#bd00ff" />
            </div>
          ))}
        </Card>
      </div>

      <Card title="Top jurisdictions by active source events" icon={<Globe2 className="w-4 h-4" />} accent="#0abab5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
          {topJurisdictions.map((j) => (
            <div key={j.code} className="space-y-1">
              <div className="flex justify-between text-[11px] font-mono"><span className="text-[#7ff5f0]">{j.code} · {JURISDICTION_BY_CODE[j.code]?.name ?? j.name}</span><span className="text-white tabular-nums">{j.n}</span></div>
              <Bar value={j.n} max={topJurisdictions[0]?.n ?? 1} color="#0abab5" />
            </div>
          ))}
          {topJurisdictions.length === 0 && <div className="text-xs text-[#80deea]">Awaiting feed.</div>}
        </div>
      </Card>

      <Card title={`Federal endpoint health grid — ${gov ? `${gov.availabilityPct}% reachable · p90 ${gov.latency.p90 ?? "—"} ms` : govError ? `probe failed: ${govError}` : "probing…"}`} icon={<Server className="w-4 h-4" />} accent="#ffb300">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
          {(gov?.probes ?? []).map((p) => (
            <a key={p.id} href={p.docsUrl} target="_blank" rel="noopener noreferrer" className="block rounded-xl p-3 bg-[#050f1f]/90 border border-white/10 hover:border-[#ffb300]/60 transition-colors space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-white truncate">{p.entity}</span>
                <span className={`shrink-0 text-[9px] font-black px-2 py-0.5 rounded-full border ${p.ok ? "text-[#69f0ae] border-[#00ff88]/60 bg-[#002b1b]" : "text-[#ff80ab] border-[#ff1744]/60 bg-[#3d0014]"}`}>{p.ok ? `HTTP ${p.httpStatus}` : (p.httpStatus ? `HTTP ${p.httpStatus}` : "UNREACHABLE")}</span>
              </div>
              <div className="text-[10px] font-mono text-[#8595a8] truncate">{p.parent} · {p.domain}</div>
              <div className="flex justify-between text-[10px] font-mono tabular-nums"><span className="text-[#ffd180]">{p.latencyMs} ms</span><span className="text-[#8595a8]">{p.bytes != null ? `${(p.bytes / 1024).toFixed(1)} KiB` : p.error}</span></div>
            </a>
          ))}
        </div>
        {gov && (
          <div className="text-[10px] font-mono text-[#8595a8] pt-1">
            Probed {new Date(gov.probedAt).toISOString().replace("T", " ").slice(0, 19)}Z · re-probes every {GOV_REFRESH_MS / 1000}s · status/latency only, no payload is fabricated for unreachable endpoints.
          </div>
        )}
      </Card>
    </div>
  );
}

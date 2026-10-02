"use client";

import React, { useEffect, useState } from "react";
import { Hexagon } from "lucide-react";

interface Payload {
  generatedAt: string;
  source: string;
  sourceUrl: string;
  apiUrl: string;
  coverage: string;
  window: { from: string; to: string; days: number; latestReport: string | null };
  privacy: { kMin: number; method: string };
  incidents: number;
  byHour: number[];
  byWeekday: number[];
  byDay: { date: string; count: number }[];
  byCategory: { category: string; count: number }[];
  byAgainst: { against: string; count: number }[];
  suppressed: Record<string, { cells: number; incidents: number }>;
  hex: Record<string, { features: unknown[] }>;
  ytd: { year: number; total: number; byCategory: { category: string; count: number }[] };
  recent: { lagMinutes: number | null; last15m: number; last30m: number; last60m: number; last24h: number };
  models: {
    days: number;
    from: string | null;
    to: string | null;
    daily: { date: string; weekday: number; count: number }[];
    changePoint: { date: string; probability: number; rateBefore: number; rateAfter: number } | null;
    poisson: {
      dispersion: number;
      trendPerWeek: number;
      weekdayRateRatio: number[];
      forecast: { date: string; weekday: number; mean: number; low: number; high: number }[];
    } | null;
    hotspots: { method: string; cells99: number; cells95: number; cells90: number };
  };
  precincts: { geojson: { features: { properties: { name: string; count: number; share: number } }[] } | null };
  dispatch:
    | {
        ok: true;
        sourceUrl: string;
        total: number;
        from: string | null;
        to: string | null;
        zone: { rows: { key: string; count: number }[]; suppressed: number };
        priority: { rows: { key: string; count: number }[]; suppressed: number };
        callSource: { rows: { key: string; count: number }[]; suppressed: number };
        note: string;
      }
    | { ok: false; sourceUrl: string; error: string };
  rates: {
    source: string;
    sourceUrl: string;
    cityPopulation: number | null;
    cityPer100k: number | null;
    byNpu: { npu: string; count: number; population: number | null; per100k: number | null }[];
    note: string;
  };
}

const REFRESH_MS = 5 * 60_000;
const RECENT_MS = 60_000;

interface Recent {
  generatedAt: string;
  latestReport: string | null;
  counts: Record<"15" | "60" | "180" | "1440", number>;
}

const agoText = (iso: string | null, now: number) => {
  if (!iso) return "—";
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return m < 120 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ts = (iso: string) =>
  new Date(iso).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

function Bars({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const max = Math.max(1, ...values);
  return (
    <div className="flex items-end gap-[2px] h-16">
      {values.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" title={`${labels[i]}: ${v.toLocaleString()}`}>
          <div className="w-full rounded-t-sm" style={{ height: `${(v / max) * 100}%`, background: color, minHeight: v ? 2 : 0 }} />
        </div>
      ))}
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#00e5ff]/30 bg-[#001424]/60 px-3 py-2 space-y-1.5">
      <div className="text-[10px] sm:text-[11px] font-black tracking-widest text-[#00e5ff]">{title}</div>
      {children}
    </div>
  );
}

export default function GeorgiaAggregateTelemetry() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [recent, setRecent] = useState<Recent | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/ga-telemetry/recent")
        .then((r) => (r.ok ? (r.json() as Promise<Recent>) : null))
        .then((j) => alive && j && setRecent(j))
        .catch(() => undefined);
    void load();
    const poll = setInterval(load, RECENT_MS);
    const tick = setInterval(() => setNow(Date.now()), 15_000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/ga-telemetry")
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
          return j as Payload;
        })
        .then((j) => alive && (setData(j), setError(null)))
        .catch((e) => alive && setError(e instanceof Error ? e.message : String(e)));
    void load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const days = data?.byDay ?? [];
  const complete = days.slice(0, -1);
  const last7 = complete.slice(-7).reduce((a, b) => a + b.count, 0) / Math.max(1, Math.min(7, complete.length));
  const prior = complete.slice(0, -7);
  const base = prior.reduce((a, b) => a + b.count, 0) / Math.max(1, prior.length);
  const delta = base ? ((last7 - base) / base) * 100 : 0;

  return (
    <div className="w-full rounded-[28px] bg-[#050b16]/90 border border-[#00e5ff]/40 p-4 sm:p-6 font-mono text-xs space-y-3 shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e3a5f]/60 pb-2">
        <h3 className="flex items-center gap-2 text-[12px] sm:text-[13px] font-extrabold tracking-widest text-[#00e5ff] uppercase">
          <Hexagon className="w-4 h-4" /> Georgia Aggregate Telemetry · H3 Hex Grid
        </h3>
        <span className="text-[10px] text-emerald-400 font-bold">
          {data
            ? `MAP + MODELS ${ts(data.generatedAt)} · EVERY 5 MIN${recent ? ` · COUNTS ${agoText(recent.generatedAt, now)} · EVERY 1 MIN` : ""}`
            : error
              ? "FEED UNAVAILABLE"
              : "LOADING…"}
        </span>
      </div>

      {error && !data && <div className="text-[#ff80ab] text-[11px] break-all">FEED UNAVAILABLE — {error}</div>}

      {data && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-center">
            {[
              [`REPORTS · ${data.window.days} DAYS`, data.incidents.toLocaleString()],
              [`REPORTS · ${data.ytd.year} YTD`, data.ytd.total.toLocaleString()],
              ["HEX CELLS SHOWN (RES 8)", (data.hex["8"]?.features.length ?? 0).toLocaleString()],
              ["LAST 7 FULL DAYS VS PRIOR", `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%/day`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[#00e5ff]/25 bg-[#001424]/60 py-2">
                <div className="text-[9px] text-slate-400 tracking-widest">{k}</div>
                <div className="text-[15px] font-black text-white">{v}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Box title="DAILY REPORTS">
              <Bars values={days.map((d) => d.count)} labels={days.map((d) => d.date)} color="#00e5ff" />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>{days[0]?.date}</span>
                <span>{days[days.length - 1]?.date}</span>
              </div>
            </Box>
            <Box title="HOUR OF DAY (ET)">
              <Bars values={data.byHour} labels={data.byHour.map((_, h) => `${h}:00`)} color="#ff2ec4" />
              <div className="flex justify-between text-[9px] text-slate-500"><span>0h</span><span>12h</span><span>23h</span></div>
            </Box>
            <Box title="DAY OF WEEK">
              <Bars values={data.byWeekday} labels={WEEKDAYS} color="#facc15" />
              <div className="flex justify-between text-[9px] text-slate-500">{WEEKDAYS.map((d) => <span key={d}>{d}</span>)}</div>
            </Box>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Box title={`TOP CATEGORIES · ${data.window.days} DAYS`}>
              {data.byCategory.slice(0, 8).map((c) => (
                <div key={c.category} className="flex justify-between text-[11px] text-slate-200"><span>{c.category}</span><span>{c.count.toLocaleString()}</span></div>
              ))}
            </Box>
            <Box title={`TOP CATEGORIES · ${data.ytd.year} YEAR TO DATE`}>
              {data.ytd.byCategory.slice(0, 8).map((c) => (
                <div key={c.category} className="flex justify-between text-[11px] text-slate-200"><span>{c.category}</span><span>{c.count.toLocaleString()}</span></div>
              ))}
            </Box>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 text-center">
            {[
              ["REPORTS · LAST 15 MIN", recent?.counts["15"] ?? data.recent.last15m],
              ["LAST 1 H", recent?.counts["60"] ?? data.recent.last60m],
              ["LAST 3 H", recent?.counts["180"] ?? "—"],
              ["LAST 24 H", recent?.counts["1440"] ?? data.recent.last24h],
              [
                `NEWEST REPORT${recent?.latestReport ? ` · ${ts(recent.latestReport)}` : ""}`,
                agoText(recent?.latestReport ?? data.window.latestReport, now),
              ],
            ].map(([k, v]) => (
              <div key={k} className="rounded-xl border border-[#ff2ec4]/30 bg-[#1a0016]/40 py-2">
                <div className="text-[9px] text-slate-400 tracking-widest">{k}</div>
                <div className="text-[15px] font-black text-white">{typeof v === "number" ? v.toLocaleString() : v}</div>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-slate-500 -mt-1">
            Citywide APD report counts, rechecked every minute. APD adds reports to its public feed some time after they are filed, so the last
            15–60 minutes often read low and fill in on later checks.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Box title="7-DAY FORECAST · POISSON GLM">
              {data.models.poisson ? (
                <>
                  {data.models.poisson.forecast.map((f) => (
                    <div key={f.date} className="flex justify-between text-[11px] text-slate-200">
                      <span>{WEEKDAYS[f.weekday]} {f.date.slice(5)}</span>
                      <span>{Math.round(f.mean)} <span className="text-slate-500">({Math.round(f.low)}–{Math.round(f.high)})</span></span>
                    </div>
                  ))}
                  <div className="text-[9px] text-slate-500">
                    Fit on {data.models.days} days ({data.models.from} → {data.models.to}): day-of-week + linear trend.
                    Trend {(data.models.poisson.trendPerWeek * 100).toFixed(2)}%/week · dispersion {data.models.poisson.dispersion.toFixed(2)}
                    {data.models.poisson.dispersion > 1.5 ? " (overdispersed; intervals widened)" : ""}. 95% intervals.
                  </div>
                </>
              ) : (
                <div className="text-[11px] text-slate-400">Not enough daily data to fit.</div>
              )}
            </Box>
            <Box title="CHANGE-POINT · BAYESIAN POISSON-GAMMA">
              {data.models.changePoint ? (
                <div className="text-[11px] text-slate-200 space-y-1">
                  <div>Most likely shift: <b>{data.models.changePoint.date}</b></div>
                  <div>
                    {data.models.changePoint.rateBefore.toFixed(1)}/day → {data.models.changePoint.rateAfter.toFixed(1)}/day
                  </div>
                  <div>
                    Posterior probability of a shift on that day: <b>{(data.models.changePoint.probability * 100).toFixed(1)}%</b>
                  </div>
                  <div className="text-[9px] text-slate-500">
                    Single change-point, 50% prior of any change, segments of 7+ days. Low values mean no clear shift.
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-slate-400">Not enough daily data.</div>
              )}
            </Box>
            <Box title="HOT SPOTS · GETIS-ORD Gi*">
              <div className="text-[11px] text-slate-200 space-y-1">
                <div>99% confidence: <b className="text-[#ff1744]">{data.models.hotspots.cells99}</b> cells</div>
                <div>95% confidence: <b className="text-[#ff9100]">{data.models.hotspots.cells95}</b> cells</div>
                <div>90% confidence: <b>{data.models.hotspots.cells90}</b> cells</div>
                <div className="text-[9px] text-slate-500">{data.models.hotspots.method}. Outlined red/orange on the map; heatmap is a kernel density of published cell counts.</div>
              </div>
            </Box>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Box title="PRECINCT SERVICE AREAS · VORONOI · 30 DAYS">
              {data.precincts.geojson ? (
                [...data.precincts.geojson.features]
                  .sort((a, b) => b.properties.count - a.properties.count)
                  .map((f) => (
                    <div key={f.properties.name} className="flex justify-between text-[11px] text-slate-200">
                      <span>{f.properties.name}</span>
                      <span>{f.properties.count.toLocaleString()} <span className="text-slate-500">({(f.properties.share * 100).toFixed(1)}%)</span></span>
                    </div>
                  ))
              ) : (
                <div className="text-[11px] text-slate-400">Precinct layer unavailable.</div>
              )}
              <div className="text-[9px] text-slate-500">Nearest-precinct areas, an approximation; official APD zone boundaries differ.</div>
            </Box>
            <Box title="RATE PER 100K RESIDENTS · BY NPU · 30 DAYS">
              {data.rates.cityPer100k !== null && (
                <div className="text-[11px] text-white">
                  City: <b>{data.rates.cityPer100k.toFixed(0)}</b> per 100k ({data.rates.cityPopulation?.toLocaleString()} residents)
                </div>
              )}
              {data.rates.byNpu.slice(0, 8).map((r) => (
                <div key={r.npu} className="flex justify-between text-[11px] text-slate-200">
                  <span>NPU {r.npu}</span>
                  <span>{r.per100k === null ? "—" : r.per100k.toFixed(0)} <span className="text-slate-500">({r.count})</span></span>
                </div>
              ))}
              <div className="text-[9px] text-slate-500">
                Population:{" "}
                <a href={data.rates.sourceUrl} target="_blank" rel="noreferrer" className="underline">{data.rates.source}</a>. {data.rates.note}
              </div>
            </Box>
          </div>

          <Box title="DISPATCH (CAD) · AGGREGATE COUNTS">
            {data.dispatch.ok ? (
              <>
                <div className="text-[11px] text-slate-200">
                  {data.dispatch.total} calls in the public layer, {data.dispatch.from ? ts(data.dispatch.from) : "—"} → {data.dispatch.to ? ts(data.dispatch.to) : "—"}
                </div>
                {data.dispatch.to && now - new Date(data.dispatch.to).getTime() > 86_400_000 && (
                  <div className="text-[11px] font-bold text-[#ff9100]">
                    STALE: no new calls in APD&apos;s public dispatch layer for {Math.floor((now - new Date(data.dispatch.to).getTime()) / 86_400_000)} days
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  {(
                    [
                      ["Zone", data.dispatch.zone],
                      ["Priority", data.dispatch.priority],
                      ["Call source", data.dispatch.callSource],
                    ] as const
                  ).map(([label, g]) => (
                    <div key={label}>
                      <div className="text-[9px] text-slate-400 tracking-widest">{label.toUpperCase()}</div>
                      {g.rows.map((r) => (
                        <div key={r.key} className="flex justify-between text-[11px] text-slate-200">
                          <span>{r.key}</span>
                          <span>{r.count}</span>
                        </div>
                      ))}
                      {g.suppressed > 0 && <div className="text-[9px] text-slate-500">{g.suppressed} in groups under 5, withheld</div>}
                    </div>
                  ))}
                </div>
                <div className="text-[9px] text-slate-500">
                  APD publishes this layer as a snapshot, not a live feed; it has not changed since the dates above. {data.dispatch.note}{" "}
                  <a href={data.dispatch.sourceUrl} target="_blank" rel="noreferrer" className="underline">Source</a>
                </div>
              </>
            ) : (
              <div className="text-[11px] text-slate-400">Dispatch layer unavailable: {data.dispatch.error}</div>
            )}
          </Box>

          <div className="text-[10px] text-slate-400 space-y-1">
            <div>
              Source:{" "}
              <a href={data.sourceUrl} target="_blank" rel="noreferrer" className="text-[#ff2ec4] underline">{data.source}</a>
              {data.window.latestReport ? ` · newest report ${ts(data.window.latestReport)}` : ""}
            </div>
            <div>{data.coverage}</div>
            <div>
              {data.privacy.method} Withheld at res 8: {data.suppressed["8"]?.cells ?? 0} cells / {data.suppressed["8"]?.incidents ?? 0} reports.
            </div>
            <div>Reported incidents, not convictions. Not affiliated with APD or any federal agency.</div>
          </div>
        </>
      )}
    </div>
  );
}

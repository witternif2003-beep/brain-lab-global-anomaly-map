"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import type { CardBuildResult, CardFieldStatus, JurisdictionCard } from "../../lib/jurisdiction-cards/types";

const STATUS_STYLE: Record<CardFieldStatus, string> = {
  sourced: "text-[#69f0ae] border-[#00ff88]/70 bg-[#002b1b]/80 shadow-[0_0_10px_rgba(0,255,136,0.35)]",
  "awaiting-source": "text-[#ff9ee8] border-[#ff2ec4]/60 bg-[#33002a]/70 shadow-[0_0_10px_rgba(255,46,196,0.25)]",
  "not-published": "text-[#80deea] border-[#00e5ff]/40 bg-[#061836]/70",
  error: "text-[#ff80ab] border-[#ff1744]/70 bg-[#3d0014]/80 shadow-[0_0_10px_rgba(255,23,68,0.35)]"
};

const PILL = "px-3 py-1 rounded-full border font-mono font-bold uppercase tracking-wider backdrop-blur-md";

const GROUPS: Array<{ type: JurisdictionCard["type"]; label: string }> = [
  { type: "state", label: "STATES" },
  { type: "district", label: "DISTRICT" },
  { type: "territory", label: "TERRITORIES" }
];

function Card({ card }: { card: JurisdictionCard }) {
  return (
    <div
      data-testid={`card-${card.code}`}
      className="relative rounded-[28px] bg-gradient-to-br from-[#06152d]/70 via-[#030e20]/60 to-[#010712]/70 backdrop-blur-2xl border-2 border-[#00e5ff]/40 p-4 sm:p-5 space-y-3 shadow-[0_8px_40px_rgba(0,229,255,0.15),inset_0_1px_3px_rgba(0,229,255,0.3)] hover:border-[#00e5ff]/80 hover:shadow-[0_8px_50px_rgba(0,229,255,0.3)] transition-all duration-300"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-extrabold text-sm tracking-wide">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00e5ff] via-[#69f0ae] to-white">
              {card.code} — {card.name}
            </span>
          </div>
          <div className="text-[10px] text-[#80deea]/80 mt-0.5">
            FIPS {card.fips} • {card.capital} • {card.lat.toFixed(2)}, {card.lng.toFixed(2)}
          </div>
        </div>
        <span className={`${PILL} text-[9px] shrink-0 text-[#e0aaff] border-[#bd00ff]/70 bg-[#1b0833]/70 shadow-[0_0_12px_rgba(189,0,255,0.35)]`}>
          {card.sourced_count}/{card.fields.length} sourced
        </span>
      </div>
      <ul className="space-y-2">
        {card.fields.map((f) => (
          <li key={f.id} className="text-[11px] rounded-2xl bg-[#020b18]/50 border border-[#00e5ff]/20 px-3 py-2 backdrop-blur-md">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#e0f7fa] font-semibold">{f.label}</span>
              <span className={`${PILL} px-2 py-0.5 text-[8px] ${STATUS_STYLE[f.status]}`}>
                {f.status}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-[#80deea]/85">
              <span className="text-white font-bold">{f.value ?? "—"}</span>
              <span className="text-[10px]">
                {f.source_id}
                {f.as_of ? ` • ${f.as_of}` : ""}
              </span>
            </div>
            {f.status !== "sourced" && <div className="text-[10px] text-[#80deea]/85">{f.note}</div>}
            {f.provenance && (
              <div className="text-[9px] text-[#00e5ff]/85 truncate" title={f.provenance.sha256}>
                sha256 {f.provenance.sha256.slice(0, 16)}… • {f.provenance.retrieved_at}
              </div>
            )}
          </li>
        ))}
      </ul>
      {card.outliers.length > 0 && (
        <div
          className="space-y-1 rounded-2xl bg-[#1b0833]/50 border border-[#bd00ff]/50 px-3 py-2 backdrop-blur-md shadow-[0_0_14px_rgba(189,0,255,0.2)]"
          data-testid={`outliers-${card.code}`}
        >
          <div className="text-[10px] font-bold tracking-wider text-[#e0aaff]">STATISTICAL OUTLIERS (not findings)</div>
          {card.outliers.map((o) => (
            <div key={o.field_id} className="text-[10px] text-[#e0f7fa] flex justify-between gap-2">
              <span>
                {o.label}: {o.value} ({o.direction})
              </span>
              <span className="text-[#e0aaff]/85 shrink-0">
                z={o.modified_z} • median {o.median.toLocaleString("en-US")} • n={o.n}
              </span>
            </div>
          ))}
        </div>
      )}
      {card.natsec_releases.length > 0 && (
        <details
          className="text-[10px] rounded-2xl bg-[#140b00]/50 border border-[#ff2ec4]/50 px-3 py-2 backdrop-blur-md"
          data-testid={`natsec-${card.code}`}
        >
          <summary className="cursor-pointer font-bold text-[#ff9ee8]">
            DOJ national-security releases ({card.natsec_releases.length}) — charges are allegations
          </summary>
          <ul className="mt-1 space-y-1">
            {card.natsec_releases.slice(0, 10).map((r) => (
              <li key={r.url}>
                <a href={r.url} target="_blank" rel="noreferrer" className="text-[#00e5ff] hover:underline">
                  {r.title}
                </a>
                <span className="text-[#ff9ee8]/85">
                  {" "}
                  • {r.date} • {r.offices.join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
      {card.open_data_portal && (
        <a
          href={card.open_data_portal}
          target="_blank"
          rel="noreferrer"
          className={`${PILL} inline-flex items-center gap-1.5 text-[9px] text-[#00e5ff] border-[#00e5ff]/60 bg-[#041630]/70 hover:text-white hover:shadow-[0_0_16px_rgba(0,229,255,0.5)] transition-all`}
        >
          Candidate open-data portal <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}

export default function JurisdictionCardGrid() {
  const [data, setData] = useState<CardBuildResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");

  const load = (fresh: boolean) => {
    setLoading(true);
    setError(null);
    fetch(`/api/ingest/cards${fresh ? "?fresh=1" : ""}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setData(j as CardBuildResult);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "request failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(false), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cards = data?.cards ?? [];
    return q ? cards.filter((c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)) : cards;
  }, [data, query]);

  return (
    <div className="relative rounded-[32px] sm:rounded-[48px] bg-gradient-to-b from-[#051124]/80 via-[#030c1c]/75 to-[#010610]/80 backdrop-blur-3xl border-2 border-[#00e5ff]/60 p-4 sm:p-8 space-y-6 overflow-hidden font-mono shadow-[0_16px_70px_rgba(0,229,255,0.25),inset_0_1px_4px_rgba(0,229,255,0.4)]">
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-[#00e5ff]/15 rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="absolute top-1/3 left-10 w-96 h-96 bg-[#00ff88]/10 rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#bd00ff]/15 rounded-full blur-[130px] pointer-events-none -z-10" />
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex items-center gap-2 rounded-full bg-[#020b18]/60 backdrop-blur-xl border-2 border-[#00e5ff]/50 px-4 py-2.5 w-full sm:w-80 shadow-[inset_0_1px_4px_rgba(0,229,255,0.3)] focus-within:border-[#00e5ff] focus-within:shadow-[0_0_20px_rgba(0,229,255,0.4)] transition-all">
          <Search className="w-4 h-4 text-[#00e5ff]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by code or name"
            className="bg-transparent outline-none text-xs text-[#e0f7fa] placeholder:text-[#80deea]/85 w-full"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          {data && (
            <span
              title={data.outlier_method}
              className={`${PILL} text-[10px] text-[#69f0ae] border-[#00ff88]/60 bg-[#002617]/70 shadow-[0_0_12px_rgba(0,255,136,0.3)]`}
            >
              {data.count} cards • {data.summary.sourced} sourced • {data.summary["awaiting-source"]} awaiting •{" "}
              {data.summary["not-published"]} not published • {data.summary.error} errors •{" "}
              {data.cards.reduce((a, c) => a + c.outliers.length, 0)} outliers
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#003b5c]/80 to-[#002244]/80 backdrop-blur-md text-[#00e5ff] hover:text-white border-2 border-[#00e5ff] text-xs font-extrabold uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(0,229,255,0.45)] hover:shadow-[0_0_30px_rgba(0,229,255,0.7)] disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Rebuild
          </button>
        </div>
      </div>

      {error && <div className={`${PILL} w-fit text-[10px] text-[#ff80ab] border-[#ff1744]/70 bg-[#3d0014]/80`}>Card build failed: {error}</div>}
      {!data && loading && <div className="text-[#80deea] text-xs animate-pulse">Building 56 cards from live sources…</div>}

      {data &&
        GROUPS.map((g) => {
          const cards = filtered.filter((c) => c.type === g.type);
          if (cards.length === 0) return null;
          return (
            <section key={g.type} className="space-y-3">
              <h2 className={`${PILL} w-fit text-[10px] tracking-[0.2em] text-[#e0aaff] border-2 border-[#bd00ff]/70 bg-gradient-to-r from-[#2a0845]/80 to-[#1b003a]/80 shadow-[0_0_16px_rgba(189,0,255,0.4)]`}>
                {g.label} ({cards.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {cards.map((c) => (
                  <Card key={c.code} card={c} />
                ))}
              </div>
            </section>
          );
        })}
    </div>
  );
}

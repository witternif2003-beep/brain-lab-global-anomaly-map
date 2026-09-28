"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import type { CardBuildResult, CardFieldStatus, JurisdictionCard } from "../../lib/jurisdiction-cards/types";

const STATUS_STYLE: Record<CardFieldStatus, string> = {
  sourced: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  "awaiting-source": "text-amber-300 border-amber-500/40 bg-amber-500/10",
  "not-published": "text-slate-300 border-slate-500/40 bg-slate-500/10",
  error: "text-rose-300 border-rose-500/40 bg-rose-500/10"
};

const GROUPS: Array<{ type: JurisdictionCard["type"]; label: string }> = [
  { type: "state", label: "STATES" },
  { type: "district", label: "DISTRICT" },
  { type: "territory", label: "TERRITORIES" }
];

function Card({ card }: { card: JurisdictionCard }) {
  return (
    <div data-testid={`card-${card.code}`} className="glass-card rounded-xl border border-white/10 p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sky-300 font-bold text-sm">
            {card.code} — {card.name}
          </div>
          <div className="text-[10px] text-slate-400">
            FIPS {card.fips} • {card.capital} • {card.lat.toFixed(2)}, {card.lng.toFixed(2)}
          </div>
        </div>
        <div className="text-[10px] text-slate-400 text-right shrink-0">
          {card.sourced_count}/{card.fields.length} sourced
        </div>
      </div>
      <ul className="space-y-1.5">
        {card.fields.map((f) => (
          <li key={f.id} className="text-[11px]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-300">{f.label}</span>
              <span className={`px-1.5 py-0.5 rounded border text-[9px] uppercase ${STATUS_STYLE[f.status]}`}>
                {f.status}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-slate-400">
              <span className="text-slate-100 font-semibold">{f.value ?? "—"}</span>
              <span className="text-[10px]">
                {f.source_id}
                {f.as_of ? ` • ${f.as_of}` : ""}
              </span>
            </div>
            {f.status !== "sourced" && <div className="text-[10px] text-slate-500">{f.note}</div>}
            {f.provenance && (
              <div className="text-[9px] text-slate-600 truncate" title={f.provenance.sha256}>
                sha256 {f.provenance.sha256.slice(0, 16)}… • {f.provenance.retrieved_at}
              </div>
            )}
          </li>
        ))}
      </ul>
      {card.open_data_portal && (
        <a
          href={card.open_data_portal}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-sky-400 hover:underline"
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex items-center gap-2 glass-card rounded-lg border border-white/10 px-3 py-2 w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by code or name"
            className="bg-transparent outline-none text-xs text-slate-200 w-full"
          />
        </div>
        <div className="flex items-center gap-3 text-[11px] text-slate-400">
          {data && (
            <span>
              {data.count} cards • {data.summary.sourced} sourced • {data.summary["awaiting-source"]} awaiting •{" "}
              {data.summary["not-published"]} not published • {data.summary.error} errors
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-sky-500/40 text-sky-300 hover:bg-sky-500/10 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Rebuild
          </button>
        </div>
      </div>

      {error && <div className="text-rose-300 text-xs">Card build failed: {error}</div>}
      {!data && loading && <div className="text-slate-400 text-xs">Building 56 cards from live sources…</div>}

      {data &&
        GROUPS.map((g) => {
          const cards = filtered.filter((c) => c.type === g.type);
          if (cards.length === 0) return null;
          return (
            <section key={g.type} className="space-y-2">
              <h2 className="text-[11px] tracking-[0.2em] text-slate-400">
                {g.label} ({cards.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
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

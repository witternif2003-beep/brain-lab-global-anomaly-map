"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, RefreshCw, Search } from "lucide-react";
import type { FederalRegistry, RegistryEntity } from "../../lib/federal-registry/registry";
import type { CardFieldStatus } from "../../lib/jurisdiction-cards/types";
import { HANDBOOK_SEED_CAVEAT, HANDBOOK_SOURCE_URL } from "../../lib/jurisdiction-feeds/handbook-seed";

const STATUS_STYLE: Record<CardFieldStatus, string> = {
  sourced: "text-[#69f0ae] border-[#00ff88]/70 bg-[#002b1b]/80 shadow-[0_0_10px_rgba(0,255,136,0.35)]",
  "awaiting-source": "text-[#ffd54f] border-[#ffaa00]/60 bg-[#331e00]/70 shadow-[0_0_10px_rgba(255,170,0,0.25)]",
  "not-published": "text-[#80deea] border-[#00e5ff]/40 bg-[#061836]/70",
  error: "text-[#ff80ab] border-[#ff1744]/70 bg-[#3d0014]/80 shadow-[0_0_10px_rgba(255,23,68,0.35)]"
};

const PILL = "px-3 py-1 rounded-full border font-mono font-bold uppercase tracking-wider backdrop-blur-md";

const GROUPS: Array<{ branch: string; label: string }> = [
  { branch: "executive", label: "EXECUTIVE DEPARTMENTS" },
  { branch: "independent", label: "INDEPENDENT AGENCIES & COMMISSIONS" },
  { branch: "gse", label: "GOVERNMENT-SPONSORED ENTERPRISES" }
];

function EntityCard({ entity }: { entity: RegistryEntity }) {
  return (
    <div
      id={entity.id}
      data-testid={`registry-${entity.id}`}
      className="relative rounded-[24px] bg-gradient-to-br from-[#06152d]/70 via-[#030e20]/60 to-[#010712]/70 backdrop-blur-2xl border-2 border-[#bd00ff]/40 p-4 space-y-2.5 shadow-[0_8px_40px_rgba(189,0,255,0.15)] hover:border-[#bd00ff]/80 transition-all duration-300 scroll-mt-24"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-extrabold text-xs tracking-wide text-[#e0f7fa]">{entity.name}</div>
          <div className="text-[10px] text-[#80deea]/80 mt-0.5">
            {entity.branch} • {entity.category}
          </div>
        </div>
        <span className={`${PILL} px-2 py-0.5 text-[8px] shrink-0 ${STATUS_STYLE[entity.status]}`}>{entity.status}</span>
      </div>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-white font-bold">{entity.status === "sourced" ? entity.note : "—"}</span>
        {entity.sources.length > 0 && <span className="text-[9px] text-[#80deea]/70 shrink-0">{entity.sources.join(" + ")}</span>}
      </div>
      {entity.status !== "sourced" && <div className="text-[10px] text-[#80deea]/50">{entity.note}</div>}
      {entity.provenance && (
        <div className="text-[9px] text-[#00e5ff]/40 truncate" title={entity.provenance.sha256}>
          sha256 {entity.provenance.sha256.slice(0, 16)}… • {entity.provenance.retrieved_at}
        </div>
      )}
      {entity.fr_recent.length > 0 && (
        <details className="text-[10px] rounded-2xl bg-[#140b00]/50 border border-[#ffaa00]/50 px-3 py-2 backdrop-blur-md">
          <summary className="cursor-pointer font-bold text-[#ffd54f]">
            Newest Federal Register documents ({entity.fr_recent.length})
          </summary>
          <ul className="mt-1 space-y-1">
            {entity.fr_recent.map((d) => (
              <li key={d.url}>
                <a href={d.url} target="_blank" rel="noreferrer" className="text-[#00e5ff] hover:underline">
                  {d.title}
                </a>
                <span className="text-[#ffd54f]/60">
                  {" "}
                  • {d.doc_type} • {d.date}
                </span>
              </li>
            ))}
          </ul>
          {entity.docs_provenance && (
            <div className="text-[9px] text-[#00e5ff]/40 truncate mt-1" title={entity.docs_provenance.sha256}>
              docs sha256 {entity.docs_provenance.sha256.slice(0, 16)}… • {entity.docs_provenance.retrieved_at}
            </div>
          )}
        </details>
      )}
    </div>
  );
}

export default function FederalRegistryGrid() {
  const [data, setData] = useState<FederalRegistry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [query, setQuery] = useState<string>("");

  const load = (fresh: boolean) => {
    setLoading(true);
    setError(null);
    fetch(`/api/ingest/federal-registry${fresh ? "?fresh=1" : ""}`, { cache: "no-store" })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? `HTTP ${r.status}`);
        setData(j as FederalRegistry);
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "request failed"))
      .finally(() => setLoading(false));
  };

  useEffect(() => load(false), []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const entities = data?.entities ?? [];
    return q ? entities.filter((x) => x.id.toLowerCase().includes(q) || x.name.toLowerCase().includes(q)) : entities;
  }, [data, query]);

  return (
    <div className="relative rounded-[32px] sm:rounded-[48px] bg-gradient-to-b from-[#051124]/80 via-[#030c1c]/75 to-[#010610]/80 backdrop-blur-3xl border-2 border-[#bd00ff]/60 p-4 sm:p-8 space-y-6 overflow-hidden font-mono shadow-[0_16px_70px_rgba(189,0,255,0.25)]">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
        <div className="flex items-center gap-2 rounded-full bg-[#020b18]/60 backdrop-blur-xl border-2 border-[#bd00ff]/50 px-4 py-2.5 w-full sm:w-80 focus-within:border-[#bd00ff] transition-all">
          <Search className="w-4 h-4 text-[#e0aaff]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by id or name"
            className="bg-transparent outline-none text-xs text-[#e0f7fa] placeholder:text-[#80deea]/50 w-full"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3 text-[11px]">
          {data && (
            <span className={`${PILL} text-[10px] text-[#69f0ae] border-[#00ff88]/60 bg-[#002617]/70`}>
              {data.count} entities • {data.live_count} live • {data.fy_label} • {data.generated_at.slice(0, 10)}
            </span>
          )}
          <button
            onClick={() => load(true)}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#2a0845]/80 to-[#1b003a]/80 backdrop-blur-md text-[#e0aaff] hover:text-white border-2 border-[#bd00ff] text-xs font-extrabold uppercase tracking-wider transition-all duration-300 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Rebuild
          </button>
        </div>
      </div>

      {error && <div className={`${PILL} w-fit text-[10px] text-[#ff80ab] border-[#ff1744]/70 bg-[#3d0014]/80`}>Registry build failed: {error}</div>}
      {!data && loading && <div className="text-[#80deea] text-xs animate-pulse">Building federal registry from live sources…</div>}

      {data &&
        GROUPS.map((g) => {
          const list = filtered.filter((x) => x.branch === g.branch);
          if (list.length === 0) return null;
          return (
            <section key={g.branch} className="space-y-3">
              <h2 className={`${PILL} w-fit text-[10px] tracking-[0.2em] text-[#e0aaff] border-2 border-[#bd00ff]/70 bg-gradient-to-r from-[#2a0845]/80 to-[#1b003a]/80`}>
                {g.label} ({list.length})
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map((x) => (
                  <EntityCard key={x.id} entity={x} />
                ))}
              </div>
            </section>
          );
        })}

      <div className="text-[10px] text-[#80deea]/50 flex flex-wrap items-center gap-1">
        <span>Directory: {HANDBOOK_SEED_CAVEAT}</span>
        <a href={HANDBOOK_SOURCE_URL} target="_blank" rel="noreferrer" className="text-[#00e5ff] hover:underline inline-flex items-center gap-1">
          archive.org record <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </div>
  );
}

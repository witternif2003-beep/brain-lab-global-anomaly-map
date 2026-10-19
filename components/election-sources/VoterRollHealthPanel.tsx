"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Download, ShieldCheck } from "lucide-react";
import type { Map as MapLibreMap, MapGeoJSONFeature } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  COUNTY_FILL_MIN_ZOOM,
  COUNTY_LABEL_MIN_ZOOM,
  INK,
  INSUFFICIENT_LABEL,
  METRICS,
  colorFor,
  fillExpression,
  formatMetric,
  legend,
  type MetricKey
} from "../../lib/elections/voter-roll-health";
import { VOTER_ROLL_HEALTH_META, VOTER_ROLL_HEALTH_STATES } from "../../lib/elections/voter-roll-health-2024";

const META = VOTER_ROLL_HEALTH_META;
const GLYPHS = "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf";
const n = (v: number | null) => (v === null ? INSUFFICIENT_LABEL : v.toLocaleString("en-US"));
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function popupHtml(p: Record<string, unknown>): string {
  const num = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : null);
  const rows: [string, string][] = [
    ["Registered (A1a)", n(num("t"))],
    ["Active (A1b)", n(num("a"))],
    ["Inactive (A1c)", n(num("i"))],
    ["Removed 2022–24 (A12a)", n(num("r"))],
    ["CVAP estimate", num("c") === null ? INSUFFICIENT_LABEL : `${n(num("c"))} ± ${n(num("cm"))}`],
    ...METRICS.map((m) => [m.label, formatMetric(num(m.key), m.unit)] as [string, string])
  ];
  return `<div style="font:12px/1.4 ui-monospace,monospace;color:${INK};min-width:220px">
    <div style="font-weight:800;font-size:13px">${esc(String(p.n))}, ${esc(String(p.s))}</div>
    <div style="color:#334">FIPS ${esc(String(p.g))} · ${esc(String(p.u))} EAVS unit(s)</div>
    <table style="margin-top:4px">${rows.map(([k, v]) => `<tr><td style="padding-right:8px;color:#334">${k}</td><td style="font-weight:700">${esc(v)}</td></tr>`).join("")}</table>
    ${p.q ? `<div style="margin-top:4px;color:#7a2e00">${esc(String(p.q))}</div>` : ""}
  </div>`;
}

export default function VoterRollHealthPanel() {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [metric, setMetric] = useState<MetricKey>("ar");
  const [error, setError] = useState<string | null>(null);
  const spec = METRICS.find((m) => m.key === metric) ?? METRICS[0];

  useEffect(() => {
    let cancelled = false;
    let map: MapLibreMap | null = null;
    (async () => {
      const maplibregl = await import("maplibre-gl");
      if (cancelled || !ref.current) return;
      maplibregl.setWorkerUrl(`/maplibre-gl-worker.mjs?v=${maplibregl.getVersion()}`);
      map = new maplibregl.Map({
        container: ref.current,
        style: { version: 8, glyphs: GLYPHS, sources: {}, layers: [{ id: "bg", type: "background", paint: { "background-color": INK } }] },
        bounds: [[-125, 24], [-66.5, 49.5]],
        fitBoundsOptions: { padding: 8 },
        minZoom: 1.5,
        maxZoom: 10,
        attributionControl: { compact: true, customAttribution: "EAC 2024 EAVS · Census CVAP 2020–2024 · Census cartographic boundaries 2024" }
      });
      mapRef.current = map;
      (window as unknown as { __vrhMap?: MapLibreMap }).__vrhMap = map;
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("error", (e) => setError(e.error?.message ?? "Map error"));
      map.on("load", () => {
        if (!map) return;
        ref.current?.querySelector(".maplibregl-ctrl-attrib")?.classList.remove("maplibregl-compact-show");
        const m0 = METRICS[0];
        map.addSource("vrh", { type: "geojson", data: META.outputs.geojson.path, attribution: "" });
        map.addLayer({
          id: "vrh-state-fill", type: "fill", source: "vrh", maxzoom: COUNTY_FILL_MIN_ZOOM,
          paint: { "fill-color": fillExpression({ ...m0, key: ("s" + m0.key) as MetricKey }) as never, "fill-opacity": 0.95 }
        });
        map.addLayer({
          id: "vrh-county-fill", type: "fill", source: "vrh", minzoom: COUNTY_FILL_MIN_ZOOM,
          paint: { "fill-color": fillExpression(m0) as never, "fill-opacity": 0.95 }
        });
        map.addLayer({
          id: "vrh-county-line", type: "line", source: "vrh", minzoom: COUNTY_FILL_MIN_ZOOM,
          paint: { "line-color": INK, "line-opacity": 0.55, "line-width": ["interpolate", ["linear"], ["zoom"], 4.5, 0.3, 8, 1.2] }
        });
        map.addLayer({
          id: "vrh-county-label", type: "symbol", source: "vrh", minzoom: COUNTY_LABEL_MIN_ZOOM,
          layout: {
            "text-field": ["concat", ["get", "n"], "\n", ["case", ["==", ["typeof", ["get", "ar"]], "number"], ["concat", ["to-string", ["get", "ar"]], "%"], INSUFFICIENT_LABEL]],
            "text-font": ["Open Sans Semibold"],
            "text-size": ["interpolate", ["linear"], ["zoom"], 6, 11, 9, 14],
            "text-max-width": 8,
            "text-allow-overlap": false,
            "text-padding": 4
          },
          paint: { "text-color": INK, "text-halo-color": "#FFFFFF", "text-halo-width": 1.6 }
        });
        const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "300px" });
        const show = (e: { features?: MapGeoJSONFeature[]; lngLat: { lng: number; lat: number } }) => {
          const f = e.features?.[0];
          if (f && map) popup.setLngLat(e.lngLat).setHTML(popupHtml(f.properties)).addTo(map);
        };
        map.on("click", "vrh-county-fill", show);
        map.on("click", "vrh-state-fill", show);
      });
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
      map?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const apply = () => {
      if (!map?.getLayer("vrh-county-fill")) return;
      map.setPaintProperty("vrh-county-fill", "fill-color", fillExpression(spec) as never);
      map.setPaintProperty("vrh-state-fill", "fill-color", fillExpression({ ...spec, key: ("s" + spec.key) as MetricKey }) as never);
      const unit = spec.key === "rm" ? "/1k" : "%";
      map.setLayoutProperty("vrh-county-label", "text-field", [
        "concat", ["get", "n"], "\n",
        ["case", ["==", ["typeof", ["get", spec.key]], "number"], ["concat", ["to-string", ["get", spec.key]], unit], INSUFFICIENT_LABEL]
      ]);
    };
    if (map?.isStyleLoaded()) apply();
    else map?.once("load", apply);
  }, [spec]);

  const rows = useMemo(() => VOTER_ROLL_HEALTH_STATES, []);
  const s = META.summary;

  return (
    <section className="rounded-3xl border-2 border-[#99DDFF]/70 bg-[#0B0E14] p-4 sm:p-6 space-y-4 text-[#E8F4FF]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="px-3 py-1 rounded-full bg-[#ADE4FF] text-[#0B0E14] text-[11px] font-black uppercase tracking-wider">Aggregate only · zero PII</span>
        <span className="px-3 py-1 rounded-full bg-[#92BBE4] text-[#0B0E14] text-[11px] font-black uppercase tracking-wider">EAC EAVS 2024 ÷ Census CVAP 2020–2024</span>
      </div>
      <h2 className="text-lg sm:text-2xl font-black uppercase tracking-wide text-[#ADE4FF]">Voter-Roll Health — county aggregates</h2>
      <p className="text-[13px] leading-relaxed text-[#D6ECFF]">
        Counts are the official totals each election jurisdiction reported to the U.S. Election Assistance Commission for the
        November 2024 general election, summed to counties. The denominator is the Census Bureau&apos;s citizen voting-age
        population estimate. No voter file, name, initial, ID, address or individual citizenship status is used. Where a
        figure is not reported, or a reporting unit cannot be assigned to one county, the area shows <b>{INSUFFICIENT_LABEL}</b> —
        nothing is estimated or filled in.
      </p>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Metric">
        {METRICS.map((m) => (
          <button
            key={m.key}
            role="tab"
            aria-selected={m.key === metric}
            onClick={() => setMetric(m.key)}
            className={`px-3 py-2 rounded-xl text-[13px] font-bold border-2 ${m.key === metric ? "bg-[#ADE4FF] text-[#0B0E14] border-[#ADE4FF]" : "bg-transparent text-[#ADE4FF] border-[#ADE4FF]/60"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-[#D6ECFF]">{spec.formula}. States below zoom {COUNTY_FILL_MIN_ZOOM}, counties above; county labels from zoom {COUNTY_LABEL_MIN_ZOOM}. Tap an area for its figures.</p>

      <div className="relative h-[420px] sm:h-[520px] rounded-2xl overflow-hidden border border-[#ADE4FF]/40">
        <div ref={ref} data-testid="voter-roll-health-map" className="absolute inset-0" />
        {error && <div className="absolute inset-x-2 top-2 rounded-lg bg-[#F1A085] text-[#0B0E14] text-[12px] font-bold p-2">Map unavailable: {error}</div>}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[12px]" aria-label="Legend">
        {legend(spec).map((l) => (
          <div key={l.label} className="flex items-center gap-2">
            <span className="inline-block w-4 h-4 rounded" style={{ background: l.color }} />
            <span className="text-[#F2F8FF] font-semibold">{l.label}</span>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-[#D6ECFF]">
        Coverage: {s.countiesWithActiveRate.toLocaleString()} of {s.counties.toLocaleString()} counties have an active-registration rate,{" "}
        {s.countiesWithInactiveRate.toLocaleString()} an inactive rate and {s.countiesWithRemovalRate.toLocaleString()} a removal rate.
        Rates above 100% are expected in some places: CVAP is a 5-year survey estimate with a margin of error, and
        federal law (NVRA) requires notice and a waiting period of up to two federal elections before a moved voter is removed. A
        high rate is not by itself evidence of ineligible registrations. Where a state does not keep an inactive list, EAVS A1b
        equals the total.
      </p>

      <div className="overflow-x-auto rounded-2xl border border-[#ADE4FF]/40">
        <table className="min-w-full text-[13px]">
          <thead className="bg-[#ADE4FF] text-[#0B0E14]">
            <tr>
              {["Jurisdiction", "Registered", "Active", "CVAP", "Active ÷ CVAP", "Inactive", "Removed /1k", "Counties w/ rate", "Data note"].map((h) => (
                <th key={h} className="px-2 py-2 text-left font-black whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.fips} className="border-t border-[#ADE4FF]/20">
                <td className="px-2 py-1.5 font-bold whitespace-nowrap">{r.geography} ({r.state})</td>
                <td className="px-2 py-1.5">{n(r.registered_total)}</td>
                <td className="px-2 py-1.5">{n(r.active)}</td>
                <td className="px-2 py-1.5">{n(r.cvap_est)}</td>
                {(["active_pct_cvap", "inactive_pct", "removed_per_1000_active"] as const).map((k, i) => (
                  <td key={k} className="px-2 py-1.5">
                    <span className="px-1.5 py-0.5 rounded font-bold text-[#0B0E14]" style={{ background: colorFor(r[k], METRICS[i].breaks) }}>
                      {formatMetric(r[k], METRICS[i].unit)}
                    </span>
                  </td>
                ))}
                <td className="px-2 py-1.5">{r.counties ? `${r.counties_with_rate}/${r.counties}` : "—"}</td>
                <td className="px-2 py-1.5 text-[#D6ECFF] min-w-[200px]">{r.data_note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-2xl border-2 border-[#69C9AD]/60 p-3 space-y-2 text-[12px]">
        <div className="flex items-center gap-2 font-black uppercase text-[#C9D65C]"><ShieldCheck className="w-4 h-4" /> Data provenance</div>
        {Object.entries(META.sources).map(([k, src]) => (
          <div key={k} className="break-all">
            <a className="font-bold text-[#ADE4FF] underline" href={src.landingUrl} target="_blank" rel="noreferrer">{src.publisher} — {src.title}</a>
            <div className="text-[#D6ECFF]">{src.vintage}. Retrieved {src.retrieved}. File: <a className="underline" href={src.url}>{src.url.split("/").pop()}</a></div>
            <div className="font-mono text-[#F2F8FF]">SHA-256 {src.sha256}</div>
          </div>
        ))}
        <div className="break-all">
          <div className="font-bold text-[#C9D65C]">Joined aggregate CSV ({META.outputs.csv.bytes.toLocaleString()} bytes)</div>
          <div className="font-mono text-[#F2F8FF]">SHA-256 {META.outputs.csv.sha256}</div>
          <div className="text-[#D6ECFF]">Built by scripts/build-voter-roll-health.py. EAVS units: {s.eavsUnits.toLocaleString()} ({s.eavsUnitsStateOnly} statewide-only, {s.eavsUnitsUnmatched} not in the Census crosswalk).</div>
        </div>
        <a href={META.outputs.csv.path} download className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-[#C9D65C] text-[#0B0E14] font-black">
          <Download className="w-4 h-4" /> Download raw aggregate CSV
        </a>
      </div>
    </section>
  );
}

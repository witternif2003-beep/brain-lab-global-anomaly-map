import React from "react";
import { Boxes, ExternalLink, Orbit } from "lucide-react";
import { DIGITAL_TWIN_SOURCE_LINKS } from "../lib/whitehouse-digital-twin";

// Verified 2026-09-27: Sketchfab podium model page + /embed endpoint both live.
// HONESTY: this is the press podium / lectern furnishing prop (24.3k tris),
// NOT a full-building twin — labeled as prop-scale reference only.
const SKETCHFAB_EMBED_URL =
  "https://sketchfab.com/models/1a14e0f7285344c79d6c5d15f7f46113/embed";
const SKETCHFAB_PAGE_URL =
  "https://sketchfab.com/3d-models/podium-the-white-house-usa-pbr-textured-3d-model-1a14e0f7285344c79d6c5d15f7f46113";

const TOUR_LINK_IDS = ["WHHA-360-VIRTUAL", "WHHA-PEOPLES-HOUSE", "LOC-HABS-DC37"];

export default function WhiteHouseReal3DViewer() {
  const tours = DIGITAL_TWIN_SOURCE_LINKS.filter((l) => TOUR_LINK_IDS.includes(l.id));

  return (
    <div className="rounded-2xl bg-[#020b18]/95 border-2 border-[#bd00ff]/40 p-4 sm:p-5 space-y-4 shadow-xl font-mono">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#bd00ff]/25 pb-3">
        <div className="flex items-center gap-2 text-[#e0aaff] font-bold text-xs sm:text-sm tracking-wide">
          <Boxes className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
          <span>REAL 3D MODEL VIEWER — VERIFIED EXTERNAL ASSETS</span>
        </div>
        <span className="px-2.5 py-1 rounded bg-[#bd00ff]/10 text-[#e0aaff] text-[9px] sm:text-[10px] font-bold border border-[#bd00ff]/40">
          INTERACTIVE • DRAG TO ORBIT • SCROLL TO ZOOM
        </span>
      </div>

      {/* Live Sketchfab embed: genuine interactive 3D with zoom */}
      <div className="rounded-xl overflow-hidden border border-[#bd00ff]/30 bg-black">
        <iframe
          title="White House Podium — verified Sketchfab PBR 3D model"
          src={SKETCHFAB_EMBED_URL}
          allow="autoplay; fullscreen; xr-spatial-tracking"
          allowFullScreen
          loading="lazy"
          className="w-full h-[340px] sm:h-[440px] block"
        />
      </div>
      <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
        <span className="text-[#e0aaff] font-bold">Honest scope: </span>
        press podium / lectern furnishing prop (24.3k triangles, PBR BaseColor / Metalness /
        Roughness / Normal) by Niccolò Bottacin — interior prop-scale reference only. Full-room
        photorealistic geometry comes from the WHHA 360° Matterport walkthrough linked below.{" "}
        <a
          href={SKETCHFAB_PAGE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#00e5ff] hover:text-white font-bold inline-flex items-center gap-1"
        >
          Open model page <ExternalLink className="w-3 h-3" />
        </a>
      </p>

      {/* Real-3D walkthrough link-outs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {tours.map((t) => (
          <a
            key={t.id}
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-3 rounded-xl bg-[#031528]/80 border border-[#00e5ff]/35 hover:border-[#00e5ff] transition-all space-y-1.5 group"
          >
            <div className="flex items-center gap-1.5 text-[#00e5ff] font-bold text-[11px] sm:text-xs">
              <Orbit className="w-3.5 h-3.5 shrink-0" />
              <span className="leading-snug">{t.label}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] sm:text-[10px] text-[#69f0ae] font-bold">
                ✓ VERIFIED {t.verified}
              </span>
              <span className="text-[#00e5ff] group-hover:text-white inline-flex items-center gap-1 text-[10px] font-bold">
                Open <ExternalLink className="w-3 h-3" />
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

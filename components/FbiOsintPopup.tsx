"use client";
import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import FbiOsintBrowser from "./FbiOsintBrowser";
import { OSINT_OPEN_EVENT, type OsintOpenDetail } from "../lib/ga-osint-geo-layer";

/** Map-toolbar button that opens the FBI OSINT indicator browser as a semi-transparent popup over the map. */
export default function FbiOsintPopup() {
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState<OsintOpenDetail | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      setCountry((e as CustomEvent<OsintOpenDetail>).detail);
      setOpen(true);
    };
    window.addEventListener(OSINT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(OSINT_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wider border bg-[#070d18]/90 text-[#f472b6] border-[#f472b6]/60 hover:border-[#f472b6]"
      >
        FBI OSINT
      </button>
      {open && createPortal(
        <div className="fixed inset-2 sm:inset-x-10 sm:top-20 sm:bottom-10 z-[1000] flex flex-col rounded-2xl border border-[#f472b6]/40 bg-[#070e1c]/55 backdrop-blur-md shadow-[0_12px_36px_rgba(0,0,0,0.6)] p-3 text-left">
          <div className="flex items-center justify-between pb-2">
            <div className="text-[11px] font-black tracking-wider text-[#f472b6]">FBI-RELEVANT PUBLIC OSINT · SEARCH</div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-slate-300 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto">
            <FbiOsintBrowser compact country={country} onClearCountry={() => setCountry(null)} />
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

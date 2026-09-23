"use client";
import React from "react";
import Image from "next/image";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-[#0b1320] border-t border-[#28394e] text-[#94a3b8] text-xs font-mono mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-6 border-b border-[#28394e]">
          
          {/* Brand Col */}
          <div className="space-y-3 md:col-span-1">
            <div className="flex items-center space-x-3">
              <div
                className="relative shrink-0 rounded-full flex items-center justify-center"
                style={{
                  width: '36px',
                  height: '36px',
                  minWidth: '36px',
                  minHeight: '36px',
                  maxWidth: '36px',
                  maxHeight: '36px',
                  aspectRatio: '1 / 1',
                  borderRadius: '50%',
                  flexShrink: 0,
                  filter: 'drop-shadow(0 0 8px rgba(56,189,248,0.65))',
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                }}
              >
                <Image
                  src="/assets/brain-lab-emblem-official.png"
                  alt="Central Intelligence Agency Official Seal"
                  width={36}
                  height={36}
                  style={{
                    width: '36px',
                    height: '36px',
                    minWidth: '36px',
                    minHeight: '36px',
                    objectFit: 'contain',
                    aspectRatio: '1 / 1',
                    borderRadius: '50%',
                    display: 'block',
                  }}
                  className="rounded-full"
                />
              </div>
              <span className="font-bold text-[#f8fafc] text-sm tracking-wider font-mono">
                BRAIN LAB <span className="text-[#38bdf8] text-xs font-bold">BY LILIYA</span>
              </span>
            </div>
            <p className="text-[11px] text-[#94a3b8] leading-relaxed font-sans">
              Post-Doctorate Cognitive Market Intelligence & Microstructure Research
            </p>
          </div>

          {/* Quick Links */}
          <div className="space-y-2">
            <div className="text-[#f8fafc] font-semibold text-xs tracking-wider">INTELLIGENCE SURFACES</div>
            <ul className="space-y-1 text-[11px]">
              <li><Link href="/" className="hover:text-[#38bdf8]">Live Telemetry Dashboard</Link></li>
              <li><Link href="/recommendations-hub" className="hover:text-[#38bdf8]">P1 Recommendations Hub</Link></li>
              <li><Link href="/forensic-telemetry" className="hover:text-[#38bdf8]">7k Telemetry Streams</Link></li>
              <li><Link href="/three-pillars" className="hover:text-[#38bdf8]">3 Pillars Executive Analysis</Link></li>
              <li><Link href="/godseye-telemetry" className="hover:text-[#38bdf8]">GodsEYE Common Operating Picture</Link></li>
              <li><Link href="/threat-globe" className="hover:text-[#38bdf8]">3D Interactive Threat Globe</Link></li>
            </ul>
          </div>

          {/* Verification & Method */}
          <div className="space-y-2">
            <div className="text-[#f8fafc] font-semibold text-xs tracking-wider">VERIFICATION ENGINES</div>
            <ul className="space-y-1 text-[11px]">
              <li><Link href="/benchmarks" className="hover:text-[#38bdf8]">ML Telemetry & Benchmarks</Link></li>
              <li><Link href="/county-matrix" className="hover:text-[#38bdf8]">Georgia 159-County Matrix</Link></li>
              <li><Link href="/bot-pipeline" className="hover:text-[#38bdf8]">Discovery Bot Pipeline</Link></li>
              <li><Link href="/sources" className="hover:text-[#38bdf8]">100+ Data Streams Directory</Link></li>
              <li><Link href="/evidence" className="hover:text-[#38bdf8]">Evidence Locker & Proofs</Link></li>
              <li><Link href="/methodology" className="hover:text-[#38bdf8]">Cognitive Defense Methodology</Link></li>
            </ul>
          </div>

          {/* Compliance Column */}
          <div className="space-y-2">
            <div className="text-[#f8fafc] font-semibold text-xs tracking-wider">STATUTORY GOVERNANCE</div>
            <div className="bg-[#131d2c] border border-[#28394e] p-2.5 rounded-lg text-[10px] space-y-1 leading-normal text-[#cbd5e1]">
              <div className="text-[#38bdf8] font-bold">MANDATORY NOTICE:</div>
              <p>Emblem used for identification purposes only. Not affiliated with any government agency.</p>
              <p className="text-[#94a3b8]">All data is public-record open-source only. No government endorsement implied.</p>
            </div>
          </div>

        </div>

        {/* Bottom copyright and disclaimers */}
        <div className="flex flex-col sm:flex-row items-center justify-between text-[11px] text-[#94a3b8] gap-2">
          <div>
            &copy; 2026 Brain Lab by Liliya. All rights reserved.
          </div>
          <div className="flex items-center space-x-4">
            <span className="text-[#38bdf8]">Admiralty System A1/A2 Certified</span>
            <span>&bull;</span>
            <span className="text-[#10b981]">Validation Gated Continual Learning</span>
            <span>&bull;</span>
            <span className="text-[#fb923c]">Non-Parametric Dynamic Thresholding</span>
          </div>
        </div>

      </div>
    </footer>
  );
}

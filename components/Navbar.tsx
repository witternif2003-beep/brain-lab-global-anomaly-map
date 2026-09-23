"use client";
import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
  Activity,
  ShieldAlert,
  Cpu,
  FileCheck,
  Layers,
  Radio,
  FileText,
  Globe,
  Bell,
  Bot,
  Eye,
  Zap,
  Compass,
  Target,
  Radar,
  Award,
  Menu,
  X
} from "lucide-react";

export default function Navbar() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navLinks = [
    { href: "/", label: "Dashboard", icon: Activity },
    { href: "/recommendations-hub", label: "P1 Recs Hub", icon: Award },
    { href: "/forensic-telemetry", label: "7k Telemetry", icon: Radar },
    { href: "/three-pillars", label: "3 Pillars", icon: Target },
    { href: "/godseye-telemetry", label: "GodsEYE Map", icon: Eye },
    { href: "/threat-globe", label: "3D Globe", icon: Globe },
    { href: "/benchmarks", label: "ML Telemetry", icon: Zap },
    { href: "/county-matrix", label: "159 Counties", icon: Compass },
    { href: "/anomalies", label: "Anomalies", icon: ShieldAlert },
    { href: "/insider-intel", label: "Insider Intel", icon: Cpu },
    { href: "/alerts", label: "Alerts", icon: Bell },
    { href: "/bot-pipeline", label: "Bot Pipeline", icon: Bot },
    { href: "/sources", label: "Sources", icon: Radio },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/evidence", label: "Evidence", icon: Layers },
    { href: "/methodology", label: "Methodology", icon: FileCheck },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#070c14]/80 backdrop-blur-xl border-b border-white/10 text-[#f1f5f9]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          
          {/* Official NSA / CIA Admin Standards Header Seal & Typography Protocol */}
          <div className="flex items-center space-x-3.5 shrink-0 py-1">
            <Link href="/" className="flex items-center space-x-3 group">
              {/* CIA / NSA Admin Approved 48px Header Seal with Precision Gold-Cyan Double Bezel */}
              <div
                className="relative w-12 h-12 shrink-0 rounded-full overflow-hidden flex items-center justify-center shadow-[0_0_20px_rgba(56,189,248,0.45)] transition-transform duration-300 group-hover:scale-105"
                style={{
                  background: 'radial-gradient(circle, #0e1a2b 0%, #060a12 100%)',
                  border: '2px solid #38bdf8',
                  boxShadow: '0 0 0 1px rgba(255,255,255,0.15), 0 0 18px rgba(56,189,248,0.4)',
                }}
              >
                <Image
                  src="/assets/brain-lab-emblem.png"
                  alt="Central Intelligence Agency Official Seal"
                  width={48}
                  height={48}
                  className="w-full h-full object-contain aspect-square rounded-full drop-shadow-md"
                  priority
                />
              </div>

              {/* Exact Baseline Aligned Typography with Verified IC Authority Sub-Badge */}
              <div className="flex flex-col justify-center select-none">
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-base sm:text-lg tracking-wider text-[#f8fafc] font-mono leading-none group-hover:text-[#38bdf8] transition-colors whitespace-nowrap">
                    BRAIN LAB <span className="text-[#38bdf8] font-bold">BY LILIYA</span>
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-[9px] text-[#94a3b8] font-mono tracking-wider pt-1">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#10b981] animate-pulse shadow-[0_0_6px_#10b981]" />
                  <span className="text-[#38bdf8] font-bold">NSA/IC ADMIN MODE</span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-300 hidden sm:inline">AUTHENTICATED COP</span>
                </div>
              </div>
            </Link>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1 overflow-x-auto py-1 scrollbar-none">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-[#38bdf8]/15 text-[#38bdf8] border border-[#38bdf8]/40 shadow-sm font-bold"
                      : "text-[#94a3b8] hover:text-[#f8fafc] hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Mobile Menu Button & Live Indicator */}
          <div className="flex items-center space-x-2">
            <div className="hidden 2xl:flex items-center space-x-2 font-mono text-[11px] glass-pill px-3 py-1 rounded-full shrink-0">
              <span className="inline-block w-2 h-2 rounded-full bg-[#10b981] animate-ping"></span>
              <span className="text-[#38bdf8] font-semibold">24/7 TELEMETRY LIVE</span>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg glass-card text-[#f8fafc] hover:text-[#38bdf8]"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-white/10 bg-[#070c14]/95 backdrop-blur-2xl px-4 pt-3 pb-5 space-y-1 max-h-[80vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-1.5 pb-2">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? "bg-[#38bdf8]/20 text-[#38bdf8] border border-[#38bdf8]/40 font-bold"
                      : "text-[#94a3b8] hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="truncate">{link.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}

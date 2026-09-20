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
    <header className="sticky top-0 z-50 bg-[#1e1828]/95 backdrop-blur-md border-b border-[#3a2e4c] text-[#f5effa]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-3">
          
          {/* Brand Identity with Responsive Rotating Emblem */}
          <div className="flex items-center space-x-3 shrink-0">
            <Link href="/" className="flex items-center space-x-2 sm:space-x-3 group">
              <div className="relative w-8 h-8 sm:w-10 sm:h-10 md:w-11 md:h-11 shrink-0 rounded-full overflow-hidden p-0.5 border border-[#ffd269]/80 bg-[#16121e] emblem-nav-hover shadow-lg">
                <Image
                  src="/assets/brain-lab-emblem-64.png"
                  alt="Brain Lab by Liliya emblem"
                  width={44}
                  height={44}
                  className="w-full h-full object-contain"
                  priority
                />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-sm sm:text-base md:text-lg tracking-wider text-[#f5effa] font-mono group-hover:text-[#ffd269] transition-colors whitespace-nowrap">
                    BRAIN LAB <span className="text-[#ffd269] text-xs font-normal">BY LILIYA</span>
                  </span>
                </div>
                <span className="text-[9px] sm:text-[10px] text-[#9f94ba] font-mono tracking-tight hidden xl:inline truncate max-w-[280px]">
                  Post-Doctorate Cognitive Market Intelligence
                </span>
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
                  className={`flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${
                    isActive
                      ? "bg-[#624d77]/40 text-[#ffd269] border border-[#d66ea5]/50 shadow-sm"
                      : "text-[#9f94ba] hover:text-[#f5effa] hover:bg-[#3a2e4c]/50"
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
            <div className="hidden 2xl:flex items-center space-x-2 font-mono text-[11px] bg-[#16121e] border border-[#624d77] px-2.5 py-1 rounded-full shrink-0">
              <span className="inline-block w-2 h-2 rounded-full bg-[#7ef0dc] animate-ping"></span>
              <span className="text-[#5ecbe6] font-semibold">CRYSTAL TELEMETRY</span>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-[#231d2e] border border-[#3a2e4c] text-[#dfac97] hover:text-white"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#3a2e4c] bg-[#16121e]/98 backdrop-blur-xl px-4 pt-3 pb-5 space-y-1 max-h-[80vh] overflow-y-auto">
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
                      ? "bg-[#624d77]/40 text-[#ffd269] border border-[#d66ea5]/50"
                      : "text-[#9f94ba] hover:text-white hover:bg-[#231d2e]"
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

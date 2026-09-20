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
    <header className="sticky top-0 z-50 bg-[#332a42]/95 backdrop-blur-md border-b border-[#54446d] text-[#f5effa]">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-2">
          
          {/* Brand Identity with Responsive Rotating Circular Emblem */}
          <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
            <Link href="/" className="flex items-center space-x-2 sm:space-x-3 group">
              <div className="relative w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 shrink-0 rounded-full overflow-hidden p-0.5 border border-[#ffd87a] bg-[#241c2f] emblem-nav-hover shadow-lg">
                <Image
                  src="/assets/brain-lab-emblem-64.png"
                  alt="Brain Lab by Liliya emblem"
                  width={44}
                  height={44}
                  className="w-full h-full object-contain rounded-full"
                  priority
                />
              </div>

              <div className="flex flex-col">
                <div className="flex items-center space-x-1.5">
                  <span className="font-bold text-sm sm:text-base md:text-lg tracking-wider text-[#f5effa] font-mono group-hover:text-[#ffd87a] transition-colors whitespace-nowrap">
                    BRAIN LAB <span className="text-[#ffd87a] text-xs font-normal">BY LILIYA</span>
                  </span>
                </div>
                <span className="text-[9px] sm:text-[10px] text-[#baaed3] font-mono tracking-tight hidden xl:inline truncate max-w-[280px]">
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
                      ? "bg-[#54446d] text-[#ffd87a] border border-[#e580b5]/50 shadow-sm font-bold"
                      : "text-[#baaed3] hover:text-[#f5effa] hover:bg-[#3b304d]"
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
            <div className="hidden 2xl:flex items-center space-x-2 font-mono text-[11px] bg-[#2a2236] border border-[#54446d] px-2.5 py-1 rounded-full shrink-0">
              <span className="inline-block w-2 h-2 rounded-full bg-[#88f4e2] animate-ping"></span>
              <span className="text-[#62d3ee] font-semibold">CRYSTAL TELEMETRY</span>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg bg-[#2a2236] border border-[#54446d] text-[#ffd87a] hover:text-white"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#54446d] bg-[#282034]/98 backdrop-blur-xl px-4 pt-3 pb-5 space-y-1 max-h-[80vh] overflow-y-auto">
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
                      ? "bg-[#54446d] text-[#ffd87a] border border-[#e580b5]/50 font-bold"
                      : "text-[#baaed3] hover:text-white hover:bg-[#332a42]"
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

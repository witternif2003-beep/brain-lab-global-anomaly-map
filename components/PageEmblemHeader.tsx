"use client";
import React from "react";
import Image from "next/image";

interface PageEmblemHeaderProps {
  badgeText: string;
  badgeIcon?: React.ReactNode;
  title: string;
  description: string;
  rightElement?: React.ReactNode;
}

export default function PageEmblemHeader({
  badgeText,
  badgeIcon,
  title,
  description,
  rightElement,
}: PageEmblemHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl glass-panel p-5 sm:p-6 shadow-2xl">
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left Section with Official Standard Header Seal Placement */}
        <div className="flex items-start space-x-4">
          {/* Official Standard 56px Header Insignia with Perspective Stability */}
          <div className="relative shrink-0 pt-0.5">
            <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full p-1 bg-[#070d18] border-2 border-[#38bdf8]/70 shadow-[0_0_20px_rgba(56,189,248,0.35)] flex items-center justify-center">
              <Image
                src="/assets/brain-lab-emblem.png"
                alt="Official Header Insignia"
                width={56}
                height={56}
                className="w-full h-full object-contain aspect-square rounded-full drop-shadow-md"
                priority
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-2 px-3 py-0.5 rounded-full text-[10px] font-semibold glass-pill text-[#38bdf8] shadow-sm">
              {badgeIcon && <span>{badgeIcon}</span>}
              <span className="font-mono tracking-wide uppercase">{badgeText}</span>
            </div>

            <h1 className="text-lg sm:text-xl md:text-2xl font-extrabold text-[#f8fafc] tracking-tight font-mono leading-tight">
              {title}
            </h1>

            <p className="text-xs text-[#cbd5e1] max-w-3xl leading-relaxed font-sans">
              {description}
            </p>
          </div>
        </div>

        {/* Right Element if provided */}
        {rightElement && (
          <div className="shrink-0 flex items-center md:self-center">
            {rightElement}
          </div>
        )}

      </div>
    </div>
  );
}

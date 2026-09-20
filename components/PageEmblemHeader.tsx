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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#231d2e] via-[#2d223c] to-[#1a1424] border border-[#624d77]/70 p-6 sm:p-8 shadow-2xl">
      
      {/* Prismatic Crystal Starburst Glow */}
      <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 rounded-full bg-gradient-to-br from-[#d66ea5]/20 via-[#5ecbe6]/15 to-[#ffd269]/10 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 -mb-16 w-64 h-64 rounded-full bg-[#7ef0dc]/10 blur-2xl pointer-events-none" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        
        {/* Left Section with Rotating Glowing Neon Emblem */}
        <div className="flex items-start sm:items-center space-x-4 sm:space-x-5">
          <div className="relative shrink-0">
            {/* Prismatic multi-spectral aura ring */}
            <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-[#d66ea5] via-[#5ecbe6] to-[#ffd269] opacity-70 blur-md animate-pulse"></div>
            
            <div className="relative w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-full overflow-hidden p-1 bg-[#120e18] border-2 border-[#ffd269] shadow-2xl emblem-rotating-glow">
              <Image
                src="/assets/brain-lab-emblem.png"
                alt="Brain Lab by Liliya emblem"
                width={96}
                height={96}
                className="w-full h-full object-contain"
                priority
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-[#3a2e4c]/80 text-[#ffd269] border border-[#d66ea5]/40 shadow-sm">
              {badgeIcon && <span>{badgeIcon}</span>}
              <span className="font-mono tracking-wide">{badgeText}</span>
            </div>

            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#f5effa] tracking-tight font-mono leading-tight">
              {title}
            </h1>

            <p className="text-xs sm:text-sm text-[#dfac97] max-w-3xl leading-relaxed font-sans">
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

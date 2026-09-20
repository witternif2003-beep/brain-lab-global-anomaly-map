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
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-[#131d2c] via-[#0f172a] to-[#0b1320] border border-[#28394e] p-5 sm:p-6 shadow-2xl">
      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Left Section with 1/10th Longitudinal Rotating Emblem */}
        <div className="flex items-start sm:items-center space-x-3.5">
          <div className="relative shrink-0" style={{ perspective: "600px" }}>
            <div className="relative w-8 h-8 sm:w-9 sm:h-9 rounded-full p-0.5 bg-[#0b121b] border border-[#38bdf8] shadow-lg emblem-longitudinal-pulse flex items-center justify-center overflow-hidden">
              <Image
                src="/assets/brain-lab-emblem.png"
                alt="Brain Lab by Liliya emblem"
                width={36}
                height={36}
                className="w-full h-full object-cover rounded-full"
                priority
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#1e293b] text-[#38bdf8] border border-[#38bdf8]/40 shadow-sm">
              {badgeIcon && <span>{badgeIcon}</span>}
              <span className="font-mono tracking-wide">{badgeText}</span>
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

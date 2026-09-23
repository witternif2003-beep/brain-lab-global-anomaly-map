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
          {/* Official Standard 56px Header Insignia with Conformal Cyan Bezel */}
          <div className="relative shrink-0 pt-0.5" style={{ flexShrink: 0 }}>
            <div
              className="relative rounded-full flex items-center justify-center"
              style={{
                width: '56px',
                height: '56px',
                minWidth: '56px',
                minHeight: '56px',
                maxWidth: '56px',
                maxHeight: '56px',
                aspectRatio: '1 / 1',
                borderRadius: '50%',
                flexShrink: 0,
                filter: 'drop-shadow(0 0 14px rgba(56,189,248,0.7))',
                background: 'transparent',
                border: 'none',
                padding: 0,
              }}
            >
              <Image
                src="/assets/brain-lab-emblem-official.png"
                alt="Official Header Insignia"
                width={56}
                height={56}
                style={{
                  width: '56px',
                  height: '56px',
                  minWidth: '56px',
                  minHeight: '56px',
                  objectFit: 'contain',
                  aspectRatio: '1 / 1',
                  borderRadius: '50%',
                  display: 'block',
                }}
                className="rounded-full"
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

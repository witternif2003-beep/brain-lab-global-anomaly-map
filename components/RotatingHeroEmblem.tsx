"use client";
import React from "react";

interface RotatingHeroEmblemProps {
  className?: string;
}

export default function RotatingHeroEmblem({ className = "" }: RotatingHeroEmblemProps) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer ambient glow halo */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#ffd87a]/40 via-[#62d3ee]/40 to-[#e580b5]/40 blur-2xl animate-pulse -z-10" />

      {/* Rotating and Neon Glowing Container */}
      <div className="relative w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-full p-1.5 border-2 border-[#ffd87a] bg-[#241c2f] emblem-rotating-glow shadow-[0_0_35px_rgba(255,216,122,0.6)] flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/brain-lab-emblem.png"
          alt="Brain Lab by Liliya emblem"
          className="w-full h-full object-cover rounded-full"
        />
      </div>
    </div>
  );
}

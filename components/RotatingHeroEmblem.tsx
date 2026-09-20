"use client";
import React from "react";

interface RotatingHeroEmblemProps {
  className?: string;
}

export default function RotatingHeroEmblem({ className = "" }: RotatingHeroEmblemProps) {
  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ perspective: "600px" }}>
      {/* Outer ambient pulsing glow halo */}
      <div className="absolute w-8 h-8 rounded-full bg-gradient-to-r from-[#ffd87a]/40 via-[#62d3ee]/40 to-[#e580b5]/40 blur-md animate-pulse -z-10" />

      {/* 1/10th scale container with longitudinal Y-axis rotation and pulsing glow */}
      <div className="relative w-6 h-6 sm:w-7 sm:h-7 rounded-full p-0.5 border border-[#ffd87a] bg-[#241c2f] emblem-longitudinal-pulse flex items-center justify-center overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/assets/brain-lab-emblem-64.png"
          alt="Brain Lab by Liliya emblem"
          className="w-full h-full object-cover rounded-full"
        />
      </div>
    </div>
  );
}

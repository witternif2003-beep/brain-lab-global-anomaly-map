"use client";
import React from "react";
import Image from "next/image";

interface RotatingHeroEmblemProps {
  className?: string;
}

export default function RotatingHeroEmblem({ className = "" }: RotatingHeroEmblemProps) {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Outer ambient glow halo */}
      <div className="absolute inset-0 rounded-full bg-white/20 blur-2xl animate-pulse -z-10" />

      {/* Rotating and Neon Glowing Container */}
      <div className="relative w-40 h-40 sm:w-52 sm:h-52 md:w-64 md:h-64 rounded-full p-2 border-2 border-white/80 bg-slate-950/80 emblem-rotating-glow shadow-[0_8px_24px_rgba(0,0,0,0.25)] flex items-center justify-center">
        <Image
          src="/assets/brain-lab-emblem-256.png"
          alt="Brain Lab by Liliya emblem"
          width={256}
          height={256}
          className="w-full h-full object-contain"
          priority
        />
      </div>
    </div>
  );
}

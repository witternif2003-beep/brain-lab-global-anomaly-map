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
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-[#d66ea5]/30 via-[#5ecbe6]/20 to-[#ffd269]/30 blur-2xl animate-pulse -z-10" />

      {/* Rotating and Neon Glowing Container */}
      <div className="relative w-36 h-36 sm:w-48 sm:h-48 md:w-56 md:h-56 lg:w-64 lg:h-64 rounded-full p-2 border-2 border-[#ffd269] bg-[#16121e]/95 emblem-rotating-glow shadow-[0_0_35px_rgba(255,210,105,0.45)] flex items-center justify-center">
        <Image
          src="/assets/brain-lab-emblem-256.png"
          alt="Brain Lab by Liliya emblem"
          width={256}
          height={256}
          className="w-full h-full object-contain rounded-full"
          priority
        />
      </div>
    </div>
  );
}

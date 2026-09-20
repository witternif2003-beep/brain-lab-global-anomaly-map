"use client";
import React from 'react';
import { useTelemetryCanvas } from '../hooks/useTelemetryCanvas';

interface RealTimeSparklineProps {
  channelKey: 'gridLoadMW' | 'portTEUVelocity';
  label: string;
  unit: string;
  strokeColor?: string;
}

export function RealTimeSparkline({
  channelKey,
  label,
  unit,
  strokeColor = '#00e5ff'
}: RealTimeSparklineProps) {
  const canvasRef = useTelemetryCanvas(channelKey, strokeColor);

  return (
    <div className="telemetry-card widget-container glass-card p-3.5 rounded-2xl border border-white/10 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-[#8595a8] uppercase font-semibold tracking-wider">{label}</span>
        <span className="text-[10px] text-[#00ff9d] font-mono px-2 py-0.5 rounded bg-[#00ff9d]/15 border border-[#00ff9d]/30">
          60 FPS CANVAS
        </span>
      </div>
      <div className="w-full h-16 rounded-xl overflow-hidden border border-white/5 bg-[#060a12]">
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>
      <div className="text-[11px] text-[#b6c2d2] flex justify-between font-mono">
        <span>Channel: {channelKey}</span>
        <span className="text-white font-bold">{unit}</span>
      </div>
    </div>
  );
}

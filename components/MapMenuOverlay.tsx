'use client';

import React from 'react';
import MapDebugOverlay from './MapDebugOverlay';

interface MapMenuOverlayProps {
  pitch: number;
  zoom: number;
  basemap: string;
  activeFocus: string;
  onToggle3D: () => void;
  onSwitchBasemap: (layer: 'demotiles' | 'satellite' | 'terrain') => void;
  onSelectState: (state: 'GA' | 'NC' | 'TN' | 'FL' | 'SC' | 'TX' | 'VA' | 'AL') => void;
  mapRef: React.MutableRefObject<any>;
}

export default function MapMenuOverlay({
  pitch,
  zoom,
  basemap,
  activeFocus,
  onToggle3D,
  onSwitchBasemap,
  onSelectState,
  mapRef,
}: MapMenuOverlayProps) {
  const is2D = pitch <= 20;

  return (
    <>
      {/* Diagnostics Pill - Top Right */}
      <MapDebugOverlay mapRef={mapRef} />

      {/* Main 3-Row Matrix Menu - Top Left matching IMG_6586.jpeg */}
      <div
        className="absolute top-3 left-3 z-20 flex flex-col gap-1 p-2 rounded-lg bg-slate-950/80 backdrop-blur-md border border-slate-800/80 text-xs font-mono shadow-xl w-max pointer-events-auto"
        style={{
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), inset 0 0 12px rgba(14, 165, 233, 0.08)',
        }}
      >
        {/* Row 1: Base Layers */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={onToggle3D}
            className={`px-3 py-1 rounded transition-colors font-bold ${
              is2D
                ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 hover:bg-emerald-900/60'
                : 'bg-slate-800/40 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60'
            }`}
          >
            {is2D ? '2D' : '3D'}
          </button>
          <button
            type="button"
            onClick={() => onSwitchBasemap('demotiles')}
            className={`px-3 py-1 rounded transition-colors ${
              basemap === 'demotiles'
                ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-800/50 hover:bg-cyan-900/60'
                : 'bg-slate-800/40 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60'
            }`}
          >
            LIGHT
          </button>
          <button
            type="button"
            onClick={() => onSwitchBasemap('satellite')}
            className={`px-3 py-1 rounded transition-colors ${
              basemap === 'satellite'
                ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-800/50 hover:bg-cyan-900/60 shadow-[0_0_12px_rgba(56,189,248,0.3)]'
                : 'bg-slate-800/40 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60'
            }`}
          >
            SATELLITE
          </button>
          <button
            type="button"
            onClick={() => onSwitchBasemap('terrain')}
            className={`px-3 py-1 rounded transition-colors ${
              basemap === 'terrain'
                ? 'bg-cyan-950/40 text-cyan-400 border border-cyan-800/50 hover:bg-cyan-900/60'
                : 'bg-slate-800/40 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60'
            }`}
          >
            TERRAIN
          </button>
        </div>

        {/* Row 2: State Filters (Target & Neighbors) */}
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onSelectState('GA')}
            className={`px-3 py-1 rounded transition-colors font-bold ${
              activeFocus === 'GA'
                ? 'bg-red-950/40 text-red-500 border border-red-800/50 hover:bg-red-900/60 shadow-[0_0_12px_rgba(239,68,68,0.4)]'
                : 'bg-red-950/20 text-red-400/80 border border-red-900/40 hover:bg-red-900/40'
            }`}
          >
            GA (Target)
          </button>
          <button
            type="button"
            onClick={() => onSelectState('NC')}
            className={`px-3 py-1 rounded transition-colors ${
              activeFocus === 'NC'
                ? 'bg-blue-950/40 text-blue-400 border border-blue-800/50 hover:bg-blue-900/60 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                : 'bg-slate-800/40 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60'
            }`}
          >
            NC
          </button>
          {(['TN', 'FL', 'SC', 'TX'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onSelectState(st)}
              className={`px-3 py-1 rounded transition-colors ${
                activeFocus === st
                  ? 'bg-blue-950/40 text-blue-400 border border-blue-800/50 hover:bg-blue-900/60 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                  : 'bg-slate-800/40 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        {/* Row 3: Secondary Filters & Telemetry */}
        <div className="flex gap-1 items-center">
          {(['VA', 'AL'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onSelectState(st)}
              className={`px-3 py-1 rounded transition-colors ${
                activeFocus === st
                  ? 'bg-blue-950/40 text-blue-400 border border-blue-800/50 hover:bg-blue-900/60 shadow-[0_0_12px_rgba(56,189,248,0.4)]'
                  : 'bg-slate-800/40 text-slate-400 border border-slate-700/50 hover:bg-slate-700/60'
              }`}
            >
              {st}
            </button>
          ))}
          <div className="px-3 py-1 rounded bg-slate-900/60 text-slate-400 border border-slate-800/50 ml-1 text-[11px] font-mono whitespace-nowrap">
            z{typeof zoom === 'number' && !isNaN(zoom) ? zoom.toFixed(1) : '6.0'} · p{typeof pitch === 'number' && !isNaN(pitch) ? pitch.toFixed(0) : '60'}°
          </div>
        </div>
      </div>
    </>
  );
}

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
      {/* Diagnostics Pill - Top Right - Identical to IMG_6586.jpeg */}
      <MapDebugOverlay mapRef={mapRef} />

      {/* Main 3-Row Matrix Menu - Top Left - Identical to IMG_6586.jpeg */}
      <div
        className="absolute top-2 left-2 z-20 flex flex-col gap-1 p-1 rounded-md text-xs font-mono shadow-2xl pointer-events-auto"
        style={{
          background: 'rgba(8, 14, 26, 0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(30, 41, 59, 0.65)',
        }}
      >
        {/* ROW 1: 2D | LIGHT | SATELLITE | TERRAIN | vertical divider */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggle3D}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              color: '#34d399',
              background: 'rgba(6, 44, 32, 0.55)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: 'inset 0 0 8px rgba(16, 185, 129, 0.15)',
            }}
          >
            2D
          </button>
          <button
            type="button"
            onClick={() => onSwitchBasemap('demotiles')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              color: basemap === 'demotiles' ? '#38bdf8' : '#cbd5e1',
              background: basemap === 'demotiles' ? 'rgba(14, 165, 233, 0.3)' : 'rgba(15, 23, 42, 0.6)',
              border: basemap === 'demotiles' ? '1px solid rgba(56, 189, 248, 0.7)' : '1px solid rgba(51, 65, 85, 0.5)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            LIGHT
          </button>
          <button
            type="button"
            onClick={() => onSwitchBasemap('satellite')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              color: '#38bdf8',
              background: 'rgba(14, 75, 120, 0.55)',
              border: '1px solid rgba(56, 189, 248, 0.75)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 0 10px rgba(56, 189, 248, 0.35), inset 0 0 8px rgba(56, 189, 248, 0.2)',
            }}
          >
            SATELLITE
          </button>
          <button
            type="button"
            onClick={() => onSwitchBasemap('terrain')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              color: basemap === 'terrain' ? '#38bdf8' : '#cbd5e1',
              background: basemap === 'terrain' ? 'rgba(14, 165, 233, 0.3)' : 'rgba(15, 23, 42, 0.6)',
              border: basemap === 'terrain' ? '1px solid rgba(56, 189, 248, 0.7)' : '1px solid rgba(51, 65, 85, 0.5)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            TERRAIN
          </button>
          {/* Subtle vertical divider in row 1 matching photo */}
          <div style={{ width: 1, height: 16, background: 'rgba(51, 65, 85, 0.6)', marginLeft: 2 }} />
        </div>

        {/* ROW 2: GA (Target) | NC | TN | FL | SC | TX */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onSelectState('GA')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              color: '#ef4444',
              background: 'rgba(69, 10, 10, 0.35)',
              border: '1px solid rgba(220, 38, 38, 0.45)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            GA (Target)
          </button>
          <button
            type="button"
            onClick={() => onSelectState('NC')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              color: '#38bdf8',
              background: 'rgba(14, 75, 120, 0.55)',
              border: '1px solid rgba(56, 189, 248, 0.75)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              boxShadow: '0 0 10px rgba(56, 189, 248, 0.35)',
            }}
          >
            NC
          </button>
          {(['TN', 'FL', 'SC', 'TX'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onSelectState(st)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '6px',
                color: activeFocus === st ? '#38bdf8' : '#cbd5e1',
                background: activeFocus === st ? 'rgba(14, 75, 120, 0.55)' : 'rgba(15, 23, 42, 0.6)',
                border: activeFocus === st ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(51, 65, 85, 0.5)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {st}
            </button>
          ))}
        </div>

        {/* ROW 3: VA | AL | divider | z6.0 · p60° */}
        <div className="flex items-center gap-1">
          {(['VA', 'AL'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => onSelectState(st)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '6px',
                color: activeFocus === st ? '#38bdf8' : '#cbd5e1',
                background: activeFocus === st ? 'rgba(14, 75, 120, 0.55)' : 'rgba(15, 23, 42, 0.6)',
                border: activeFocus === st ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(51, 65, 85, 0.5)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {st}
            </button>
          ))}
          <div style={{ width: 1, height: 16, background: 'rgba(51, 65, 85, 0.6)', margin: '0 2px' }} />
          <div
            style={{
              padding: '3px 8px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#94a3b8',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(51, 65, 85, 0.5)',
              borderRadius: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            z{typeof zoom === 'number' && !isNaN(zoom) ? zoom.toFixed(1) : '6.0'} · p{typeof pitch === 'number' && !isNaN(pitch) ? pitch.toFixed(0) : '60'}°
          </div>
        </div>
      </div>
    </>
  );
}

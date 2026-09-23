'use client';

import React, { useState, useEffect } from 'react';
import MapDebugOverlay from './MapDebugOverlay';

export type BasemapMode = 'demotiles' | 'satellite' | 'terrain';
export type StateCode = 'GA' | 'NC' | 'TN' | 'FL' | 'SC' | 'TX' | 'VA' | 'AL';

export interface MapMenuOverlayProps {
  pitch?: number;
  zoom?: number;
  basemap?: BasemapMode;
  activeFocus?: StateCode | string;
  onToggle3D?: () => void;
  onSwitchBasemap?: (layer: BasemapMode) => void;
  onSelectState?: (state: StateCode) => void;
  mapRef?: React.MutableRefObject<any>;
}

/**
 * Standalone GodsEye Map Tactical HUD Widget
 * Fully autonomous with internal fallback state, event bindings, and exact visual specs from IMG_6586.jpeg
 */
export default function MapMenuOverlay({
  pitch: externalPitch,
  zoom: externalZoom,
  basemap: externalBasemap,
  activeFocus: externalActiveFocus,
  onToggle3D,
  onSwitchBasemap,
  onSelectState,
  mapRef,
}: MapMenuOverlayProps) {
  // Self-contained internal state machine for full standalone independence
  const [internalPitch, setInternalPitch] = useState<number>(externalPitch ?? 60);
  const [internalZoom, setInternalZoom] = useState<number>(externalZoom ?? 6.0);
  const [internalBasemap, setInternalBasemap] = useState<BasemapMode>(externalBasemap ?? 'satellite');
  const [internalFocus, setInternalFocus] = useState<StateCode | string>(externalActiveFocus ?? 'NC');

  // Sync external props if provided
  useEffect(() => {
    if (externalPitch !== undefined) setInternalPitch(externalPitch);
  }, [externalPitch]);

  useEffect(() => {
    if (externalZoom !== undefined) setInternalZoom(externalZoom);
  }, [externalZoom]);

  useEffect(() => {
    if (externalBasemap !== undefined) setInternalBasemap(externalBasemap);
  }, [externalBasemap]);

  useEffect(() => {
    if (externalActiveFocus !== undefined) setInternalFocus(externalActiveFocus);
  }, [externalActiveFocus]);

  // Hook into MapLibre instance if mapRef is passed
  useEffect(() => {
    const map = mapRef?.current;
    if (!map) return;

    const handleZoom = () => {
      try {
        setInternalZoom(map.getZoom());
      } catch {}
    };

    const handlePitch = () => {
      try {
        setInternalPitch(map.getPitch());
      } catch {}
    };

    map.on('zoom', handleZoom);
    map.on('pitch', handlePitch);

    return () => {
      try {
        map.off('zoom', handleZoom);
        map.off('pitch', handlePitch);
      } catch {}
    };
  }, [mapRef]);

  // Event dispatchers with safe standalone fallbacks
  const handleToggle3D = () => {
    const nextPitch = internalPitch > 20 ? 0 : 60;
    setInternalPitch(nextPitch);
    if (onToggle3D) {
      onToggle3D();
    } else if (mapRef?.current) {
      mapRef.current.easeTo({ pitch: nextPitch, duration: 800 });
    }
  };

  const handleBasemapSelect = (mode: BasemapMode) => {
    setInternalBasemap(mode);
    if (onSwitchBasemap) {
      onSwitchBasemap(mode);
    }
  };

  const handleStateSelect = (st: StateCode) => {
    setInternalFocus(st);
    if (onSelectState) {
      onSelectState(st);
    }
  };

  const is2D = internalPitch <= 20;

  return (
    <div className="select-none pointer-events-none">
      {/* Diagnostics Pill Widget - Top Right matching IMG_6586 */}
      {mapRef && <MapDebugOverlay mapRef={mapRef} />}

      {/* Main 3-Row Matrix Menu - Top Left Standalone Widget matching IMG_6586 */}
      <div
        className="absolute top-2.5 left-2.5 z-20 flex flex-col gap-1 p-1 rounded-md text-xs font-mono shadow-2xl pointer-events-auto"
        style={{
          background: 'rgba(8, 14, 26, 0.78)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid rgba(30, 41, 59, 0.7)',
        }}
      >
        {/* ROW 1: [2D] | [LIGHT] | [SATELLITE] | [TERRAIN] | divider */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleToggle3D}
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
            onClick={() => handleBasemapSelect('demotiles')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              color: internalBasemap === 'demotiles' ? '#38bdf8' : '#cbd5e1',
              background: internalBasemap === 'demotiles' ? 'rgba(14, 75, 120, 0.55)' : 'rgba(15, 23, 42, 0.6)',
              border: internalBasemap === 'demotiles' ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(51, 65, 85, 0.5)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            LIGHT
          </button>
          <button
            type="button"
            onClick={() => handleBasemapSelect('satellite')}
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
            onClick={() => handleBasemapSelect('terrain')}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              fontWeight: 700,
              borderRadius: '6px',
              color: internalBasemap === 'terrain' ? '#38bdf8' : '#cbd5e1',
              background: internalBasemap === 'terrain' ? 'rgba(14, 75, 120, 0.55)' : 'rgba(15, 23, 42, 0.6)',
              border: internalBasemap === 'terrain' ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(51, 65, 85, 0.5)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            TERRAIN
          </button>
          {/* Subtle vertical separator in Row 1 */}
          <div style={{ width: 1, height: 16, background: 'rgba(51, 65, 85, 0.6)', marginLeft: 2 }} />
        </div>

        {/* ROW 2: [GA (Target)] | [NC] | [TN] | [FL] | [SC] | [TX] */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => handleStateSelect('GA')}
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
            onClick={() => handleStateSelect('NC')}
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
              onClick={() => handleStateSelect(st)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '6px',
                color: internalFocus === st ? '#38bdf8' : '#cbd5e1',
                background: internalFocus === st ? 'rgba(14, 75, 120, 0.55)' : 'rgba(15, 23, 42, 0.6)',
                border: internalFocus === st ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(51, 65, 85, 0.5)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {st}
            </button>
          ))}
        </div>

        {/* ROW 3: [VA] | [AL] | divider | [z6.0 · p60°] */}
        <div className="flex items-center gap-1">
          {(['VA', 'AL'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => handleStateSelect(st)}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: 700,
                borderRadius: '6px',
                color: internalFocus === st ? '#38bdf8' : '#cbd5e1',
                background: internalFocus === st ? 'rgba(14, 75, 120, 0.55)' : 'rgba(15, 23, 42, 0.6)',
                border: internalFocus === st ? '1px solid rgba(56, 189, 248, 0.75)' : '1px solid rgba(51, 65, 85, 0.5)',
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
            z{typeof internalZoom === 'number' && !isNaN(internalZoom) ? internalZoom.toFixed(1) : '6.0'} · p{typeof internalPitch === 'number' && !isNaN(internalPitch) ? internalPitch.toFixed(0) : '60'}°
          </div>
        </div>
      </div>
    </div>
  );
}

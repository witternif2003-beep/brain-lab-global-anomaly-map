'use client';

import React from 'react';
import MapDebugOverlay from './MapDebugOverlay';

interface MapMenuOverlayProps {
  pitch?: number;
  zoom?: number;
  basemap?: string;
  activeFocus?: string;
  onToggle3D?: () => void;
  onSwitchBasemap?: (layer: 'demotiles' | 'satellite' | 'terrain') => void;
  onSelectState?: (state: 'GA' | 'NC' | 'TN' | 'FL' | 'SC' | 'TX' | 'VA' | 'AL') => void;
  mapRef: React.MutableRefObject<any>;
}

export default function MapMenuOverlay({
  mapRef,
}: MapMenuOverlayProps) {
  return (
    <>
      {/* Diagnostics Pill - Top Right Only (Top control panel in photo removed permanently) */}
      <MapDebugOverlay mapRef={mapRef} />
    </>
  );
}

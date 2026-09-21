'use client';

import { useEffect, useState } from 'react';

export default function MapDebugOverlay({ mapRef }: { mapRef: React.MutableRefObject<any> }) {
  const [lines, setLines] = useState<string[]>(['waiting...']);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    // Capture any global JS errors
    const onError = (e: ErrorEvent) => {
      setErrors(prev => [...prev.slice(-2), `${e.message} @ ${e.filename?.split('/').pop()}`]);
    };
    window.addEventListener('error', onError);

    const tick = () => {
      const m = mapRef.current;
      const webgl2 = !!document.createElement('canvas').getContext('webgl2');
      const next = [
        `map: ${!!m}`,
        `style: ${m?.isStyleLoaded?.() ?? 'n/a'}`,
        `tiles: ${m?.areTilesLoaded?.() ?? 'n/a'}`,
        `webgl2: ${webgl2}`,
        `zoom: ${m?.getZoom?.()?.toFixed?.(2) ?? 'n/a'}`,
        `sources: ${m ? Object.keys(m.getStyle?.()?.sources ?? {}).length : 0}`,
        `layers: ${m ? (m.getStyle?.()?.layers?.length ?? 0) : 0}`,
      ];
      setLines(next);
    };

    tick();
    const id = setInterval(tick, 2000);
    return () => {
      clearInterval(id);
      window.removeEventListener('error', onError);
    };
  }, [mapRef]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: 'rgba(0,0,0,0.9)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: 11,
        padding: 6,
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.4,
      }}
    >
      {'[DEBUG] ' + lines.join('  |  ')}
      {errors.length > 0 && (
        <div style={{ color: '#f66', marginTop: 4 }}>
          {'ERR: ' + errors.join(' ; ')}
        </div>
      )}
    </div>
  );
}

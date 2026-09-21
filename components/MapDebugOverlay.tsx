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
      const canvas = m?.getCanvas?.() as HTMLCanvasElement | undefined;
      const rect = canvas?.getBoundingClientRect?.();
      const cs = canvas ? window.getComputedStyle(canvas) : null;
      const next = [
        `map: ${!!m}`,
        `style: ${m?.isStyleLoaded?.() ?? 'n/a'}`,
        `tiles: ${m?.areTilesLoaded?.() ?? 'n/a'}`,
        `webgl2: ${webgl2}`,
        `zoom: ${m?.getZoom?.()?.toFixed?.(2) ?? 'n/a'}`,
        `sources: ${m ? Object.keys(m.getStyle?.()?.sources ?? {}).length : 0}`,
        `layers: ${m ? (m.getStyle?.()?.layers?.length ?? 0) : 0}`,
        `canvasW: ${canvas?.width ?? 0}`,
        `canvasH: ${canvas?.height ?? 0}`,
        `cssW: ${rect ? Math.round(rect.width) : 0}`,
        `cssH: ${rect ? Math.round(rect.height) : 0}`,
        `opacity: ${cs?.opacity ?? 'n/a'}`,
        `display: ${cs?.display ?? 'n/a'}`,
        `visibility: ${cs?.visibility ?? 'n/a'}`,
      ];
      setLines(next);
    };

    tick();
    const id = setInterval(tick, 1500);
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
        background: 'rgba(0,0,0,0.92)',
        color: '#0f0',
        fontFamily: 'monospace',
        fontSize: 10,
        padding: '6px 8px',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        lineHeight: 1.4,
        borderBottom: '1px solid rgba(0, 255, 0, 0.3)',
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

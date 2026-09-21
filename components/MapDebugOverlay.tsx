'use client';

import { useEffect, useState } from 'react';

export default function MapDebugOverlay({ mapRef }: { mapRef: React.MutableRefObject<any> }) {
  const [lines, setLines] = useState<string[]>(['waiting...']);
  const [errors, setErrors] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);

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
    const id = setInterval(tick, 1000);
    return () => {
      clearInterval(id);
      window.removeEventListener('error', onError);
    };
  }, [mapRef]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 8,
        right: 8,
        zIndex: 9999,
        fontFamily: 'monospace',
      }}
    >
      {/* Dropdown Toggle Pill */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        style={{
          appearance: 'none',
          WebkitAppearance: 'none',
          background: 'rgba(15, 23, 42, 0.88)',
          border: '1px solid rgba(16, 185, 129, 0.4)',
          borderRadius: 6,
          padding: '4px 8px',
          color: '#34d399',
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.05em',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}
      >
        <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#34d399' }} />
        <span>DIAGNOSTICS {isOpen ? '▲' : '▼'}</span>
      </button>

      {/* Expandable Overlay Content */}
      {isOpen && (
        <div
          style={{
            marginTop: 6,
            background: 'rgba(5, 10, 20, 0.95)',
            color: '#34d399',
            border: '1px solid rgba(16, 185, 129, 0.35)',
            borderRadius: 6,
            padding: '8px 10px',
            fontSize: 10,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.4,
            maxWidth: '92vw',
            width: 320,
            boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
          }}
        >
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#38bdf8', borderBottom: '1px solid rgba(56, 189, 248, 0.2)', paddingBottom: 2 }}>
            MAP SUBSYSTEM HUD
          </div>
          {lines.map((line, idx) => (
            <div key={idx} style={{ color: line.includes('canvasH: 0') || line.includes('cssH: 0') ? '#f87171' : '#a7f3d0' }}>
              {line}
            </div>
          ))}
          {errors.length > 0 && (
            <div style={{ color: '#f87171', marginTop: 6, borderTop: '1px solid rgba(248, 113, 113, 0.3)', paddingTop: 4 }}>
              {'ERR: ' + errors.join(' ; ')}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useRef } from 'react';
import { TelemetryCanvasRenderer } from '../lib/telemetry-renderer';
import { useTelemetryStore } from '../lib/telemetry-store';

export function useTelemetryCanvas(channelKey: 'gridLoadMW' | 'portTEUVelocity' = 'gridLoadMW', strokeColor = '#00e5ff') {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rendererRef = useRef<TelemetryCanvasRenderer | null>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new TelemetryCanvasRenderer(canvasRef.current, 120, strokeColor);
    rendererRef.current = renderer;
    renderer.start();

    // Vanilla Zustand store subscription: bypasses React reconciliation entirely
    const unsub = useTelemetryStore.subscribe((state) => {
      const val = state[channelKey];
      if (typeof val === 'number') {
        renderer.push(val);
      }
    });

    const onResize = () => renderer.resize();
    window.addEventListener('resize', onResize);

    return () => {
      unsub();
      window.removeEventListener('resize', onResize);
      renderer.stop();
    };
  }, [channelKey, strokeColor]);

  return canvasRef;
}

// hooks/useAnomalyStream.ts
import { useEffect, useRef } from 'react';

export interface AnomalyFeature {
  type: 'Feature';
  geometry: { type: 'Point'; coordinates: [number, number] };
  properties: {
    id: string;
    severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
    category: string;
    title: string;
    zScore: number;
    confidence: number;
  };
}

export function useAnomalyStream(
  sourceId: string,
  map: any | null, // maplibregl.Map
  onAnomalyReceived?: (anomaly: AnomalyFeature) => void
) {
  const retryCountRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!map) return;

    let buffer: AnomalyFeature[] = [];
    let rafHandle: number | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    // Flush the buffer to the MapLibre source once per animation frame (60fps ceiling)
    const flush = () => {
      try {
        const src = map.getSource(sourceId) as any;
        if (src && buffer.length > 0 && typeof src.setData === 'function') {
          // Cap features buffer to 100 to prevent WebGL/WebGPU buffer exhaustion
          const slice = buffer.slice(-100);
          src.setData({ type: 'FeatureCollection', features: slice });
        }
      } catch (err) {
        console.warn('[SSE] MapLibre source update suppressed:', err);
      }
      buffer = [];
      rafHandle = null;
    };

    const connect = () => {
      if (esRef.current) esRef.current.close();

      esRef.current = new EventSource('/api/telemetry/stream');

      esRef.current.onopen = () => {
        retryCountRef.current = 0; // Reset backoff on successful connection
      };

      esRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const anomaly = data as AnomalyFeature;

          buffer.push(anomaly);
          if (onAnomalyReceived) onAnomalyReceived(anomaly);

          // Coalesce updates: only schedule one flush per animation frame
          if (rafHandle === null) {
            rafHandle = requestAnimationFrame(flush);
          }
        } catch (err) {
          // Heartbeat or comment packet
        }
      };

      esRef.current.onerror = () => {
        esRef.current?.close();

        // Exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s max
        const baseDelay = 1000;
        const maxDelay = 30000;
        const backoff = Math.min(baseDelay * 2 ** retryCountRef.current, maxDelay);

        // Add jitter to prevent thundering herd
        const jitter = Math.random() * 1000;
        retryCountRef.current += 1;

        timeoutId = setTimeout(connect, backoff + jitter);
      };
    };

    connect();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      if (esRef.current) esRef.current.close();
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
    };
  }, [map, sourceId, onAnomalyReceived]);
}

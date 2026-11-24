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

/**
 * Only GeoJSON Point Features are written to the map source. /api/telemetry/stream sends `{ timestamp, tick, samples }` frames,
 * which, written as "features", replaced the source's records with invalid ones every 2.5 s.
 */
export function isAnomalyFeature(v: unknown): v is AnomalyFeature {
  const f = v as AnomalyFeature | null;
  const c = f?.geometry?.coordinates;
  return !!f && f.type === 'Feature' && f.geometry?.type === 'Point' && Array.isArray(c) && c.length >= 2 && Number.isFinite(c[0]) && Number.isFinite(c[1]);
}

export function useAnomalyStream(
  sourceId: string,
  map: any | null, // maplibregl.Map
  onAnomalyReceived?: (anomaly: AnomalyFeature) => void,
  /** While true, buffered features are held back (e.g. so a tiled export sees a stable source). */
  paused?: () => boolean,
) {
  const retryCountRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);
  // Callers pass inline callbacks; keeping them in refs stops each re-render from closing and reopening the EventSource
  // (a phone-sized probe saw 31 aborted /api/telemetry/stream connections in 3 minutes).
  const onAnomalyRef = useRef(onAnomalyReceived);
  const pausedRef = useRef(paused);
  onAnomalyRef.current = onAnomalyReceived;
  pausedRef.current = paused;

  useEffect(() => {
    if (!map) return;

    let buffer: AnomalyFeature[] = [];
    let rafHandle: number | null = null;
    let timeoutId: NodeJS.Timeout | null = null;

    // Flush the buffer to the MapLibre source once per animation frame (60fps ceiling)
    const flush = () => {
      if (pausedRef.current?.()) {
        rafHandle = requestAnimationFrame(flush);
        return;
      }
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
          if (!isAnomalyFeature(data)) return;
          const anomaly = data;

          buffer.push(anomaly);
          onAnomalyRef.current?.(anomaly);

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
  }, [map, sourceId]);
}

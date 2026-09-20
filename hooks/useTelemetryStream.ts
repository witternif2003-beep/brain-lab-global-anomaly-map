"use client";
import { useEffect, useRef, useCallback } from 'react';
import { useTelemetryStore } from '../lib/telemetry-store';

const SSE_ENDPOINT = '/api/telemetry/stream';
const MAX_RETRIES = 6;
const BASE_DELAY = 1000;

export function useTelemetryStream() {
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef(0);
  const { setConnectionStatus, setTelemetry } = useTelemetryStore();

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    if (esRef.current) {
      esRef.current.close();
    }

    setConnectionStatus('connecting');

    try {
      const es = new EventSource(SSE_ENDPOINT);
      esRef.current = es;

      es.onopen = () => {
        retryRef.current = 0;
        setConnectionStatus('streaming');
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.samples && Array.isArray(data.samples)) {
            const gridSample = data.samples.find((s: any) => s.channel === 'grid');
            const macroSample = data.samples.find((s: any) => s.channel === 'macro');

            setTelemetry({
              gridLoadMW: gridSample ? gridSample.value : 18450,
              portTEUVelocity: macroSample ? macroSample.value : 541405,
              timestamp: data.timestamp || Date.now()
            });
          }
        } catch (err) {
          console.error("Failed to parse high-frequency telemetry sample:", err);
        }
      };

      es.onerror = () => {
        es.close();
        if (retryRef.current < MAX_RETRIES) {
          const delay = Math.min(BASE_DELAY * 2 ** retryRef.current, 30000);
          retryRef.current += 1;
          setConnectionStatus('reconnecting');
          setTimeout(connect, delay);
        } else {
          setConnectionStatus('disconnected');
        }
      };
    } catch {
      setConnectionStatus('disconnected');
    }
  }, [setConnectionStatus, setTelemetry]);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);
}

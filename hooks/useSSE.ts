"use client";
import { useEffect, useRef, useCallback } from 'react';
import { useTelemetryStore } from '../lib/telemetry-store';

const MAX_RETRIES = 5;
const BASE_DELAY = 1000; // 1 second

export function useSSE(url: string = "/api/telemetry") {
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { setTelemetry, setConnectionStatus } = useTelemetryStore();

  const connect = useCallback(() => {
    if (typeof window === "undefined") return;

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setConnectionStatus('connecting');

    try {
      const es = new EventSource(url);
      eventSourceRef.current = es;

      es.onopen = () => {
        retryCountRef.current = 0;
        setConnectionStatus('streaming');
      };

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setTelemetry(data);
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      es.onerror = () => {
        es.close();
        setConnectionStatus('reconnecting');

        if (retryCountRef.current < MAX_RETRIES) {
          const delay = Math.min(BASE_DELAY * 2 ** retryCountRef.current, 30000);
          retryCountRef.current += 1;
          retryTimeoutRef.current = setTimeout(connect, delay);
        } else {
          setConnectionStatus('disconnected');
          // Polling fallback every 8 seconds if SSE is blocked
          pollIntervalRef.current = setInterval(async () => {
            try {
              const res = await fetch('/api/manifest');
              if (res.ok) {
                setConnectionStatus('streaming');
              }
            } catch {}
          }, 8000);
        }
      };
    } catch (e) {
      setConnectionStatus('disconnected');
    }
  }, [url, setTelemetry, setConnectionStatus]);

  useEffect(() => {
    connect();
    return () => {
      if (retryTimeoutRef.current) clearTimeout(retryTimeoutRef.current);
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [connect]);

  return useTelemetryStore((state) => state.connectionStatus);
}

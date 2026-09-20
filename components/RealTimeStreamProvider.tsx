"use client";
import React from 'react';
import { useSSE } from '../hooks/useSSE';
import { useTelemetryStore } from '../lib/telemetry-store';
import { Radio } from 'lucide-react';

export function RealTimeStreamProvider({ children }: { children: React.ReactNode }) {
  const status = useSSE('/api/telemetry');

  return (
    <>
      {children}
    </>
  );
}

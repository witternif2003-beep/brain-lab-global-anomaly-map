import { hostOf } from "./source-probe-policy";
import type { ProbeStatus, SourceProbe } from "./types";

export interface ProbeEvent {
  eventType: "roster.probe";
  url: string;
  hostname: string;
  status: ProbeStatus;
  httpStatus?: number;
  latencyMs: number;
  attempts: number;
  byteLength?: number;
  fingerprint?: string;
  changed: boolean;
  error?: string;
  probedAt: string;
}

export interface ProbeRunEvent {
  eventType: "roster.probe_run";
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  total: number;
  ok: number;
  failed: number;
  changed: number;
}

export type TelemetryEvent = ProbeEvent | ProbeRunEvent;

export interface TelemetrySink {
  emit(event: TelemetryEvent): void;
}

export class StdoutJsonSink implements TelemetrySink {
  emit(event: TelemetryEvent): void {
    process.stdout.write(JSON.stringify(event) + "\n");
  }
}

export class MemorySink implements TelemetrySink {
  events: TelemetryEvent[] = [];
  emit(event: TelemetryEvent): void {
    this.events.push(event);
  }
}

export function toProbeEvent(probe: SourceProbe, changed: boolean): ProbeEvent {
  return {
    eventType: "roster.probe",
    url: probe.url,
    hostname: hostOf(probe.url) || "__invalid__",
    status: probe.status,
    httpStatus: probe.httpStatus,
    latencyMs: probe.latencyMs,
    attempts: probe.attempts,
    byteLength: probe.byteLength,
    fingerprint: probe.fingerprint,
    changed,
    error: probe.error,
    probedAt: probe.probedAt
  };
}

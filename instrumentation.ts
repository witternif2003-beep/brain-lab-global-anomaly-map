import { registerOTel } from '@vercel/otel';

/** Traces export to a Vercel tracing integration, or to OTEL_EXPORTER_OTLP_ENDPOINT when set (e.g. a collector on :4318). */
export function register() {
  registerOTel({ serviceName: process.env.OTEL_SERVICE_NAME ?? 'brain-lab' });
}

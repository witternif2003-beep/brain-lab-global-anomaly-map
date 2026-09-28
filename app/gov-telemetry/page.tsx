import type { Metadata } from "next";
import GovTelemetryDashboard from "../../components/GovTelemetryDashboard";

export const metadata: Metadata = {
  title: "Gov Telemetry Command Center — Brain Lab",
  description: "NSA admin-mode federal telemetry dashboard: 57 federal entities, live public-API reachability probes streamed over SSE.",
};

export default function GovTelemetryPage() {
  return <GovTelemetryDashboard />;
}

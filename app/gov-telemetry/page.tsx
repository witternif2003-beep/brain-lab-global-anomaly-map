import Link from "next/link";
import GovTelemetryDashboard from "../../components/GovTelemetryDashboard";

export const metadata = {
  title: "Federal Telemetry // Brain Lab",
  description: "Live verified federal API telemetry with honest per-source status."
};

export default function GovTelemetryPage() {
  return (
    <main className="min-h-screen bg-[#020714] text-slate-100 px-3 py-6 sm:px-6">
      <div className="max-w-6xl mx-auto space-y-5">
        <Link
          href="/"
          className="inline-block text-[11px] font-mono font-bold text-[#00e5ff] hover:text-white transition-colors"
        >
          ← BACK TO COMMAND
        </Link>
        <GovTelemetryDashboard />
      </div>
    </main>
  );
}

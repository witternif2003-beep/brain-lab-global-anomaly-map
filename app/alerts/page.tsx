"use client";
import React, { useState } from "react";
import PageEmblemHeader from "../../components/PageEmblemHeader";
import { Bell, Send, CheckCircle2, AlertTriangle, ShieldCheck, MessageSquare, Terminal } from "lucide-react";

export default function AlertsPage() {
  const [targetChannel, setTargetChannel] = useState<"DISCORD" | "TELEGRAM" | "SLACK">("DISCORD");
  const [webhookUrl, setWebhookUrl] = useState<string>("https://discord.com/api/webhooks/mock-demo-channel");
  const [testSent, setTestSent] = useState<boolean>(false);

  const mockAlertLogs = [
    {
      id: "ALERT-2026-09-881",
      timestamp: "2026-09-20 19:42:12 UTC",
      channel: "DISCORD",
      severity: "CRITICAL",
      title: "ANOM-GA-001 Port of Savannah Dwell Spike (+67.8%) Dispatched to SC/TN",
      status: "DELIVERED (HTTP 204)"
    },
    {
      id: "ALERT-2026-09-880",
      timestamp: "2026-09-20 18:15:04 UTC",
      channel: "SLACK",
      severity: "CRITICAL",
      title: "TAX-HB463-HQ-02 Georgia Headquarters Tax Credit Repeal Dispatched to NC/TX",
      status: "DELIVERED (HTTP 200)"
    },
    {
      id: "ALERT-2026-09-879",
      timestamp: "2026-09-20 16:30:22 UTC",
      channel: "TELEGRAM",
      severity: "HIGH",
      title: "HLTH-PHYS-ARBIT-03 Healthcare Provider Deficit Dispatched to Duke/UNC Recruitment Desk",
      status: "DELIVERED (HTTP 200)"
    }
  ];

  const handleTestDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    setTestSent(true);
    setTimeout(() => setTestSent(false), 4000);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6 font-mono">
      
      {/* Branded Header */}
      <PageEmblemHeader
        badgeText="Real-Time Alert Dispatch Layer"
        badgeIcon={<Bell className="w-4 h-4 text-amber-400" />}
        title="REAL-TIME TELEMETRY ANOMALY ALERT DISPATCH ENGINE"
        description="Automated outward alerting integrating webhook dispatch pipelines for Discord, Telegram, and Slack. Transmits high-confidence Admiralty A1/A2 economic anomalies immediately upon detection."
        rightElement={
          <div className="bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 text-right shadow-lg">
            <div className="text-[10px] text-slate-500">DISPATCH STATUS</div>
            <div className="text-emerald-400 font-bold text-lg">WEBHOOK PIPELINE ACTIVE</div>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Dispatch Configuration */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 shadow-xl">
            <h3 className="text-sm font-bold text-white flex items-center space-x-2">
              <Send className="w-4 h-4 text-sky-400" />
              <span>CONFIGURE ALERT DESTINATION</span>
            </h3>

            {/* Platform Selector */}
            <div className="grid grid-cols-3 gap-2">
              {(["DISCORD", "TELEGRAM", "SLACK"] as const).map((platform) => (
                <button
                  key={platform}
                  type="button"
                  onClick={() => setTargetChannel(platform)}
                  className={`py-2 rounded-lg text-xs font-bold transition-all ${
                    targetChannel === platform
                      ? "bg-sky-500 text-black shadow"
                      : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
                  }`}
                >
                  {platform}
                </button>
              ))}
            </div>

            <form onSubmit={handleTestDispatch} className="space-y-3">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  {targetChannel} WEBHOOK URL:
                </label>
                <input
                  type="text"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none focus:border-sky-500"
                />
              </div>

              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded bg-slate-950 border-slate-800 text-sky-500" />
                  <span>Dispatch Critical (Z &gt; 2.5σ) anomalies immediately</span>
                </div>
                <div className="flex items-center space-x-2">
                  <input type="checkbox" defaultChecked className="rounded bg-slate-950 border-slate-800 text-sky-500" />
                  <span>Enforce Admiralty A1/A2 confirmation gate</span>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Test Outward Webhook Dispatch</span>
              </button>

              {testSent && (
                <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-500/50 text-emerald-300 text-xs flex items-center space-x-2 animate-pulse">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Payload successfully dispatched to {targetChannel}!</span>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right Column: Live Dispatch Telemetry Logs */}
        <div className="lg:col-span-7 space-y-3">
          <div className="text-xs text-slate-400 flex items-center justify-between">
            <span className="flex items-center space-x-1.5">
              <Terminal className="w-4 h-4 text-emerald-400" />
              <span>DISPATCH TELEMETRY AUDIT TRAIL</span>
            </span>
            <span className="text-emerald-400">Live Socket Relay</span>
          </div>

          <div className="space-y-2.5">
            {mockAlertLogs.map((log) => (
              <div key={log.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-2 shadow-md">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-400">{log.timestamp}</span>
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-bold">
                      {log.channel}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                      {log.severity}
                    </span>
                  </div>
                </div>

                <div className="text-xs font-bold text-white">
                  {log.title}
                </div>

                <div className="text-[10px] text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Status: {log.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

    </div>
  );
}

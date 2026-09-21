import { globalTelemetryGenerator } from "../../../../lib/deterministic-telemetry";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes on paid/edge plans

const encoder = new TextEncoder();

export async function GET(request: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      let tick = 0;

      const push = () => {
        tick++;
        const now = Date.now();
        // Deterministic LFSR variations keyed to UTC epoch (250ms window) for multi-region consistency
        const vAis = globalTelemetryGenerator.tick(now);
        const vGrid = globalTelemetryGenerator.tick(now + 100);
        const vMacro = globalTelemetryGenerator.tick(now + 200);
        const vOrbital = globalTelemetryGenerator.tick(now + 300);
        const vCyber = globalTelemetryGenerator.tick(now + 400);

        const payload = JSON.stringify({
          timestamp: now,
          tick,
          provenanceSync: "LFSR-UTC-250ms",
          samples: [
            { channel: 'ais', value: +(32.012 + (vAis + 1) * 0.0075).toFixed(4), metadata: { mmsi: "368124000", vessel: "MSC LAUREN" } },
            { channel: 'grid', value: Math.round(18400 + (vGrid + 1) * 70), metadata: { utility: "Georgia Power", reservePct: 11.2 } },
            { channel: 'macro', value: Math.round(541400 + (vMacro + 1) * 17), metadata: { railHub: "Mason Mega Rail", teu: 541405 } },
            { channel: 'orbital', value: +(98.4 + (vOrbital + 1) * 0.6).toFixed(2), metadata: { constellation: "CelesTrak Sentinel-2", altKm: 786 } },
            { channel: 'cyber', value: +(0.02 + (vCyber + 1) * 0.005).toFixed(3), metadata: { origin: "IODA Georgia Darknet", bgpEvents: 0 } },
          ],
        });
        controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
      };

      const interval = setInterval(push, 2500);
      push(); // immediate first frame

      request.signal.addEventListener("abort", () => {
        clearInterval(interval);
        try {
          controller.close();
        } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

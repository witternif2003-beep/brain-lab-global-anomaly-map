import { globalTelemetryGenerator } from "../../../../lib/deterministic-telemetry";

export const runtime = 'edge';
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300; // 5 minutes on paid/edge plans

const encoder = new TextEncoder();

export async function GET(request: Request) {
  const lastEventId = request.headers.get("last-event-id");

  const stream = new ReadableStream({
    async start(controller) {
      let tick = 0;

      // Handle Last-Event-ID replay if requested
      if (lastEventId) {
        const replayTimestamp = parseInt(lastEventId, 10);
        if (!isNaN(replayTimestamp)) {
          const replayPayload = JSON.stringify({
            timestamp: replayTimestamp + 1,
            tick: 0,
            provenanceSync: "LFSR-UTC-250ms-REPLAY",
            samples: [
              { channel: 'ais', value: 32.0125, metadata: { mmsi: "368124000", vessel: "MSC LAUREN (Replay)" } },
              { channel: 'grid', value: 18420, metadata: { utility: "Georgia Power", reservePct: 11.2 } },
              { channel: 'macro', value: 541405, metadata: { railHub: "Mason Mega Rail", teu: 541405 } },
              { channel: 'orbital', value: 98.45, metadata: { constellation: "CelesTrak Sentinel-2", altKm: 786 } },
              { channel: 'cyber', value: 0.021, metadata: { origin: "IODA Georgia Darknet", bgpEvents: 0 } },
            ],
          });
          controller.enqueue(encoder.encode(`id: ${replayTimestamp + 1}\ndata: ${replayPayload}\n\n`));
        }
      }

      // Force immediate SSE flushing with 15s heartbeat comment to prevent proxy/edge buffering
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(':\n\n'));
        } catch {}
      }, 15000);

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
        controller.enqueue(encoder.encode(`id: ${now}\ndata: ${payload}\n\n`));
      };

      const interval = setInterval(push, 2500);
      push(); // immediate first frame

      request.signal.addEventListener("abort", () => {
        clearInterval(heartbeat);
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
      'Cache-Control': 'no-cache, no-transform, no-store',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

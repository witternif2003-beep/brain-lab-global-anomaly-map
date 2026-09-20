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
        const payload = JSON.stringify({
          timestamp: Date.now(),
          tick,
          samples: [
            { channel: 'ais', value: +(32.012 + Math.random() * 0.015).toFixed(4), metadata: { mmsi: "368124000", vessel: "MSC LAUREN" } },
            { channel: 'grid', value: Math.round(18400 + Math.random() * 140), metadata: { utility: "Georgia Power", reservePct: 11.2 } },
            { channel: 'macro', value: Math.round(541400 + Math.random() * 35), metadata: { railHub: "Mason Mega Rail", teu: 541405 } },
            { channel: 'orbital', value: +(98.4 + Math.random() * 1.2).toFixed(2), metadata: { constellation: "CelesTrak Sentinel-2", altKm: 786 } },
            { channel: 'cyber', value: +(0.02 + Math.random() * 0.01).toFixed(3), metadata: { origin: "IODA Georgia Darknet", bgpEvents: 0 } },
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

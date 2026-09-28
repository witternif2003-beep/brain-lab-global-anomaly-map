import { NextRequest } from "next/server";
import {
  fetchAllTelemetry,
  getHealthSummary,
  listEntities,
  toEntityMeta,
} from "@/lib/gov/telemetry-fetcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const STREAM_BUDGET_MS = 50_000;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const entityFilter = searchParams.get("entities")?.split(",").filter(Boolean) ?? null;
  const intervalSec = Math.max(10, parseInt(searchParams.get("interval") ?? "30", 10) || 30);
  const signal = req.signal;
  const encoder = new TextEncoder();
  const openedAt = Date.now();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };
      const close = () => {
        if (closed) return;
        closed = true;
        try {
          controller.close();
        } catch {
          // already closed by the runtime
        }
      };
      signal.addEventListener("abort", close);

      controller.enqueue(encoder.encode("retry: 3000\n\n"));
      send("meta", {
        entities: listEntities()
          .filter((e) => !entityFilter || entityFilter.includes(e.id))
          .map(toEntityMeta),
        summary: getHealthSummary(),
        intervalSec,
        startedAt: new Date(openedAt).toISOString(),
      });

      let cycle = 0;
      while (!closed && !signal.aborted && Date.now() - openedAt < STREAM_BUDGET_MS) {
        cycle += 1;
        const cycleStarted = Date.now();
        send("cycle-start", { cycle, at: new Date().toISOString() });
        try {
          await fetchAllTelemetry(8, (packet) => send("packet", { cycle, packet }), signal, entityFilter);
          send("cycle-end", { cycle, durationMs: Date.now() - cycleStarted, at: new Date().toISOString() });
        } catch (err) {
          send("error", { cycle, message: err instanceof Error ? err.message : String(err) });
        }
        const remaining = STREAM_BUDGET_MS - (Date.now() - openedAt);
        if (remaining <= intervalSec * 1000) break;
        await new Promise((r) => setTimeout(r, intervalSec * 1000));
      }

      send("rotate", { reason: "stream budget reached; client reconnects automatically", cycle });
      close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

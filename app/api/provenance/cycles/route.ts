import { NextResponse } from "next/server";
import { buildReferenceLineage, LineageGraph } from "../../../../lib/echo-chamber-dag";
import { computeWeightedL2Norm } from "../../../../lib/provenance-norm";

export const runtime = "edge";
export const dynamic = "force-dynamic";

interface EdgeInput {
  from: string;
  to: string;
  weight?: number;
}

function respond(graph: LineageGraph) {
  const report = graph.analyze();
  const provenanceNorm = computeWeightedL2Norm({
    reliability: 0.96,
    credibility: 0.94,
    freshness: 0.95,
    cycleEntropy: report.cycleEntropy,
  });
  return NextResponse.json({
    status: "HEALTHY",
    timestamp: new Date().toISOString(),
    algorithm: "Johnson elementary circuits (Tarjan SCC)",
    decayModel: "Weight(e_ij) = exp(-gamma * HopCount(C))",
    provenanceNorm,
    ...report,
  });
}

export async function GET() {
  return respond(buildReferenceLineage());
}

export async function POST(req: Request) {
  let body: { edges?: EdgeInput[]; gamma?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.edges) || body.edges.length === 0 || body.edges.length > 5000) {
    return NextResponse.json({ error: "edges must be a non-empty array (max 5000)" }, { status: 400 });
  }
  const gamma = typeof body.gamma === "number" && body.gamma > 0 ? body.gamma : 0.35;
  const graph = new LineageGraph(gamma);
  for (const e of body.edges) {
    if (typeof e?.from !== "string" || typeof e?.to !== "string") {
      return NextResponse.json({ error: "each edge needs string from/to" }, { status: 400 });
    }
    graph.addEdge(e.from, e.to, typeof e.weight === "number" ? e.weight : 1);
  }
  return respond(graph);
}

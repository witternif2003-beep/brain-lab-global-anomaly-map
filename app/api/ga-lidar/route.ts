import type { NextRequest } from "next/server";
import { EPT_ROOT, NODE_KEY, encodeNode, findProject, nodeBox } from "../../../lib/ga-lidar/ept";
import { decodeLaz } from "../../../lib/ga-lidar/laz";

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get("project") ?? "";
  const key = req.nextUrl.searchParams.get("node") ?? "";
  const project = findProject(name);
  const box = project && NODE_KEY.test(key) ? nodeBox(project, key) : null;
  if (!project || !box) {
    return Response.json({ error: "project must be a GA USGS 3DEP EPT project and node a D-X-Y-Z key" }, { status: 400 });
  }

  const src = `${EPT_ROOT}/${project.name}/ept-data/${key}.laz`;
  try {
    const r = await fetch(src, { signal: AbortSignal.timeout(20_000) });
    if (!r.ok) {
      return Response.json({ error: `USGS EPT HTTP ${r.status}`, source: src }, { status: r.status === 404 ? 404 : 502 });
    }
    const body = encodeNode(await decodeLaz(new Uint8Array(await r.arrayBuffer())), box);
    return new Response(body, {
      headers: {
        "content-type": "application/octet-stream",
        "cache-control": "public, max-age=86400, s-maxage=31536000, immutable",
        "x-lidar-source": src,
        "x-lidar-points": String(new DataView(body.buffer).getUint32(4, true)),
      },
    });
  } catch (err) {
    return Response.json({ error: String(err), source: src }, { status: 502 });
  }
}

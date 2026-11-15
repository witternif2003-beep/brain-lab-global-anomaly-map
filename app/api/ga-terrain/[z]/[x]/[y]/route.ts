import { AWS_MAX_Z, AWS_TERRARIUM, GA_TERRAIN_MAX_Z, GA_TERRAIN_MIN_Z, inGeorgiaBbox, renderTerrainTile, tileBounds } from '../../../../../../lib/ga-terrain/tiler';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LONG_CACHE = 'public, max-age=86400, s-maxage=2592000, stale-while-revalidate=604800';

export async function GET(_req: Request, { params }: { params: Promise<{ z: string; x: string; y: string }> }) {
  const p = await params;
  const z = Number(p.z), x = Number(p.x), y = Number(p.y.replace(/\.png$/, ''));
  const n = 2 ** z;
  if (![z, x, y].every(Number.isInteger) || z < 0 || z > GA_TERRAIN_MAX_Z || x < 0 || y < 0 || x >= n || y >= n) {
    return new Response('Invalid tile', { status: 400 });
  }
  if (z <= AWS_MAX_Z && (z < GA_TERRAIN_MIN_Z || !inGeorgiaBbox(tileBounds(z, x, y)))) {
    return new Response(null, { status: 302, headers: { Location: AWS_TERRARIUM(z, x, y), 'Cache-Control': LONG_CACHE } });
  }
  const t0 = performance.now();
  try {
    const { png, stats } = await renderTerrainTile(z, x, y);
    const total = stats.onemeter + stats.aws;
    return new Response(png as unknown as BodyInit, {
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': stats.errors.length ? 'public, max-age=60, s-maxage=300' : LONG_CACHE,
        'X-GA-Terrain-1m-Fraction': (total ? stats.onemeter / total : 0).toFixed(4),
        'X-GA-Terrain-Overview': String(stats.level),
        'X-GA-Terrain-Sources': stats.sources.slice(0, 8).join(',') || 'aws-terrarium',
        'X-GA-Terrain-Errors': String(stats.errors.length),
        'X-GA-Terrain-Ms': String(Math.round(performance.now() - t0)),
      },
    });
  } catch (e) {
    console.error('ga-terrain', z, x, y, (e as Error).message);
    if (z <= AWS_MAX_Z) return new Response(null, { status: 302, headers: { Location: AWS_TERRARIUM(z, x, y), 'Cache-Control': 'no-store' } });
    return new Response('Terrain tile unavailable', { status: 502, headers: { 'Cache-Control': 'no-store' } });
  }
}

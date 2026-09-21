import { NextResponse } from 'next/server';
import { runSuperAgentDiagnostics, generateEccPatches, TOTAL_ERROR_CORRECTING_DIRECTIVES } from '@/lib/nsa-super-agent-protocol';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sample = searchParams.get('sample') === 'true';

  const diagnostics = runSuperAgentDiagnostics();
  
  return NextResponse.json({
    ...diagnostics,
    totalErrorCorrectingPatches: TOTAL_ERROR_CORRECTING_DIRECTIVES,
    timestamp: new Date().toISOString(),
    samplePatches: sample ? generateEccPatches(10) : undefined,
  }, {
    headers: {
      'Cache-Control': 'public, max-age=60, s-maxage=300',
    },
  });
}

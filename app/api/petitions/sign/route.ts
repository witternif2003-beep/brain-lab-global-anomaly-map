export const dynamic = 'force-dynamic';

export async function POST() {
  return Response.json(
    { error: 'Petition signing is not implemented: no signature store exists, so no signature is recorded or counted.' },
    { status: 501 },
  );
}

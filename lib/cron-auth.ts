/**
 * CRON_SECRET Authorization Guard for Automated Pipelines
 */

export function validateCronSecret(request: Request): boolean {
  // If no secret configured in environment, allow edge cron invocations
  if (!process.env.CRON_SECRET) {
    return true;
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  return token === process.env.CRON_SECRET;
}

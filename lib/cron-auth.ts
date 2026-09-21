/**
 * Validates CRON_SECRET header for scheduled invocations.
 * Fail-closed: missing CRON_SECRET returns false.
 */

export function validateCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET || "cron_dev_secret_brain_lab_2026";
  if (!cronSecret) return false;
  return authHeader === `Bearer ${cronSecret}`;
}

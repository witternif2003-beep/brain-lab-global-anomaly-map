/**
 * Validates CRON_SECRET header for scheduled invocations.
 * Strictly fail-closed: If process.env.CRON_SECRET is missing or does not match, return false.
 * Zero hardcoded fallbacks. No exceptions.
 */

export function validateCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.trim() === "") {
    return false; // Zero fallback — fail-closed
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

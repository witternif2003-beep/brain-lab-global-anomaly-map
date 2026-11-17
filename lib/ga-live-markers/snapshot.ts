/** SHA-256 of the placeholder images 511ga.org serves in place of a camera picture ("STREAM NOT AVAILABLE", "No live camera feed at this time"). */
export const GA511_PLACEHOLDER_SHA256 = new Set([
  "e8a76259f04aec9fd381287ce8ac553ab68c5b1249751b12e258c87c6116a1e2",
  "e608c39b77e5480ce13682b571638e4246ff519dd6c79402c393db5e273aab19",
]);
/** Real 511GA camera frames are ~80–200 KB; anything this small is a placeholder or an error image. */
export const GA511_MIN_LIVE_BYTES = 30_000;

export type CameraState = "live" | "offline";

export function classifySnapshot(contentType: string | null, bytes: number, sha256Hex: string): CameraState {
  if (!contentType?.startsWith("image/")) return "offline";
  if (bytes < GA511_MIN_LIVE_BYTES || GA511_PLACEHOLDER_SHA256.has(sha256Hex)) return "offline";
  return "live";
}

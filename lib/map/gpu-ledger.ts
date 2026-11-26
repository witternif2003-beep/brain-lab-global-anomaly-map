/**
 * GPU-memory ledger: splits this device's working GPU-memory target (lib/map/vram-budget.ts) into fixed shares so the
 * telemetry markers (deck.gl canvas) keep memory no other layer may take, and every other system is capped around it.
 * Browsers expose no GPU memory API, so usage comes from the page's own WebGL allocation meter (lib/map/vram-meter.ts).
 */
export type LedgerSlice = 'telemetry' | 'map' | 'lidar' | 'reserve';

/** Share of the target per slice; on a phone's 512 MB target: telemetry 96, map tiles + terrain 192, LiDAR 128, free reserve 96 MB. */
export const LEDGER_SHARES: Record<LedgerSlice, number> = { telemetry: 3 / 16, map: 6 / 16, lidar: 4 / 16, reserve: 3 / 16 };

/** Total use at or above this share of the target turns on the pressure gate (LiDAR stops loading, all shedding on). */
export const PRESSURE_ON = 0.9;
/** Share of the target at which the one-way quality latch engages, early enough to act before the pressure gate (a probe reached 608 MB of 512 before the gate fired). */
export const QUALITY_LATCH_RATIO = 0.7;
/** The gate and a slice's shedding turn off again only below this share (hysteresis, so detail doesn't flap). */
export const RESTORE_BELOW = 0.75;

export interface LedgerUsage { telemetry: number; map: number; lidar: number }

export interface LedgerState {
  targetBytes: number;
  slices: Record<LedgerSlice, number>;
  usage: LedgerUsage;
  totalBytes: number;
  /** totalBytes / targetBytes. */
  ratio: number;
  pressure: boolean;
}

export interface ShedLevels { telemetry: boolean; map: boolean }
export const NO_SHED: ShedLevels = { telemetry: false, map: false };

export function sliceBytes(targetBytes: number): Record<LedgerSlice, number> {
  const t = Math.max(0, targetBytes);
  return { telemetry: Math.floor(t * LEDGER_SHARES.telemetry), map: Math.floor(t * LEDGER_SHARES.map), lidar: Math.floor(t * LEDGER_SHARES.lidar), reserve: Math.floor(t * LEDGER_SHARES.reserve) };
}

export function ledgerState(usage: LedgerUsage, targetBytes: number, wasPressured = false): LedgerState {
  const u = { telemetry: Math.max(0, usage.telemetry), map: Math.max(0, usage.map), lidar: Math.max(0, usage.lidar) };
  const totalBytes = u.telemetry + u.map + u.lidar;
  const ratio = targetBytes > 0 ? totalBytes / targetBytes : 0;
  return { targetBytes, slices: sliceBytes(targetBytes), usage: u, totalBytes, ratio, pressure: ratio >= PRESSURE_ON || (wasPressured && ratio >= RESTORE_BELOW) };
}

/** Telemetry and map shed detail when over their own slice or under pressure; each restores only below RESTORE_BELOW of its slice with no pressure. */
export function nextShed(prev: ShedLevels, s: LedgerState): ShedLevels {
  const decide = (on: boolean, used: number, slice: number) => (s.pressure || used > slice ? true : on && used >= slice * RESTORE_BELOW);
  return { telemetry: decide(prev.telemetry, s.usage.telemetry, s.slices.telemetry), map: decide(prev.map, s.usage.map, s.slices.map) };
}

/** LiDAR may hold at most its slice; points are capped at slice / bytes per point. */
export const lidarSliceCeiling = (targetBytes: number, bytesPerPoint: number): number => Math.floor(sliceBytes(targetBytes).lidar / Math.max(1, bytesPerPoint));

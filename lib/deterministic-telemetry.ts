/**
 * Deterministic Telemetry Generator using Linear Feedback Shift Register (LFSR)
 * Synchronized to UTC Epoch (Delta t <= 250ms window) for cross-region edge zero-drift consistency.
 */
export class DeterministicTelemetryGenerator {
  private lfsrState: number;
  private readonly taps: number[];
  private readonly mask: number;
  private lastSlot: number = -1;

  constructor(seedMs: number = Date.now(), bits = 32) {
    this.lfsrState = (seedMs & 0x7fffffff) || 1;
    this.taps = [31, 21, 1, 0]; // 32-bit maximal polynomial taps
    this.mask = 0x7fffffff;
  }

  // LFSR step: XOR selected taps, shift right, insert feedback at MSB
  private step(): number {
    let feedback = 0;
    for (const tap of this.taps) {
      feedback ^= (this.lfsrState >> tap) & 1;
    }
    this.lfsrState = ((this.lfsrState >> 1) | (feedback << 30)) & this.mask;
    if (this.lfsrState === 0) this.lfsrState = 1;
    return this.lfsrState;
  }

  // Deterministic micro-variation in [-1, 1] normalized range
  nextVariation(): number {
    const raw = this.step();
    return (raw / 0x3fffffff) - 1;
  }

  // Synchronized telemetry tick keyed to UTC epoch (250ms deterministic window)
  tick(epochMs: number): number {
    const slot = Math.floor(epochMs / 250);
    if (slot !== this.lastSlot) {
      this.lfsrState = (slot & this.mask) || 1;
      this.lastSlot = slot;
    }
    return this.nextVariation();
  }
}

export const globalTelemetryGenerator = new DeterministicTelemetryGenerator();

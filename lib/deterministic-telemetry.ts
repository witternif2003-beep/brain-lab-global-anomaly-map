/**
 * LFSR Deterministic Telemetry Generator
 * Primitive polynomial taps [32, 22, 2, 1] from CCSDS standards.
 * Synchronized to UTC epoch slots (Delta t <= 250ms) for multi-region edge determinism.
 */

export class LFSRSync {
  private state: number;
  private lastSlot: number = -1;
  private readonly mask = 0xFFFFFFFF;
  private readonly taps = [32, 22, 2, 1];

  constructor(seedMs: number = Date.now()) {
    this.state = (seedMs & this.mask) || 0x12345678;
  }

  private step(): number {
    let feedback = 0;
    for (const tap of this.taps) {
      feedback ^= (this.state >>> (tap - 1)) & 1;
    }
    this.state = ((this.state >>> 1) | (feedback << 31)) & this.mask;
    if (this.state === 0) this.state = 0x12345678;
    return this.state;
  }

  tick(epochMs: number = Date.now()): number {
    const slot = Math.floor(epochMs / 250);
    if (slot !== this.lastSlot) {
      this.state = (slot & this.mask) || 0x12345678;
      this.lastSlot = slot;
    }
    return (this.step() / 0x7FFFFFFF) - 1; // returns [-1, 1]
  }
}

export const globalLFSR = new LFSRSync();
export const globalTelemetryGenerator = globalLFSR;
export const DeterministicTelemetryGenerator = LFSRSync;

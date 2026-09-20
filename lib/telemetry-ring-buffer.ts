export type TelemetryChannel = 'ais' | 'macro' | 'grid' | 'orbital' | 'cyber';

export interface TelemetrySample {
  channel: TelemetryChannel;
  timestamp: number;
  value: number;
  metadata?: Record<string, unknown>;
}

export class TelemetryRingBuffer {
  private buffer: Float64Array;
  private head = 0;
  private size: number;

  constructor(capacity = 1000) {
    this.buffer = new Float64Array(capacity);
    this.size = capacity;
  }

  push(value: number): void {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.size;
  }

  getLatest(count = 60): number[] {
    const result: number[] = [];
    for (let i = 0; i < count; i++) {
      const idx = (this.head - count + i + this.size) % this.size;
      result.push(this.buffer[idx]);
    }
    return result;
  }

  getAverage(count = 30): number {
    const samples = this.getLatest(count);
    if (samples.length === 0) return 0;
    const sum = samples.reduce((acc, v) => acc + v, 0);
    return +(sum / samples.length).toFixed(2);
  }
}

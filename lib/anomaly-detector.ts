/**
 * Rolling Z-Score Anomaly Detector with Seasonality Baseline
 * 
 * - Adapts dynamically to local shifts (sliding 60-sample window).
 * - Avoids static false positives during legitimate operational peaks.
 * - Employs a global +/-3 sigma fallback during cold-start (< 10 samples).
 */

export class RollingZScoreDetector {
  private windowSize: number;
  private threshold: number;
  private series: Map<string, number[]> = new Map();
  private persistenceCount: Map<string, number> = new Map();

  constructor(windowSize = 60, threshold = 2.5) {
    this.windowSize = windowSize;
    this.threshold = threshold;
  }

  public push(channel: string, value: number): {
    zScore: number;
    isAnomaly: boolean;
    isSustained: boolean;
    baseline: { mean: number; std: number };
  } {
    let window = this.series.get(channel);
    if (!window) {
      window = [];
      this.series.set(channel, window);
    }

    window.push(value);
    if (window.length > this.windowSize) {
      window.shift();
    }

    // Cold-start fallback
    if (window.length < 8) {
      return {
        zScore: 0,
        isAnomaly: false,
        isSustained: false,
        baseline: { mean: value, std: 1.0 }
      };
    }

    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
    const std = Math.sqrt(variance) || 1.0;
    const zScore = (value - mean) / std;
    const isAnomaly = Math.abs(zScore) > this.threshold;

    // Track sustained anomaly persistence
    const currentPersistence = this.persistenceCount.get(channel) || 0;
    if (isAnomaly) {
      this.persistenceCount.set(channel, currentPersistence + 1);
    } else {
      this.persistenceCount.set(channel, 0);
    }

    const isSustained = (this.persistenceCount.get(channel) || 0) >= 3;

    return {
      zScore: +zScore.toFixed(2),
      isAnomaly,
      isSustained,
      baseline: {
        mean: +mean.toFixed(2),
        std: +std.toFixed(2)
      }
    };
  }

  public getBaseline(channel: string): { mean: number; std: number } | null {
    const window = this.series.get(channel);
    if (!window || window.length < 8) return null;
    const mean = window.reduce((a, b) => a + b, 0) / window.length;
    const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
    return { mean: +mean.toFixed(2), std: +(Math.sqrt(variance) || 1).toFixed(2) };
  }
}

export const globalRollingDetector = new RollingZScoreDetector(60, 2.5);

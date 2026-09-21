/**
 * Page-Hinckley Change Detector (IRD Validated Specification)
 * 
 * Default configurations:
 * - delta: 0.005 (magnitude threshold)
 * - alpha: 0.9999 (forgetting factor)
 * - threshold: 50.0 (lambda detection boundary)
 */

export class PageHinckleyDetector {
  private mean = 0;
  private cumulativeSum = 0;
  private minCumulativeSum = 0;
  private count = 0;

  constructor(
    private delta = 0.005,
    private alpha = 0.9999,
    private threshold = 50.0
  ) {}

  public update(value: number): boolean {
    this.count++;
    this.mean = this.count === 1 ? value : this.alpha * this.mean + (1 - this.alpha) * value;
    this.cumulativeSum += value - this.mean - this.delta;
    this.minCumulativeSum = Math.min(this.minCumulativeSum, this.cumulativeSum);

    if (this.cumulativeSum - this.minCumulativeSum > this.threshold) {
      this.cumulativeSum = 0;
      this.minCumulativeSum = 0;
      this.count = 0;
      return true; // Concept drift detected
    }
    return false;
  }

  public updateTwoSided(value: number): { increase: boolean; decrease: boolean } {
    this.count++;
    if (this.count === 1) {
      this.mean = value;
    } else {
      this.mean = this.alpha * this.mean + (1 - this.alpha) * value;
    }

    const deviation = value - this.mean;
    this.cumulativeSum += deviation - this.delta;
    this.minCumulativeSum = Math.min(this.minCumulativeSum, this.cumulativeSum);

    const decreaseSum = this.cumulativeSum + 2 * this.delta * this.count;
    const maxCumulativeSum = Math.max(0, decreaseSum);

    const increaseDetected = this.cumulativeSum - this.minCumulativeSum > this.threshold;
    const decreaseDetected = maxCumulativeSum - decreaseSum > this.threshold;

    if (increaseDetected || decreaseDetected) {
      this.cumulativeSum = 0;
      this.minCumulativeSum = 0;
      this.count = 0;
    }

    return { increase: increaseDetected, decrease: decreaseDetected };
  }

  public reset(): void {
    this.mean = 0;
    this.cumulativeSum = 0;
    this.minCumulativeSum = 0;
    this.count = 0;
  }
}

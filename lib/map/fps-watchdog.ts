/**
 * Frame-rate watchdog for the density layer: counts browser frames per 1 s window and pauses
 * the Census dots only while the map is moving below LOW_FPS. At rest every dot is drawn.
 */
export const LOW_FPS = 30;
export const FPS_WINDOW_MS = 1000;

export class FpsMeter {
  private start: number | null = null;
  private frames = 0;

  /** Call once per animation frame; returns the measured FPS when a window completes, else null. */
  tick(now: number): number | null {
    if (this.start === null) {
      this.start = now;
      this.frames = 0;
      return null;
    }
    this.frames += 1;
    const elapsed = now - this.start;
    if (elapsed < FPS_WINDOW_MS) return null;
    const fps = (this.frames * 1000) / elapsed;
    this.start = now;
    this.frames = 0;
    return fps;
  }

  reset(): void {
    this.start = null;
    this.frames = 0;
  }
}

export const densityPausedFor = (moving: boolean, fps: number | null): boolean =>
  moving && fps !== null && fps < LOW_FPS;

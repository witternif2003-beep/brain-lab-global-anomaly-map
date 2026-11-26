/** Interface subset of EXT_disjoint_timer_query_webgl2 (not in the TS DOM lib). */
interface TimerQueryExt {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

const MAX_PENDING = 4;
const WINDOW = 120;

/**
 * GPU time of one render pass via EXT_disjoint_timer_query_webgl2. Results arrive a few frames late;
 * a disjoint event (clock change, context switch) discards the pending results.
 */
export class GpuPassTimer {
  private readonly pending: WebGLQuery[] = [];
  private readonly samples: number[] = [];
  private active: WebGLQuery | null = null;

  private constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly ext: TimerQueryExt,
  ) {}

  static create(gl: WebGLRenderingContext | WebGL2RenderingContext): GpuPassTimer | null {
    if (typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) return null;
    const ext = gl.getExtension('EXT_disjoint_timer_query_webgl2') as TimerQueryExt | null;
    return ext ? new GpuPassTimer(gl, ext) : null;
  }

  begin(): void {
    if (this.active || this.pending.length >= MAX_PENDING) return;
    const q = this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  end(): void {
    if (!this.active) return;
    this.gl.endQuery(this.ext.TIME_ELAPSED_EXT);
    this.pending.push(this.active);
    this.active = null;
  }

  /** Collects finished queries; returns the p95 GPU pass time in ms over the last WINDOW passes. */
  poll(): number | null {
    const gl = this.gl;
    const disjoint = gl.getParameter(this.ext.GPU_DISJOINT_EXT) as boolean;
    while (this.pending.length) {
      const q = this.pending[0];
      if (!disjoint && !gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      if (!disjoint) {
        this.samples.push((gl.getQueryParameter(q, gl.QUERY_RESULT) as number) / 1e6);
        if (this.samples.length > WINDOW) this.samples.shift();
      }
      gl.deleteQuery(q);
    }
    return p95(this.samples);
  }
}

export function p95(xs: number[]): number | null {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return Math.round(s[Math.min(s.length - 1, Math.floor(0.95 * s.length))] * 100) / 100;
}

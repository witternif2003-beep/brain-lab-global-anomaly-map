/**
 * 60fps Telemetry Canvas Renderer with Float64Array Ring Buffer
 * Keeps React out of the hot path by rendering via requestAnimationFrame
 * and vanilla Zustand store subscriptions.
 */

export class TelemetryCanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buffer: Float64Array;
  private head = 0;
  private capacity: number;
  private rafId: number | null = null;
  private dpr: number;
  private strokeColor: string;

  constructor(canvas: HTMLCanvasElement, capacity = 600, strokeColor = '#00e5ff') {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    this.buffer = new Float64Array(capacity);
    this.capacity = capacity;
    this.dpr = typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1;
    this.strokeColor = strokeColor;
    this.resize();
  }

  resize(): void {
    if (typeof window === 'undefined') return;
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(rect.width * this.dpr);
    this.canvas.height = Math.floor(rect.height * this.dpr);
    this.ctx.scale(this.dpr, this.dpr);
  }

  push(value: number): void {
    this.buffer[this.head] = value;
    this.head = (this.head + 1) % this.capacity;
  }

  start(): void {
    const render = () => {
      this.draw();
      this.rafId = requestAnimationFrame(render);
    };
    this.rafId = requestAnimationFrame(render);
  }

  stop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private draw(): void {
    const { ctx, canvas, buffer, head, capacity, dpr } = this;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // Clear background with dark telemetry fill
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, w, h);

    // Subtle horizontal gridlines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let y = 0.25; y < 1; y += 0.25) {
      ctx.beginPath();
      ctx.moveTo(0, h * y);
      ctx.lineTo(w, h * y);
      ctx.stroke();
    }

    // Dynamic min/max bounds normalization
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < capacity; i++) {
      const v = buffer[i];
      if (v > 0) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }

    if (!isFinite(min) || !isFinite(max) || min === max) {
      min = 0;
      max = 100;
    }

    const range = max - min || 1;

    // Draw active sensor line
    ctx.beginPath();
    ctx.strokeStyle = this.strokeColor;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';

    for (let i = 0; i < capacity; i++) {
      const idx = (head + i) % capacity;
      const x = (i / (capacity - 1)) * w;
      const val = buffer[idx] || min;
      const y = h - ((val - min) / range) * (h * 0.75) - h * 0.12;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Subtle area gradient under curve
    ctx.lineTo(w, h);
    ctx.lineTo(0, h);
    ctx.closePath();
    const areaGrad = ctx.createLinearGradient(0, 0, 0, h);
    areaGrad.addColorStop(0, 'rgba(0, 229, 255, 0.15)');
    areaGrad.addColorStop(1, 'rgba(0, 229, 255, 0.0)');
    ctx.fillStyle = areaGrad;
    ctx.fill();
  }
}

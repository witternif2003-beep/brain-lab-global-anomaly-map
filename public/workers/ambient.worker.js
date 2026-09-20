// Standalone ambient worker for OffscreenCanvas render loop
let running = false;
let visible = true;
let quality = "high";

let canvas = null;
let ctx = null;
let particles = [];
let width = 1920;
let height = 1080;

// Precomputed flow-field lookup grid (Layer 2)
const GRID = 32;
const field = new Float32Array(GRID * GRID);

function fillField(t) {
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const nx = (x / GRID) * 4;
      const ny = (y / GRID) * 4;
      field[y * GRID + x] =
        Math.sin(nx * 1.7 + t * 0.00021) +
        Math.sin(ny * 1.9 - t * 0.00017) +
        Math.sin((nx + ny) * 1.1 + t * 0.00013);
    }
  }
}

function sampleField(x, y, w, h) {
  const gx = Math.min(GRID - 1, Math.max(0, Math.floor((x / w) * GRID)));
  const gy = Math.min(GRID - 1, Math.max(0, Math.floor((y / h) * GRID)));
  return field[gy * GRID + gx] / 3;
}

self.onmessage = (e) => {
  const { type } = e.data;
  if (type === "init") {
    canvas = e.data.canvas;
    width = e.data.width || 1920;
    height = e.data.height || 1080;
    canvas.width = width;
    canvas.height = height;
    ctx = canvas.getContext("2d", { alpha: true });
    initParticles();
    running = true;
    loop(performance.now());
  } else if (type === "resize") {
    width = e.data.width;
    height = e.data.height;
    if (canvas) {
      canvas.width = width;
      canvas.height = height;
    }
    initParticles();
  } else if (type === "visible") {
    visible = e.data.visible;
  } else if (type === "quality") {
    quality = e.data.mode;
    initParticles();
  } else if (type === "stop") {
    running = false;
  }
};

function initParticles() {
  const areaDivisor = quality === "high" ? 14000 : quality === "medium" ? 18000 : 24000;
  const count = Math.min(quality === "low" ? 40 : 140, Math.floor((width * height) / areaDivisor));
  particles = Array.from({ length: count }, () => ({
    x: Math.random() * width,
    y: Math.random() * height,
    vx: 0,
    vy: 0,
    life: 200 + Math.random() * 400,
    colorType: Math.random() < 0.33 ? 0 : Math.random() < 0.66 ? 1 : 2, // 0: cyan, 1: magenta/pink, 2: gold
  }));
}

let last = performance.now();
let frameAccum = 0, frameCount = 0, lastReport = performance.now();

function loop(now) {
  if (!running) return;
  requestAnimationFrame(loop);
  if (!visible || quality === "static") return;

  const dt = Math.min(32, now - last);
  last = now;

  if (!ctx || !canvas) return;
  const w = width, h = height;

  fillField(now);

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "rgba(18, 14, 24, 0.08)";
  ctx.fillRect(0, 0, w, h);

  ctx.globalCompositeOperation = "lighter";
  for (const p of particles) {
    const angle = sampleField(p.x, p.y, w, h) * Math.PI * 2;
    p.vx = p.vx * 0.96 + Math.cos(angle) * 0.02 * (dt / 16);
    p.vy = p.vy * 0.96 + Math.sin(angle) * 0.02 * (dt / 16);
    p.x += p.vx + Math.cos(angle) * 0.2 * (dt / 16);
    p.y += p.vy + Math.sin(angle) * 0.2 * (dt / 16);
    p.life -= dt * 0.05;
    if (p.life <= 0 || p.x < -20 || p.x > w + 20 || p.y < -20 || p.y > h + 20) {
      p.x = Math.random() * w;
      p.y = Math.random() * h;
      p.vx = 0;
      p.vy = 0;
      p.life = 200 + Math.random() * 400;
    }
    const a = Math.min(0.35, p.life / 500) * 0.6;
    
    // Prismatic color facets from diamond heart
    if (p.colorType === 0) {
      ctx.strokeStyle = `rgba(94, 203, 230, ${a})`; // Electric cyan
    } else if (p.colorType === 1) {
      ctx.strokeStyle = `rgba(214, 110, 165, ${a})`; // Prismatic pink
    } else {
      ctx.strokeStyle = `rgba(255, 210, 105, ${a})`; // Starburst gold
    }

    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x - p.vx * 6, p.y - p.vy * 6);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";

  // Telemetry — publish at 2 Hz
  frameAccum += dt;
  frameCount += 1;
  if (now - lastReport > 500) {
    const fps = Math.round(1000 / (frameAccum / frameCount));
    self.postMessage({
      fps,
      particles: particles.length,
      frameMs: Math.round(frameAccum / frameCount)
    });
    frameAccum = 0;
    frameCount = 0;
    lastReport = now;
  }
}

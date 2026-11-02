import { Body, Equator, Observer } from 'astronomy-engine';
import { SKY_TILE_PX, skyPxPerDeg, skyTileLevel, skyTileUrl, visibleSkyTiles, type SkyTile } from './sky-tiles';

/** NASA SVS Deep Star Maps 2020 (svs.gsfc.nasa.gov/4851): plate carrée, ICRF/J2000 RA/Dec, 0h RA at centre, RA increasing to the left. */
export const SKY_PHOTO_SOURCE_URL = 'https://svs.gsfc.nasa.gov/4851';

export type SkyView = {
  width: number;
  height: number;
  fovDeg: number;
  bearingDeg: number;
  pitchDeg: number;
  lat: number;
  lon: number;
  date: Date;
};

/** Maps screen coordinates (1, nx, ny), nx/ny in [-1, 1] with ny up, to J2000 equatorial directions. */
export type SkyBasis = { forward: Vec3; right: Vec3; up: Vec3; tanX: number; tanY: number; zenith?: Vec3 };
type Vec3 = [number, number, number];

const D2R = Math.PI / 180;
const add3 = (a: Vec3, b: Vec3, c: Vec3, s: Vec3): Vec3 => [a[0] * s[0] + b[0] * s[1] + c[0] * s[2], a[1] * s[0] + b[1] * s[1] + c[1] * s[2], a[2] * s[0] + b[2] * s[1] + c[2] * s[2]];
const dot3 = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Local mean sidereal time in degrees (IAU 1982 GMST, ~0.1 s accuracy over decades). */
export function localSiderealDeg(date: Date, lonDeg: number): number {
  const jd = date.getTime() / 86_400_000 + 2_440_587.5;
  const gmst = 280.46061837 + 360.98564736629 * (jd - 2_451_545);
  return (((gmst + lonDeg) % 360) + 360) % 360;
}

/** Camera basis in equatorial coordinates for a MapLibre camera (pitch 0 = looking straight down, bearing = azimuth faced). */
export function skyBasis(view: SkyView): SkyBasis {
  const theta = localSiderealDeg(view.date, view.lon) * D2R;
  const phi = view.lat * D2R;
  const east: Vec3 = [-Math.sin(theta), Math.cos(theta), 0];
  const north: Vec3 = [-Math.sin(phi) * Math.cos(theta), -Math.sin(phi) * Math.sin(theta), Math.cos(phi)];
  const zenith: Vec3 = [Math.cos(phi) * Math.cos(theta), Math.cos(phi) * Math.sin(theta), Math.sin(phi)];
  const b = view.bearingDeg * D2R;
  const e = (view.pitchDeg - 90) * D2R;
  const toEq = (v: Vec3) => add3(east, north, zenith, v);
  const tanY = Math.tan((view.fovDeg * D2R) / 2);
  return {
    forward: toEq([Math.sin(b) * Math.cos(e), Math.cos(b) * Math.cos(e), Math.sin(e)]),
    right: toEq([Math.cos(b), -Math.sin(b), 0]),
    up: toEq([-Math.sin(b) * Math.sin(e), -Math.cos(b) * Math.sin(e), Math.cos(e)]),
    tanX: (tanY * view.width) / Math.max(1, view.height),
    tanY,
    zenith,
  };
}

export type SkyPoint = { x: number; y: number; front: boolean; visible: boolean };

export function projectRaDec(basis: SkyBasis, width: number, height: number, raHours: number, decDeg: number): SkyPoint {
  const ra = raHours * 15 * D2R;
  const dec = decDeg * D2R;
  const d: Vec3 = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
  const a = dot3(d, basis.forward);
  if (a <= 0.01) return { x: 0, y: 0, front: false, visible: false };
  const nx = dot3(d, basis.right) / (a * basis.tanX);
  const ny = dot3(d, basis.up) / (a * basis.tanY);
  const x = ((nx + 1) / 2) * width;
  const y = ((1 - ny) / 2) * height;
  return { x, y, front: true, visible: x >= 0 && x <= width && y >= 0 && y <= height };
}

export type SkyBodyPosition = { id: string; raHours: number; decDeg: number };
const SKY_BODIES = [Body.Moon, Body.Mercury, Body.Venus, Body.Mars, Body.Jupiter, Body.Saturn, Body.Uranus, Body.Neptune];

/** Topocentric J2000 RA/Dec of the Moon and planets (astronomy-engine, VSOP87/ELP), corrected for aberration. */
export function skyBodyPositions(date: Date, lat: number, lon: number): SkyBodyPosition[] {
  const observer = new Observer(lat, lon, 0);
  return SKY_BODIES.map((body) => {
    const eq = Equator(body, date, observer, false, true);
    return { id: body, raHours: eq.ra, decDeg: eq.dec };
  });
}

const VERT = 'attribute vec2 aPos; void main() { gl_Position = vec4(aPos, 0.0, 1.0); }';
const FRAG = `precision highp float;
uniform sampler2D uSky;
uniform vec3 uForward;
uniform vec3 uRight;
uniform vec3 uUp;
uniform vec2 uTan;
uniform vec2 uSize;
uniform float uGain;
uniform float uNight;
uniform vec4 uTile;
void main() {
  vec2 n = gl_FragCoord.xy / uSize * 2.0 - 1.0;
  vec3 d = normalize(uForward + uRight * (n.x * uTan.x) + uUp * (n.y * uTan.y));
  float ra = atan(d.y, d.x);
  float dec = asin(clamp(d.z, -1.0, 1.0));
  vec2 uv = vec2(fract(0.5 - ra / 6.28318530718), 0.5 - dec / 3.14159265359);
  if (uTile.x > 0.0) {
    // uTile = (columns, rows, col, row) of a 512 px tile; RA offset wrapped around the tile centre so mip selection is seamless.
    float du = uv.x - (uTile.z + 0.5) / uTile.x;
    du -= floor(du + 0.5);
    vec2 t = vec2(du * uTile.x + 0.5, uv.y * uTile.y - uTile.w);
    if (t.x < 0.0 || t.x > 1.0 || t.y < 0.0 || t.y > 1.0) discard;
    uv = clamp(t, ${0.5 / SKY_TILE_PX}, ${1 - 0.5 / SKY_TILE_PX});
  }
  vec3 c = min(max(texture2D(uSky, uv).rgb - 0.035, 0.0) * uGain, 1.0);
  if (uNight > 0.5) c = vec3(dot(c, vec3(0.3, 0.59, 0.11)), 0.0, 0.0);
  gl_FragColor = vec4(c, 1.0);
}`;

/** Loads per tile before it stays on the base map (retries after 4, 8, 16 and 32 s: jsDelivr answers 403 to some first requests for a commit). */
const SKY_TILE_ATTEMPTS = 5;

/** Renders the NASA star map as the true sky behind the camera, in a WebGL canvas meant to be drawn onto a 2D canvas each frame. */
export class SkyPhotoRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly textureWidth: number;
  ready = false;
  private gl: WebGLRenderingContext | null;
  private uniforms: Record<string, WebGLUniformLocation | null> = {};
  private baseTexture: WebGLTexture | null = null;
  private tiles = new Map<string, { tex: WebGLTexture | null; usedAt: number; failed?: boolean; attempts: number; retryAt?: number }>();
  private loading = 0;
  private frame = 0;
  /** Tiles with textures, from the frames that drew them. */
  stats = { level: 0, visible: 0, drawn: 0, cached: 0, failed: 0 };

  /** `maxTiles` caps GPU tile textures (about 1.4 MB each with mipmaps); views needing more fall back to a coarser level. */
  constructor(urls: { url8k: string; url4k: string }, prefer8k: boolean, private readonly maxTiles = 96) {
    this.canvas = document.createElement('canvas');
    const gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true });
    this.gl = gl;
    const maxTexture = gl ? Number(gl.getParameter(gl.MAX_TEXTURE_SIZE)) : 0;
    this.textureWidth = prefer8k && maxTexture >= 8192 ? 8192 : maxTexture >= 4096 ? 4096 : 0;
    if (!gl || !this.textureWidth || !this.setup(gl)) {
      this.gl = null;
      return;
    }
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (!this.gl) return;
      const tex = gl.createTexture();
      this.baseTexture = tex;
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      this.ready = true;
    };
    img.src = this.textureWidth === 8192 ? urls.url8k : urls.url4k;
  }

  private setup(gl: WebGLRenderingContext): boolean {
    const compile = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) return null;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG);
    const prog = gl.createProgram();
    if (!vs || !fs || !prog) return false;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    for (const name of ['uSky', 'uForward', 'uRight', 'uUp', 'uTan', 'uSize', 'uGain', 'uNight', 'uTile']) this.uniforms[name] = gl.getUniformLocation(prog, name);
    return true;
  }

  get failed(): boolean {
    return !this.gl;
  }

  /** Draws the sky for `basis` at `pixelWidth`×`pixelHeight`; returns false until the star map has loaded. */
  render(basis: SkyBasis, pixelWidth: number, pixelHeight: number, gain: number, night: boolean): boolean {
    const gl = this.gl;
    if (!gl || !this.ready) return false;
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    gl.viewport(0, 0, pixelWidth, pixelHeight);
    const u = this.uniforms;
    gl.uniform1i(u.uSky, 0);
    gl.uniform3fv(u.uForward, basis.forward);
    gl.uniform3fv(u.uRight, basis.right);
    gl.uniform3fv(u.uUp, basis.up);
    gl.uniform2f(u.uTan, basis.tanX, basis.tanY);
    gl.uniform2f(u.uSize, pixelWidth, pixelHeight);
    gl.uniform1f(u.uGain, gain);
    gl.uniform1f(u.uNight, night ? 1 : 0);
    gl.uniform4f(u.uTile, 0, 0, 0, 0);
    gl.bindTexture(gl.TEXTURE_2D, this.baseTexture);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    this.drawTiles(gl, basis, pixelWidth, pixelHeight);
    return true;
  }

  /** Sharper 16K/32K tiles over the base map, only where the screen needs more pixels than the base texture has.
   * No horizon cull: from altitude the map's horizon sits far below the astronomical one, and the base is built from
   * the same 32K source, so views over the tile cap just stay at base sharpness. */
  private drawTiles(gl: WebGLRenderingContext, basis: SkyBasis, pixelWidth: number, pixelHeight: number): void {
    this.frame++;
    let level = skyTileLevel(skyPxPerDeg(basis, pixelHeight), this.textureWidth);
    let visible: SkyTile[] = level ? visibleSkyTiles(basis, pixelWidth, pixelHeight, level) : [];
    if (visible.length > this.maxTiles && level > 16384) {
      level = 16384;
      visible = visibleSkyTiles(basis, pixelWidth, pixelHeight, level);
    }
    if (visible.length > this.maxTiles) visible = [];
    let drawn = 0;
    gl.enable(gl.SCISSOR_TEST);
    for (const t of visible) {
      const entry = this.tiles.get(t.key);
      if (!entry || (entry.failed && entry.attempts < SKY_TILE_ATTEMPTS && performance.now() >= (entry.retryAt ?? 0))) {
        this.load(t, entry?.attempts ?? 0);
        continue;
      }
      entry.usedAt = this.frame;
      if (!entry.tex) continue;
      const cols = t.width / SKY_TILE_PX;
      gl.uniform4f(this.uniforms.uTile, cols, cols / 2, t.col, t.row);
      gl.bindTexture(gl.TEXTURE_2D, entry.tex);
      const x0 = Math.floor(t.x0), x1 = Math.ceil(t.x1);
      gl.scissor(x0, Math.floor(pixelHeight - t.y1), x1 - x0, Math.ceil(t.y1 - t.y0) + 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      drawn++;
    }
    gl.disable(gl.SCISSOR_TEST);
    this.evict(gl);
    let failed = 0;
    for (const e of this.tiles.values()) if (e.failed) failed++;
    this.stats = { level, visible: visible.length, drawn, cached: this.tiles.size - failed, failed };
  }

  private load(t: SkyTile, attempts: number): void {
    if (this.loading >= 6) return;
    const entry: { tex: WebGLTexture | null; usedAt: number; failed?: boolean; attempts: number; retryAt?: number } = { tex: null, usedAt: this.frame, attempts: attempts + 1 };
    this.tiles.set(t.key, entry);
    this.loading++;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => {
      this.loading--;
      const gl = this.gl;
      if (!gl || this.tiles.get(t.key) !== entry) return;
      const tex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      entry.tex = tex;
    };
    img.onerror = () => {
      this.loading--;
      entry.failed = true;
      entry.retryAt = performance.now() + 2000 * 2 ** entry.attempts;
    };
    img.src = skyTileUrl(t.width, t.row, t.col);
  }

  /** Deletes the least recently drawn tile textures beyond `maxTiles`. */
  private evict(gl: WebGLRenderingContext): void {
    const live = [...this.tiles.entries()].filter(([, e]) => e.tex);
    if (live.length <= this.maxTiles) return;
    live.sort((a, b) => a[1].usedAt - b[1].usedAt);
    for (const [key, e] of live.slice(0, live.length - this.maxTiles)) {
      if (e.usedAt === this.frame) break;
      gl.deleteTexture(e.tex);
      this.tiles.delete(key);
    }
  }
}

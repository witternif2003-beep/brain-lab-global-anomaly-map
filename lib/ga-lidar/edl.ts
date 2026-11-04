import {
  DepthTexture,
  Mesh,
  NearestFilter,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type Camera,
  type Object3D,
  type WebGLRenderer,
} from 'three';

/** Eye-dome lighting (Boucheny 2009, as used by Potree/CloudCompare): darkens each point by how much nearer its neighbours are. */
export const EDL_STRENGTH = 0.8;
export const EDL_RADIUS_CSS_PX = 0.5;

/** For a perspective × affine matrix (column-major), clip z = −a·w + b for every point, so depth can be linearised without near/far. */
export function depthCoefficients(e: ArrayLike<number>): { a: number; b: number } {
  const z = [e[2], e[6], e[10], e[14]];
  const w = [e[3], e[7], e[11], e[15]];
  let i = 0;
  for (let k = 1; k < 3; k++) if (Math.abs(w[k]) > Math.abs(w[i])) i = k;
  const a = Math.abs(w[i]) > 1e-30 ? -z[i] / w[i] : 0;
  return { a, b: z[3] + a * w[3] };
}

/** Clip-space w (distance along the view axis) for a depth-buffer value d in [0, 1). */
export const linearDepth = (d: number, a: number, b: number): number => Math.abs(b / (d * 2 - 1 + a));

/** Clip-space w of model point (x, y, z) under column-major `mvp`. */
export const clipW = (e: ArrayLike<number>, x: number, y: number, z: number): number => e[3] * x + e[7] * y + e[11] * z + e[15];

const VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAGMENT = /* glsl */ `
  uniform sampler2D tColor;
  uniform sampler2D tDepth;
  uniform vec2 uTexel;
  uniform float uA;
  uniform float uB;
  uniform float uRadius;
  uniform float uStrength;
  varying vec2 vUv;
  float logW(float d) { return log2(max(abs(uB / (d * 2.0 - 1.0 + uA)), 1e-6)); }
  void main() {
    float d = texture2D(tDepth, vUv).r;
    if (d >= 1.0) discard;
    float c = logW(d);
    float sum = 0.0;
    for (int i = 0; i < 8; i++) {
      float t = float(i) * 0.7853981634;
      float n = texture2D(tDepth, vUv + vec2(cos(t), sin(t)) * uRadius * uTexel).r;
      sum += n >= 1.0 ? 0.01 : max(0.0, c - logW(n));
    }
    float shade = exp(-sum / 8.0 * 300.0 * uStrength);
    gl_FragColor = vec4(texture2D(tColor, vUv).rgb * shade, 1.0);
    // The composite keeps each point's own depth, so buildings and terrain still hide points behind them.
    gl_FragDepthEXT = d;
  }
`;

/** Draws a point scene into an offscreen colour + depth target, then composites it onto the map with EDL shading. */
export class EdlPass {
  private rt: WebGLRenderTarget | null = null;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly material = new ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      uTexel: { value: new Vector2(1, 1) },
      uA: { value: 0 },
      uB: { value: 1 },
      uRadius: { value: EDL_RADIUS_CSS_PX },
      uStrength: { value: EDL_STRENGTH },
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
    depthTest: true,
    depthWrite: true,
  });

  constructor() {
    const quad = new Mesh(new PlaneGeometry(2, 2), this.material);
    quad.frustumCulled = false;
    this.scene.add(quad);
  }

  /** Bytes the offscreen target holds (RGBA8 colour + 32-bit depth). */
  get bytes(): number {
    return this.rt ? this.rt.width * this.rt.height * 8 : 0;
  }

  /** Returns false without drawing when MapLibre has its own framebuffer bound (the caller then draws directly). */
  render(renderer: WebGLRenderer, gl: WebGLRenderingContext | WebGL2RenderingContext, scene: Object3D, camera: Camera, mvp: ArrayLike<number>, radiusPx: number): boolean {
    if (gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null) return false;
    const w = gl.drawingBufferWidth;
    const h = gl.drawingBufferHeight;
    if (!this.rt || this.rt.width !== w || this.rt.height !== h) {
      this.rt?.dispose();
      this.rt = new WebGLRenderTarget(w, h, { minFilter: NearestFilter, magFilter: NearestFilter, depthBuffer: true, depthTexture: new DepthTexture(w, h) });
    }
    renderer.setRenderTarget(this.rt);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    const u = this.material.uniforms;
    const { a, b } = depthCoefficients(mvp);
    u.tColor.value = this.rt.texture;
    u.tDepth.value = this.rt.depthTexture;
    u.uTexel.value.set(1 / w, 1 / h);
    u.uA.value = a;
    u.uB.value = b;
    u.uRadius.value = radiusPx;
    renderer.setViewport(0, 0, w, h);
    renderer.render(this.scene, this.camera);
    return true;
  }

  dispose(): void {
    this.rt?.depthTexture?.dispose();
    this.rt?.dispose();
    this.rt = null;
    this.material.dispose();
  }
}

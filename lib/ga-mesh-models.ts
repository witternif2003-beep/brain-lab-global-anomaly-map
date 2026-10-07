/** Low-poly 3D models (metres; +x forward, +y left, +z up) for the GA live-marker layers, drawn with deck.gl SimpleMeshLayer at street zoom. */
export type GaModelKind =
  | 'airliner' | 'lightplane' | 'helicopter' | 'bus' | 'scooter' | 'signal' | 'tower'
  | 'police' | 'firestation' | 'siren' | 'speedcam' | 'alpr' | 'weather' | 'gauge';

export interface GaMesh {
  attributes: {
    positions: { value: Float32Array; size: 3 };
    normals: { value: Float32Array; size: 3 };
    colors: { value: Float32Array; size: 3 };
  };
  indices: { value: Uint32Array; size: 1 };
}

type V3 = [number, number, number];
type Axis = 'x' | 'y' | 'z';

class MeshBuilder {
  private p: number[] = [];
  private n: number[] = [];
  private c: number[] = [];
  private i: number[] = [];

  private vert(pos: V3, nrm: V3, shade: number): number {
    this.p.push(...pos);
    this.n.push(...nrm);
    this.c.push(shade, shade, shade);
    return this.p.length / 3 - 1;
  }

  /** Axis-aligned box centred on `c` with full extents `s`. */
  box(c: V3, s: V3, shade = 1): this {
    const [hx, hy, hz] = [s[0] / 2, s[1] / 2, s[2] / 2];
    const faces: [V3, V3, V3][] = [
      [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      [[-1, 0, 0], [0, -1, 0], [0, 0, 1]],
      [[0, 1, 0], [-1, 0, 0], [0, 0, 1]],
      [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
      [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
      [[0, 0, -1], [-1, 0, 0], [0, 1, 0]],
    ];
    const h: V3 = [hx, hy, hz];
    for (const [nrm, u, v] of faces) {
      const at = (su: number, sv: number): V3 => [0, 1, 2].map((k) => c[k] + (nrm[k] + su * u[k] + sv * v[k]) * h[k]) as V3;
      const a = this.vert(at(-1, -1), nrm, shade);
      const b = this.vert(at(1, -1), nrm, shade);
      const d = this.vert(at(1, 1), nrm, shade);
      const e = this.vert(at(-1, 1), nrm, shade);
      this.i.push(a, b, d, a, d, e);
    }
    return this;
  }

  /** Capped (optionally tapered) cylinder whose base centre is `base`, running `len` along `axis`. */
  cylinder(base: V3, r: number, len: number, axis: Axis, shade = 1, rTop = r, seg = 12): this {
    const map = (u: number, v: number, w: number): V3 => (axis === 'z' ? [u, v, w] : axis === 'x' ? [w, u, v] : [u, w, v]);
    const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
    const ring = (rad: number, w: number, side: boolean) => {
      const out: number[] = [];
      for (let k = 0; k < seg; k++) {
        const t = (k / seg) * Math.PI * 2;
        const [cu, sv] = [Math.cos(t), Math.sin(t)];
        out.push(this.vert(add(base, map(cu * rad, sv * rad, w)), side ? map(cu, sv, (r - rTop) / len) : map(0, 0, w ? 1 : -1), shade));
      }
      return out;
    };
    const lo = ring(r, 0, true);
    const hi = ring(rTop, len, true);
    for (let k = 0; k < seg; k++) {
      const k1 = (k + 1) % seg;
      this.i.push(lo[k], lo[k1], hi[k1], lo[k], hi[k1], hi[k]);
    }
    for (const [rad, w] of [[r, 0], [rTop, len]] as const) {
      if (rad <= 0) continue;
      const cap = ring(rad, w, false);
      const mid = this.vert(add(base, map(0, 0, w)), map(0, 0, w ? 1 : -1), shade);
      for (let k = 0; k < seg; k++) this.i.push(mid, cap[k], cap[(k + 1) % seg]);
    }
    return this;
  }

  build(): GaMesh {
    return {
      attributes: {
        positions: { value: new Float32Array(this.p), size: 3 },
        normals: { value: new Float32Array(this.n), size: 3 },
        colors: { value: new Float32Array(this.c), size: 3 },
      },
      indices: { value: new Uint32Array(this.i), size: 1 },
    };
  }
}

const BUILD: Record<GaModelKind, () => GaMesh> = {
  airliner: () =>
    new MeshBuilder()
      .cylinder([-17, 0, 3], 2, 31, 'x')
      .cylinder([14, 0, 3], 2, 5, 'x', 1, 0.3)
      .cylinder([-20, 0, 3], 0.6, 3, 'x', 0.9, 2)
      .box([1, 0, 2.4], [7, 34, 0.5], 0.8)
      .box([-16.5, 0, 3.6], [3.5, 12, 0.35], 0.8)
      .box([-16, 0, 7], [4.5, 0.4, 6], 0.95)
      .cylinder([0, 7, 1.2], 1.2, 4.5, 'x', 0.35)
      .cylinder([0, -7, 1.2], 1.2, 4.5, 'x', 0.35)
      .box([15.5, 0, 3.9], [1.6, 3, 0.6], 0.15)
      .build(),
  lightplane: () =>
    new MeshBuilder()
      .box([0, 0, 1.4], [7.5, 1.2, 1.3])
      .box([3.9, 0, 1.4], [0.6, 0.9, 0.9], 0.4)
      .box([1, 0, 2.1], [1.6, 11, 0.12], 0.85)
      .box([-3.3, 0, 1.6], [1, 3.4, 0.1], 0.85)
      .box([-3.4, 0, 2.3], [1.2, 0.1, 1.4])
      .box([2, 0, 1.9], [1.4, 1.1, 0.5], 0.15)
      .cylinder([0.8, 0.9, 0], 0.25, 0.7, 'z', 0.2)
      .cylinder([0.8, -0.9, 0], 0.25, 0.7, 'z', 0.2)
      .build(),
  helicopter: () =>
    new MeshBuilder()
      .box([0, 0, 1.6], [4.5, 2, 2])
      .box([1.7, 0, 1.8], [1.4, 1.8, 1.4], 0.15)
      .box([-4.6, 0, 2.1], [5, 0.4, 0.5], 0.9)
      .box([-7, 0, 2.7], [0.8, 0.15, 1.6])
      .cylinder([0, 0, 2.6], 0.25, 0.5, 'z', 0.3)
      .cylinder([0, 0, 3.1], 5.5, 0.08, 'z', 0.25, 5.5, 20)
      .box([0, 1, 0.2], [4, 0.15, 0.15], 0.25)
      .box([0, -1, 0.2], [4, 0.15, 0.15], 0.25)
      .build(),
  bus: () =>
    new MeshBuilder()
      .box([0, 0, 1.95], [12, 2.55, 2.9])
      .box([-0.2, 0, 2.5], [10.8, 2.58, 1], 0.15)
      .box([5.98, 0, 2.3], [0.1, 2.2, 1.6], 0.15)
      .box([0, 0, 3.45], [8, 2, 0.25], 0.7)
      .cylinder([3.8, 1.3, 0.5], 0.5, 0.3, 'y', 0.1)
      .cylinder([3.8, -1.6, 0.5], 0.5, 0.3, 'y', 0.1)
      .cylinder([-3.4, 1.3, 0.5], 0.5, 0.3, 'y', 0.1)
      .cylinder([-3.4, -1.6, 0.5], 0.5, 0.3, 'y', 0.1)
      .build(),
  scooter: () =>
    new MeshBuilder()
      .box([0, 0, 0.17], [0.9, 0.16, 0.06])
      .box([0.48, 0, 0.62], [0.06, 0.06, 0.95], 0.4)
      .box([0.48, 0, 1.1], [0.05, 0.5, 0.05], 0.3)
      .cylinder([0.5, 0.03, 0.12], 0.12, 0.06, 'y', 0.1)
      .cylinder([-0.45, 0.03, 0.12], 0.12, 0.06, 'y', 0.1)
      .build(),
  signal: () =>
    new MeshBuilder()
      .cylinder([0, 0, 0], 0.16, 6.6, 'z', 0.45)
      .cylinder([0, 0, 6.2], 0.1, 7.5, 'x', 0.45)
      .box([3.6, 0, 5.55], [0.4, 0.4, 1.15], 0.18)
      .box([6.8, 0, 5.55], [0.4, 0.4, 1.15], 0.18)
      .box([3.82, 0, 5.9], [0.06, 0.28, 0.28])
      .box([6.0, 0, 5.9], [0.06, 0.28, 0.28])
      .box([7.02, 0, 5.9], [0.06, 0.28, 0.28])
      .build(),
  tower: () =>
    new MeshBuilder()
      .cylinder([0, 0, 0], 3, 60, 'z', 0.8, 0.5, 4)
      .cylinder([0, 0, 60], 0.15, 6, 'z', 0.6)
      .box([0.9, 0, 52], [0.3, 1.4, 2.6], 0.95)
      .box([-0.9, 0, 52], [0.3, 1.4, 2.6], 0.95)
      .box([0, 0.9, 52], [1.4, 0.3, 2.6], 0.95)
      .box([0, -0.9, 52], [1.4, 0.3, 2.6], 0.95)
      .cylinder([0.8, 0, 44], 0.6, 0.5, 'x', 0.9)
      .build(),
  police: () =>
    new MeshBuilder()
      .box([0, 0, 3.5], [30, 18, 7], 0.9)
      .box([0, 0, 7.15], [30.6, 18.6, 0.3], 0.45)
      .box([15.4, 0, 1.6], [0.2, 4, 3.2], 0.15)
      .box([17, 0, 3.4], [3.5, 6, 0.25], 0.6)
      .cylinder([20, 6, 0], 0.08, 10, 'z', 0.7)
      .box([20, 6.7, 9.3], [0.04, 1.4, 0.9])
      .build(),
  firestation: () =>
    new MeshBuilder()
      .box([0, 0, 4], [26, 20, 8], 0.95)
      .box([0, 0, 8.15], [26.6, 20.6, 0.3], 0.5)
      .box([13.05, -6, 2.4], [0.1, 4, 4.8], 0.25)
      .box([13.05, 0, 2.4], [0.1, 4, 4.8], 0.25)
      .box([13.05, 6, 2.4], [0.1, 4, 4.8], 0.25)
      .box([-9, -7, 7], [4, 4, 14], 0.85)
      .build(),
  siren: () =>
    new MeshBuilder()
      .cylinder([0, 0, 0], 0.22, 15, 'z', 0.55)
      .box([0, 0, 15.2], [1, 1, 0.4], 0.4)
      .cylinder([-0.9, 0, 16.1], 0.35, 1.8, 'x', 1, 0.7)
      .box([0, 0, 16.1], [0.7, 0.7, 1], 0.6)
      .build(),
  speedcam: () =>
    new MeshBuilder()
      .cylinder([0, 0, 0], 0.1, 4.4, 'z', 0.5)
      .box([0.1, 0, 4.7], [0.7, 0.45, 0.55])
      .box([0.47, 0, 4.7], [0.06, 0.3, 0.3], 0.15)
      .build(),
  alpr: () =>
    new MeshBuilder()
      .cylinder([0, 0, 0], 0.08, 3.8, 'z', 0.5)
      .box([0.2, 0, 3.4], [0.4, 0.18, 0.18])
      .box([0.41, 0, 3.4], [0.03, 0.12, 0.12], 0.1)
      .box([0, 0, 4.0], [0.6, 0.45, 0.04], 0.25)
      .build(),
  weather: () =>
    new MeshBuilder()
      .cylinder([0, 0, 0], 0.06, 10, 'z', 0.6)
      .box([0, 0, 10.05], [1.6, 0.05, 0.05], 0.6)
      .cylinder([0.8, 0, 10], 0.12, 0.25, 'z', 0.9)
      .cylinder([-0.8, 0, 10], 0.12, 0.25, 'z', 0.9)
      .box([0, 0.25, 2], [0.45, 0.3, 0.6])
      .box([0.3, 0, 3], [0.6, 0.02, 0.4], 0.2)
      .build(),
  gauge: () =>
    new MeshBuilder()
      .box([0, 0, 1.1], [1.6, 1.6, 2.2])
      .box([0, 0, 2.3], [1.9, 1.9, 0.2], 0.4)
      .cylinder([0.5, 0.5, 2.4], 0.04, 3, 'z', 0.5)
      .box([-0.3, -0.81, 1.1], [0.6, 0.02, 1.4], 0.2)
      .build(),
};

/** Radius in metres used for tapping a model at street zoom. */
export const GA_MODEL_REACH_M: Record<GaModelKind, number> = {
  airliner: 20, lightplane: 6, helicopter: 6, bus: 6.5, scooter: 1, signal: 4, tower: 4,
  police: 16, firestation: 14, siren: 1.5, speedcam: 1, alpr: 1, weather: 1.2, gauge: 1.2,
};

const meshes = new Map<GaModelKind, GaMesh>();
export function gaMesh(kind: GaModelKind): GaMesh {
  let mesh = meshes.get(kind);
  if (!mesh) meshes.set(kind, (mesh = BUILD[kind]()));
  return mesh;
}

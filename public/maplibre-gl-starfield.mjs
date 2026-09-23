import { AddEquation, BackSide, BufferGeometry, Camera, CustomBlending, Float32BufferAttribute, LinearFilter, Matrix4, Mesh, OneFactor, OneMinusSrcAlphaFactor, Points, Scene, ShaderMaterial, SphereGeometry, TextureLoader, Vector3, WebGLRenderer } from "three";
//#region src/shaders/galaxy.vert.glsl
var galaxy_vert_default = "varying vec2 vUv;\n\nvoid main() {\n  vUv = uv;\n  vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n  clipPos.z = clipPos.w * 0.99999;\n  gl_Position = clipPos;\n}\n";
//#endregion
//#region src/shaders/galaxy.frag.glsl
var galaxy_frag_default = "uniform sampler2D tSky;\nuniform float uBrightness;\nuniform float uFade;\n\nvarying vec2 vUv;\n\nvoid main() {\n  vec3 col = texture2D(tSky, vUv).rgb * uBrightness * uFade;\n  gl_FragColor = vec4(col, 1.0);\n}\n";
//#endregion
//#region src/shaders/star.vert.glsl
var star_vert_default = "attribute float aSize;\nattribute float aOpacity;\n\nvarying float vOpacity;\n\nvoid main() {\n  vOpacity = aOpacity;\n  vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n  clipPos.z = clipPos.w * 0.9999;\n  gl_Position = clipPos;\n  gl_PointSize = aSize;\n}\n";
//#endregion
//#region src/shaders/star.frag.glsl
var star_frag_default = "uniform vec3  uColor;\nuniform float uFade;\n\nvarying float vOpacity;\n\nvoid main() {\n  float d = length(gl_PointCoord - vec2(0.5));\n  if (d > 0.5) discard;\n  float a = vOpacity * smoothstep(0.5, 0.1, d) * uFade;\n  gl_FragColor = vec4(uColor * a, a);\n}\n";
//#endregion
//#region src/shaders/sun.vert.glsl
var sun_vert_default = "varying vec3 vDirection;\n\nvoid main() {\n  vDirection = position;\n  vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);\n  clipPos.z = clipPos.w * 0.99998;\n  gl_Position = clipPos;\n}\n";
//#endregion
//#region src/shaders/sun.frag.glsl
var sun_frag_default = "uniform vec3  uSunDirection;\nuniform vec3  uSunColor;\nuniform float uSunIntensity;\nuniform float uSunAngularRadius;\n\nvarying vec3 vDirection;\n\n#include includes/simplex-noise.glsl\n#include includes/fbm.glsl\n#include includes/brightness-to-color.glsl\n\nvoid main() {\n  vec3 dir = normalize(vDirection);\n  vec3 sunDir = normalize(uSunDirection);\n  float cosAngle = dot(dir, sunDir);\n  float angularDist = acos(clamp(cosAngle, -1.0, 1.0));\n  float sunRadius = acos(clamp(uSunAngularRadius, -1.0, 1.0));\n  float r = angularDist / max(sunRadius, 0.001);\n\n  if (r > 15.0) discard;\n\n  vec3 upRef = abs(sunDir.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);\n  vec3 t1 = normalize(cross(sunDir, upRef));\n  vec3 t2 = cross(sunDir, t1);\n  vec3 localDir = vec3(dot(dir, t1), dot(dir, t2), dot(dir, sunDir));\n\n  float discBright = 0.0;\n  float glowBright = 0.0;\n\n  // Sun disc — procedural surface with domain warping\n  if (r < 1.05) {\n    vec3 nc = localDir * 40.0;\n    vec3 warp = vec3(\n      snoise(nc * 0.7 + vec3(5.2, 0.0, 0.0)),\n      snoise(nc * 0.7 + vec3(0.0, 1.7, 0.0)),\n      0.0\n    );\n    vec3 warped = nc + warp * 4.0;\n\n    float n1 = fbm(warped);\n    float n2 = snoise(warped * 2.5) * 0.5 + 0.5;\n    float n3 = snoise(warped * 6.0) * 0.5 + 0.5;\n    float surface = 0.55 + 0.35 * n1 + 0.07 * n2 + 0.03 * n3;\n\n    // Dark spots\n    float spots = 1.0 - 0.25 * pow(clamp(1.0 - n1, 0.0, 1.0), 3.0);\n    surface *= spots;\n\n    // Limb brightening\n    float rim = 1.0 + r * r * 1.2;\n    float edge = 1.0 - smoothstep(0.88, 1.02, r);\n\n    discBright = surface * rim * edge;\n  }\n\n  // Multi-layer corona\n  float c1 = exp(-pow(max(r - 0.95, 0.0) / 0.6, 1.5)) * 0.8;\n  float c2 = exp(-pow(max(r - 0.95, 0.0) / 2.5, 1.3)) * 0.3;\n  float c3 = exp(-max(r - 0.8, 0.0) / 5.0) * 0.1;\n  glowBright = c1 + c2 + c3;\n\n  // Coronal streamers\n  if (r > 0.85 && r < 12.0) {\n    vec3 projVec = dir - sunDir * cosAngle;\n    float projLen = length(projVec);\n    if (projLen > 0.001) {\n      vec3 proj = projVec / projLen;\n      float angle = atan(dot(proj, t2), dot(proj, t1));\n      float ray = pow(max(snoise(vec3(angle * 3.0, 0.5, 0.0)), 0.0), 2.0);\n      ray += pow(max(snoise(vec3(angle * 7.0, 1.5, 0.0)), 0.0), 3.0) * 0.5;\n      ray += pow(max(snoise(vec3(angle * 13.0, 2.5, 0.0)), 0.0), 4.0) * 0.3;\n      float radialFade = exp(-pow(max(r - 1.0, 0.0) / 4.0, 1.1));\n      glowBright += ray * radialFade * 0.4;\n    }\n  }\n\n  float totalBright = (discBright + glowBright) * uSunIntensity;\n  if (totalBright < 0.002) discard;\n\n  // Separate disc / glow coloring for warm orange disc, golden corona\n  vec3 discColor = brightnessToColor(discBright * uSunIntensity * 1.5) * uSunColor;\n  vec3 glowColor = brightnessToColor(glowBright * uSunIntensity * 2.5) * uSunColor;\n  vec3 color = discColor + glowColor;\n\n  gl_FragColor = vec4(color, clamp(totalBright, 0.0, 1.0));\n}\n";
//#endregion
//#region src/layer.ts
const GLSL_INCLUDES = {
	"includes/simplex-noise.glsl": "// 3D Simplex Noise — Ashima Arts (MIT)\n// Adapted from eclipseSimulator / webgl-noise\n\nvec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }\nvec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }\nvec4 perm(vec4 x) { return mod289v4(((x * 34.0) + 10.0) * x); }\nvec4 tis(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }\n\nfloat snoise(vec3 v) {\n  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);\n  vec3 i = floor(v + dot(v, C.yyy));\n  vec3 x0 = v - i + dot(i, C.xxx);\n  vec3 g = step(x0.yzx, x0.xyz);\n  vec3 l = 1.0 - g;\n  vec3 i1 = min(g.xyz, l.zxy);\n  vec3 i2 = max(g.xyz, l.zxy);\n  vec3 x1 = x0 - i1 + C.xxx;\n  vec3 x2 = x0 - i2 + C.yyy;\n  vec3 x3 = x0 - 0.5;\n  i = mod289v3(i);\n  vec4 p = perm(perm(perm(\n      i.z + vec4(0.0, i1.z, i2.z, 1.0))\n    + i.y + vec4(0.0, i1.y, i2.y, 1.0))\n    + i.x + vec4(0.0, i1.x, i2.x, 1.0));\n  vec4 j = p - 49.0 * floor(p / 49.0);\n  vec4 x_ = floor(j / 7.0);\n  vec4 y_ = j - 7.0 * x_;\n  vec4 ox = (x_ * 2.0 + 0.5) / 7.0 - 1.0;\n  vec4 oy = (y_ * 2.0 + 0.5) / 7.0 - 1.0;\n  vec4 h = 1.0 - abs(ox) - abs(oy);\n  vec4 b0 = vec4(ox.xy, oy.xy);\n  vec4 b1 = vec4(ox.zw, oy.zw);\n  vec4 s0 = floor(b0) * 2.0 + 1.0;\n  vec4 s1 = floor(b1) * 2.0 + 1.0;\n  vec4 sh = -step(h, vec4(0.0));\n  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;\n  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;\n  vec3 p0 = vec3(a0.xy, h.x);\n  vec3 p1 = vec3(a0.zw, h.y);\n  vec3 p2 = vec3(a1.xy, h.z);\n  vec3 p3 = vec3(a1.zw, h.w);\n  vec4 norm = tis(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));\n  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;\n  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);\n  m = m * m;\n  return 105.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));\n}\n",
	"includes/fbm.glsl": "// Fractal Brownian Motion — 4 octaves of simplex noise\n// Requires: snoise() from simplex-noise.glsl\n\nfloat fbm(vec3 p) {\n  float f = 0.5 * snoise(p); p *= 2.02;\n  f += 0.25 * snoise(p); p *= 2.03;\n  f += 0.125 * snoise(p); p *= 2.01;\n  f += 0.0625 * snoise(p);\n  return f / 0.9375;\n}\n",
	"includes/brightness-to-color.glsl": "// eclipseSimulator exact color function\n// Maps scalar brightness to warm orange → golden → white gradient\n// See: https://github.com/Shahnab/eclipseSimulator\n\nvec3 brightnessToColor(float b) {\n  b *= 0.25;\n  return (vec3(b, b * b, b * b * b * b) / 0.25) * 0.8;\n}\n"
};
/** Resolve `#include path` directives in GLSL source (eclipseSimulator pattern). */
function resolveGlslIncludes(source) {
	return source.replace(/^#include\s+(.+)$/gm, (_match, path) => {
		const trimmed = path.trim();
		const glsl = GLSL_INCLUDES[trimmed];
		if (!glsl) throw new Error(`GLSL include not found: ${trimmed}`);
		return glsl;
	});
}
const sunFragmentShader = resolveGlslIncludes(sun_frag_default);
const DEG2RAD = Math.PI / 180;
/**
* Convert spherical angles to a unit-sphere direction vector.
*
* In globe mode the angles correspond to geographic coordinates:
*   azimuth  = longitude:  0 = prime-meridian (+Z), 90 = 90 E (+X)
*   altitude = latitude:   0 = equator, +90 = north-pole (+Y)
*
* This matches MapLibre's globe coordinate system
* (see angularCoordinatesRadiansToVector in globe_utils.ts):
*   X = sin(lng) * cos(lat),  Y = sin(lat),  Z = cos(lng) * cos(lat)
*/
function sunDirectionFromAngles(azimuthDeg, altitudeDeg) {
	const az = azimuthDeg * DEG2RAD;
	const alt = altitudeDeg * DEG2RAD;
	const cosAlt = Math.cos(alt);
	return [
		cosAlt * Math.sin(az),
		Math.sin(alt),
		cosAlt * Math.cos(az)
	];
}
/**
* Convert the `sunSize` option (default 100) to the cosine of the angular
* radius used in the sun sphere fragment shader.
*
* sunSize 100 → ~1.0° angular radius (2° diameter — close to real sun)
* The glow extends well beyond the disc, so the sun looks ~3-4° total.
*/
function sunSizeToCos(size) {
	const angularRadiusDeg = size / 100 * 2;
	return Math.cos(angularRadiusDeg * DEG2RAD);
}
/**
* Compute how much to fade stars/galaxy based on sun altitude.
*
* - altitude <= -18 deg  →  1.0  (full night, all stars visible)
* - altitude >= 0 deg    →  0.0  (daytime, stars invisible)
* - in between           →  smooth non-linear ramp
*/
function computeStarFade(altitudeDeg) {
	if (altitudeDeg >= 0) return 0;
	if (altitudeDeg <= -18) return 1;
	const t = -altitudeDeg / 18;
	return t * t * (3 - 2 * t);
}
var MaplibreStarfieldLayer = class {
	id;
	type = "custom";
	renderingMode = "3d";
	starCount;
	starSize;
	starColor;
	galaxyTextureUrl;
	galaxyBrightness;
	_sunEnabled;
	_sunAzimuth;
	_sunAltitude;
	_sunSize;
	_sunColor;
	_sunIntensity;
	_autoFadeStars;
	_fadeAltitude;
	renderer = null;
	scene = null;
	camera = null;
	map = null;
	starMaterial = null;
	galaxyMaterial = null;
	sunMesh = null;
	sunMaterial = null;
	constructor(options = {}) {
		this.id = options.id ?? "starfield";
		this.starCount = options.starCount ?? 4e3;
		this.starSize = options.starSize ?? 2;
		this.starColor = options.starColor ?? 16777215;
		this.galaxyTextureUrl = options.galaxyTextureUrl;
		this.galaxyBrightness = options.galaxyBrightness ?? .35;
		this._sunEnabled = options.sunEnabled ?? false;
		this._sunAzimuth = options.sunAzimuth ?? 180;
		this._sunAltitude = options.sunAltitude ?? 45;
		this._sunSize = options.sunSize ?? 100;
		this._sunColor = options.sunColor ?? 16772778;
		this._sunIntensity = options.sunIntensity ?? 1.5;
		this._autoFadeStars = options.autoFadeStars ?? true;
		this._fadeAltitude = options.fadeAltitude;
	}
	/**
	* Update the sun position and re-render.
	*
	* For globe projections pass the subsolar longitude as `azimuth`
	* and the solar declination as `altitude`.  Optionally pass the
	* observer's local sun altitude as `fadeAltitude` so the twilight
	* star-fade uses the correct value.
	*/
	setSunPosition(azimuth, altitude, fadeAltitude) {
		this._sunAzimuth = azimuth;
		this._sunAltitude = altitude;
		if (fadeAltitude !== void 0) this._fadeAltitude = fadeAltitude;
		this.applySunPosition();
		this.applyStarFade();
		this.map?.triggerRepaint();
	}
	/**
	* Enable or disable the sun.
	*/
	setSunEnabled(enabled) {
		this._sunEnabled = enabled;
		if (this.sunMesh) this.sunMesh.visible = enabled;
		if (!enabled) this.setFadeUniforms(1);
		else this.applyStarFade();
		this.map?.triggerRepaint();
	}
	/**
	* Update sun glow intensity.
	*/
	setSunIntensity(intensity) {
		this._sunIntensity = intensity;
		const u = this.sunMaterial?.uniforms["uSunIntensity"];
		if (u) u.value = intensity;
		this.map?.triggerRepaint();
	}
	setSunSize(size) {
		this._sunSize = size;
		const u = this.sunMaterial?.uniforms["uSunAngularRadius"];
		if (u) u.value = sunSizeToCos(size);
		this.map?.triggerRepaint();
	}
	/**
	* Override the altitude used for star/galaxy fade calculation.
	* Pass the observer's local sun altitude when using geocentric sun coords.
	*/
	setFadeAltitude(altitude) {
		this._fadeAltitude = altitude;
		this.applyStarFade();
		this.map?.triggerRepaint();
	}
	onAdd(map, gl) {
		this.map = map;
		this.scene = new Scene();
		this.camera = new Camera();
		const fadeAlt = this._fadeAltitude ?? this._sunAltitude;
		const initialFade = this._sunEnabled && this._autoFadeStars ? computeStarFade(fadeAlt) : 1;
		if (this.galaxyTextureUrl) {
			const loader = new TextureLoader();
			loader.setCrossOrigin("anonymous");
			const brightness = this.galaxyBrightness;
			const scene = this.scene;
			const fade = initialFade;
			loader.load(this.galaxyTextureUrl, (texture) => {
				texture.magFilter = LinearFilter;
				texture.minFilter = LinearFilter;
				const skyGeo = new SphereGeometry(1, 64, 32);
				const skyMat = new ShaderMaterial({
					uniforms: {
						tSky: { value: texture },
						uBrightness: { value: brightness },
						uFade: { value: fade }
					},
					vertexShader: galaxy_vert_default,
					fragmentShader: galaxy_frag_default,
					side: BackSide,
					depthWrite: false,
					depthTest: false
				});
				this.galaxyMaterial = skyMat;
				const skybox = new Mesh(skyGeo, skyMat);
				scene.children.unshift(skybox);
				map.triggerRepaint();
			});
		}
		const count = this.starCount;
		const size = this.starSize;
		const color = this.starColor;
		const positions = new Float32Array(count * 3);
		const starSizes = new Float32Array(count);
		const opacities = new Float32Array(count);
		for (let i = 0; i < count; i++) {
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(2 * Math.random() - 1);
			const i3 = i * 3;
			positions[i3] = Math.sin(phi) * Math.cos(theta);
			positions[i3 + 1] = Math.sin(phi) * Math.sin(theta);
			positions[i3 + 2] = Math.cos(phi);
			starSizes[i] = size * (.4 + Math.random());
			opacities[i] = .15 + Math.random() * .85;
		}
		const geo = new BufferGeometry();
		geo.setAttribute("position", new Float32BufferAttribute(positions, 3));
		geo.setAttribute("aSize", new Float32BufferAttribute(starSizes, 1));
		geo.setAttribute("aOpacity", new Float32BufferAttribute(opacities, 1));
		const cr = (color >> 16 & 255) / 255;
		const cg = (color >> 8 & 255) / 255;
		const cb = (color & 255) / 255;
		const mat = new ShaderMaterial({
			uniforms: {
				uColor: { value: new Vector3(cr, cg, cb) },
				uFade: { value: initialFade }
			},
			vertexShader: star_vert_default,
			fragmentShader: star_frag_default,
			transparent: true,
			depthWrite: false,
			depthTest: false,
			blending: CustomBlending,
			blendSrc: OneFactor,
			blendDst: OneMinusSrcAlphaFactor,
			blendEquation: AddEquation
		});
		this.starMaterial = mat;
		this.scene.add(new Points(geo, mat));
		this.createSun();
		this.renderer = new WebGLRenderer({
			canvas: map.getCanvas(),
			context: gl
		});
		this.renderer.autoClear = false;
	}
	render(_gl, options) {
		if (!this.renderer || !this.scene || !this.camera) return;
		const P = new Matrix4().fromArray(options.projectionMatrix);
		const MVP = new Matrix4().fromArray(options.modelViewProjectionMatrix);
		const PInv = new Matrix4().copy(P).invert();
		const MV = new Matrix4().multiplyMatrices(PInv, MVP);
		const e = MV.elements;
		e[12] = 0;
		e[13] = 0;
		e[14] = 0;
		this.camera.projectionMatrix.multiplyMatrices(P, MV);
		const r = this.renderer;
		if (typeof r["resetState"] === "function") r["resetState"]();
		else if (r["state"] && typeof r["state"]["reset"] === "function") r["state"]["reset"]();
		this.renderer.render(this.scene, this.camera);
	}
	onRemove() {
		this.scene?.traverse((node) => {
			if (node instanceof Points) {
				node.geometry.dispose();
				node.material.dispose();
			}
			if (node instanceof Mesh) {
				node.geometry.dispose();
				node.material.dispose();
			}
		});
		this.renderer?.dispose();
		this.renderer = null;
		this.scene = null;
		this.camera = null;
		this.map = null;
		this.starMaterial = null;
		this.galaxyMaterial = null;
		this.sunMesh = null;
		this.sunMaterial = null;
	}
	createSun() {
		if (!this.scene) return;
		const [dx, dy, dz] = sunDirectionFromAngles(this._sunAzimuth, this._sunAltitude);
		const angularRadiusCos = sunSizeToCos(this._sunSize);
		const scR = (this._sunColor >> 16 & 255) / 255;
		const scG = (this._sunColor >> 8 & 255) / 255;
		const scB = (this._sunColor & 255) / 255;
		const sunMat = new ShaderMaterial({
			uniforms: {
				uSunDirection: { value: new Vector3(dx, dy, dz) },
				uSunColor: { value: new Vector3(scR, scG, scB) },
				uSunIntensity: { value: this._sunIntensity },
				uSunAngularRadius: { value: angularRadiusCos }
			},
			vertexShader: sun_vert_default,
			fragmentShader: sunFragmentShader,
			side: BackSide,
			transparent: true,
			depthWrite: false,
			depthTest: false,
			blending: CustomBlending,
			blendSrc: OneFactor,
			blendDst: OneMinusSrcAlphaFactor,
			blendEquation: AddEquation
		});
		this.sunMaterial = sunMat;
		this.sunMesh = new Mesh(new SphereGeometry(1, 64, 32), sunMat);
		this.sunMesh.visible = this._sunEnabled;
		this.scene.add(this.sunMesh);
	}
	applySunPosition() {
		if (!this.sunMaterial) return;
		const [x, y, z] = sunDirectionFromAngles(this._sunAzimuth, this._sunAltitude);
		const u = this.sunMaterial.uniforms["uSunDirection"];
		if (u) u.value.set(x, y, z);
	}
	applyStarFade() {
		if (!this._sunEnabled || !this._autoFadeStars) {
			this.setFadeUniforms(1);
			return;
		}
		const fade = computeStarFade(this._fadeAltitude ?? this._sunAltitude);
		this.setFadeUniforms(fade);
	}
	setFadeUniforms(fade) {
		const starFade = this.starMaterial?.uniforms["uFade"];
		if (starFade) starFade.value = fade;
		const galaxyFade = this.galaxyMaterial?.uniforms["uFade"];
		if (galaxyFade) galaxyFade.value = fade;
	}
};
//#endregion
//#region src/index.ts
var src_default = MaplibreStarfieldLayer;
//#endregion
export { MaplibreStarfieldLayer, src_default as default };

//# sourceMappingURL=index.js.map
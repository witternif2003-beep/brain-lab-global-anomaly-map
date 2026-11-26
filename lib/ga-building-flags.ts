import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import { GA_MODEL_MIN_ZOOM } from './ga-deck-overlay';

const FRAMES = 16;
const FRAME_MS = 70;
const POLE_W = 6;
const WAVE_PX = 7;

/** Confederate battle flag (square ANV pattern): red field, white-edged blue saltire, 13 white five-point stars. */
function flagCloth(): HTMLCanvasElement {
  const S = 120;
  const c = document.createElement('canvas');
  c.width = S;
  c.height = S;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  g.fillStyle = '#b22234';
  g.fillRect(0, 0, S, S);
  const band = (w: number, color: string) => {
    g.strokeStyle = color;
    g.lineWidth = w;
    g.lineCap = 'square';
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(S, S);
    g.moveTo(S, 0); g.lineTo(0, S);
    g.stroke();
  };
  band(S * 0.26, '#ffffff');
  band(S * 0.2, '#0a1f5c');
  const star = (cx: number, cy: number, r: number) => {
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const rr = i % 2 ? r * 0.4 : r;
      g.lineTo(cx + rr * Math.cos(a), cy + rr * Math.sin(a));
    }
    g.closePath();
    g.fill();
  };
  g.fillStyle = '#ffffff';
  const r = S * 0.045;
  star(S / 2, S / 2, r);
  for (const k of [1, 2, 3]) {
    const d = (k * S) / 7.6;
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) star(S / 2 + sx * d, S / 2 + sy * d, r);
  }
  g.strokeStyle = '#0b0e14';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, S - 3, S - 3);
  return c;
}

/** Wind animation: each column of the cloth is shifted on a travelling sine wave that grows away from the pole and shaded by its slope. */
function waveFrames(): ImageData[] {
  const cloth = flagCloth();
  const S = cloth.width;
  const W = POLE_W + S;
  const H = S + WAVE_PX * 2;
  const out: ImageData[] = [];
  for (let f = 0; f < FRAMES; f++) {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = '#d1d5db';
    g.fillRect(0, 0, POLE_W - 2, H);
    const phase = (f / FRAMES) * Math.PI * 2;
    for (let x = 0; x < S; x++) {
      const k = x / S;
      const a = (x / S) * Math.PI * 3 - phase;
      const dy = Math.sin(a) * WAVE_PX * k;
      g.drawImage(cloth, x, 0, 1, S, POLE_W + x, WAVE_PX + dy, 1, S);
      const shade = Math.cos(a) * 0.28 * k;
      g.fillStyle = shade > 0 ? `rgba(255,255,255,${shade})` : `rgba(0,0,0,${-shade})`;
      g.fillRect(POLE_W + x, WAVE_PX + dy, 1, S);
    }
    out.push(g.getImageData(0, 0, W, H));
  }
  return out;
}

const MAX_MARKERS = 150;

interface FlagSite {
  coord: [number, number];
  /** Height of the 3D model's roof (metres at model scale 1). */
  roofM: number;
}

interface FlagState {
  sites: FlagSite[];
  markers: Map<string, Marker>;
  bound: boolean;
}

const states = new WeakMap<MapLibreMap, FlagState>();
let spriteUrl: string | null = null;

/** One sprite sheet of every wave frame, played by a CSS steps() animation so all flags wave without per-frame JS. */
function ensureSprite(): string {
  if (spriteUrl) return spriteUrl;
  const frames = waveFrames();
  const W = frames[0].width;
  const H = frames[0].height;
  const sheet = document.createElement('canvas');
  sheet.width = W * FRAMES;
  sheet.height = H;
  const g = sheet.getContext('2d') as CanvasRenderingContext2D;
  frames.forEach((f, i) => g.putImageData(f, i * W, 0));
  spriteUrl = sheet.toDataURL('image/png');
  const style = document.createElement('style');
  style.textContent = `
.ga-building-flag{pointer-events:none;z-index:4;width:var(--w);height:calc(var(--w)*${(H / W).toFixed(4)});background-image:url(${spriteUrl});background-repeat:no-repeat;background-size:${FRAMES * 100}% 100%;animation:ga-flag-wave ${((FRAMES * FRAME_MS) / 1000).toFixed(2)}s steps(${FRAMES - 1}) infinite;filter:drop-shadow(0 2px 3px rgba(0,0,0,.55))}
.ga-building-flag::after{content:'';position:absolute;left:0;top:0;width:2px;height:calc(100% + var(--pole));background:#d1d5db}
@keyframes ga-flag-wave{from{background-position:0 0}to{background-position:100% 0}}
@media (prefers-reduced-motion:reduce){.ga-building-flag{animation:none}}`;
  document.head.appendChild(style);
  return spriteUrl;
}

const metresPerPixel = (lat: number, zoom: number) => (40075016.686 * Math.cos((lat * Math.PI) / 180)) / (512 * 2 ** zoom);
const modelScale = (zoom: number) => 2 ** Math.min(4, Math.max(0, Math.floor(19 - zoom)));

function flagWidthPx(zoom: number): number {
  return Math.round(Math.min(64, Math.max(26, 26 + (zoom - GA_MODEL_MIN_ZOOM) * 9)));
}

/** Screen-space lift that puts the flag's pole foot just above the model's roof at the current zoom and pitch. */
function liftPx(map: MapLibreMap, site: FlagSite): number {
  const z = map.getZoom();
  const roofPx = (site.roofM * modelScale(z)) / metresPerPixel(site.coord[1], z);
  return roofPx * Math.sin((map.getPitch() * Math.PI) / 180) + 18;
}

function place(map: MapLibreMap, st: FlagState): void {
  const z = map.getZoom();
  const want = new Map<string, FlagSite>();
  if (z >= GA_MODEL_MIN_ZOOM) {
    const b = map.getBounds();
    for (const site of st.sites) {
      if (want.size >= MAX_MARKERS) break;
      if (b.contains(site.coord)) want.set(site.coord.join(','), site);
    }
  }
  for (const [k, m] of st.markers) {
    if (!want.has(k)) {
      m.remove();
      st.markers.delete(k);
    }
  }
  const w = flagWidthPx(z);
  for (const [k, site] of want) {
    const lift = liftPx(map, site);
    let m = st.markers.get(k);
    if (!m) {
      const el = document.createElement('div');
      el.className = 'ga-building-flag';
      el.setAttribute('aria-hidden', 'true');
      m = new Marker({ element: el, anchor: 'bottom-left', opacity: '1', opacityWhenCovered: '1', pitchAlignment: 'viewport', rotationAlignment: 'viewport' }).setLngLat(site.coord).addTo(map);
      st.markers.set(k, m);
    }
    const el = m.getElement();
    el.style.setProperty('--w', `${w}px`);
    el.style.setProperty('--pole', `${Math.round(lift)}px`);
    m.setOffset([0, -lift]);
  }
}

/** Flags waving above the enlarged 3D building models (police facilities, fire stations), each on its building's coordinate. */
export function setGaBuildingFlags(map: MapLibreMap, sites: FlagSite[]): void {
  ensureSprite();
  let st = states.get(map);
  if (!st) {
    st = { sites: [], markers: new Map(), bound: false };
    states.set(map, st);
  }
  st.sites = sites;
  if (!st.bound) {
    st.bound = true;
    const s = st;
    map.on('move', () => place(map, s));
    map.once('remove', () => {
      for (const m of s.markers.values()) m.remove();
      s.markers.clear();
    });
  }
  place(map, st);
}

import { POLICE_FLASH_MS, POLICE_OFF, policeLightBar } from './parse';

const STYLE_ID = 'fbi-lightbar-css';
const FRAMES = 16;
export const LIGHTBAR_CLASS = 'fbi-lightbar';

/** Injects a CSS keyframe animation of the police quad-flash pattern; elements with LIGHTBAR_CLASS flash without redrawing the map. */
export function ensureLightBarCss(): void {
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const frames = Array.from({ length: FRAMES + 1 }, (_, i) => {
    const l = policeLightBar((i % FRAMES) * POLICE_FLASH_MS);
    const pct = ((i / FRAMES) * 100).toFixed(2);
    return `${pct}%{background:${l.on ? l.color : POLICE_OFF};box-shadow:0 0 ${l.on ? 12 : 0}px ${l.on ? 4 : 0}px ${l.color}}`;
  });
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `@keyframes fbi-lightbar{${frames.join('')}}.${LIGHTBAR_CLASS}{animation:fbi-lightbar ${FRAMES * POLICE_FLASH_MS}ms steps(1,end) infinite}@media (prefers-reduced-motion:reduce){.${LIGHTBAR_CLASS}{animation-duration:${FRAMES * POLICE_FLASH_MS * 4}ms}}`;
  document.head.append(style);
}

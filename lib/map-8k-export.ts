import type { Map as MapLibreMap } from 'maplibre-gl';
import { gaDeckCanvas, onNextGaDeckFrame, setGaDeckPixelRatio } from './ga-deck-overlay';

export const EXPORT_8K_WIDTH = 7680;

export interface MapExport {
  blob: Blob;
  width: number;
  height: number;
  liveIcons: boolean;
}

function nextFrame(map: MapLibreMap, draw: () => void): Promise<void> {
  return new Promise((resolve) => {
    map.once('render', () => {
      draw();
      resolve();
    });
    map.triggerRepaint();
  });
}

function idle(map: MapLibreMap, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = window.setTimeout(resolve, timeoutMs);
    map.once('idle', () => {
      window.clearTimeout(timer);
      resolve();
    });
    map.triggerRepaint();
  });
}

function deckResized(map: MapLibreMap, width: number, timeoutMs: number): Promise<void> {
  return new Promise((resolve) => {
    const start = performance.now();
    const check = () => {
      const deck = gaDeckCanvas(map);
      if (!deck || deck.width >= width || performance.now() - start > timeoutMs) resolve();
      else requestAnimationFrame(check);
    };
    check();
  });
}

/** Re-renders the current view at 7680 px wide (clamped to the GPU's max canvas size) and returns it as PNG, with `background` drawn underneath. */
export async function exportMapAt8k(map: MapLibreMap, background: HTMLCanvasElement | null): Promise<MapExport> {
  const canvas = map.getCanvas();
  const previous = map.getPixelRatio();
  const out = document.createElement('canvas');
  let liveIcons = false;
  try {
    map.setPixelRatio(EXPORT_8K_WIDTH / canvas.clientWidth);
    setGaDeckPixelRatio(map, canvas.width / canvas.clientWidth);
    await idle(map, 20_000);
    await deckResized(map, canvas.width, 30_000);
    await nextFrame(map, () => {
      out.width = canvas.width;
      out.height = canvas.height;
      const ctx = out.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, out.width, out.height);
      if (background) ctx.drawImage(background, 0, 0, out.width, out.height);
      ctx.drawImage(canvas, 0, 0);
    });
    liveIcons = await onNextGaDeckFrame(
      map,
      (deck) => {
        if (deck.width) out.getContext('2d')?.drawImage(deck, 0, 0, out.width, out.height);
      },
      30_000,
    );
  } finally {
    map.setPixelRatio(previous);
    setGaDeckPixelRatio(map, true);
  }
  const blob = await new Promise<Blob | null>((resolve) => out.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error(`this browser could not encode a ${out.width}×${out.height} image`);
  return { blob, width: out.width, height: out.height, liveIcons };
}

import type { Map as MapLibreMap } from 'maplibre-gl';

/**
 * MapLibre's ScaleControl recomputes only on `move`. Right after a jump over 3D terrain its unproject can return NaN (seen in a
 * phone probe as "NaN m" until the next pan). This re-runs each scale control's update every 2 s while its text contains NaN.
 */
export function scaleTextIsInvalid(text: string | null | undefined): boolean {
  return !text || /NaN|Infinity/.test(text);
}

interface ScaleLike { _container?: HTMLElement; _onMove?: () => void }

export function refreshInvalidScales(map: MapLibreMap, everyMs = 2_000): () => void {
  const timer = setInterval(() => {
    const controls = ((map as unknown as { _controls?: ScaleLike[] })._controls ?? []).filter((c) => c._container?.classList.contains('maplibregl-ctrl-scale'));
    for (const c of controls) if (scaleTextIsInvalid(c._container?.textContent) && typeof c._onMove === 'function') c._onMove();
  }, everyMs);
  return () => clearInterval(timer);
}

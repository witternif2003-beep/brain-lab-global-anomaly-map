import { Popup } from 'maplibre-gl';
import type { Map as MapLibreMap, MapGeoJSONFeature } from 'maplibre-gl';
import { labelInfoHtml, labelInfoRows } from './label-info';

export { labelInfoHtml, labelInfoRows };

/** Tap radius around the finger, in px; Apple's HIG minimum target is 44 pt, so ±11 px around the tap point is conservative. */
export const LABEL_HIT_PX = 11;
/** Layer handlers that open their own popup run first; wait this long before deciding a tapped label has none. */
export const OWN_POPUP_WAIT_MS = 80;
function topLabel(map: MapLibreMap, x: number, y: number): MapGeoJSONFeature | undefined {
  try {
    return map
      .queryRenderedFeatures([[x - LABEL_HIT_PX, y - LABEL_HIT_PX], [x + LABEL_HIT_PX, y + LABEL_HIT_PX]])
      .find((f) => f.layer?.type === 'symbol');
  } catch {
    return undefined;
  }
}

const inspected = new WeakSet<MapLibreMap>();

/**
 * Makes every text label on the map tappable. Labels whose layer already opens its own popup keep that popup;
 * any other label (base-map road and place names included) opens a small card with its text, layer and source.
 */
export function addLabelInspector(map: MapLibreMap): void {
  if (inspected.has(map)) return;
  inspected.add(map);
  let card: Popup | null = null;
  map.on('click', (e) => {
    const f = topLabel(map, e.point.x, e.point.y);
    if (!f) return;
    const container = map.getContainer();
    const before = new Set(container.querySelectorAll('.maplibregl-popup'));
    window.setTimeout(() => {
      const opened = [...container.querySelectorAll('.maplibregl-popup')].some((p) => !before.has(p) && p !== card?.getElement());
      if (opened) return;
      const src = (map.getStyle()?.sources?.[f.source] ?? {}) as { attribution?: string };
      const rows = labelInfoRows((f.properties ?? {}) as Record<string, unknown>, f.layer.id, f.source, f.sourceLayer, src.attribution);
      card?.remove();
      card = new Popup({ closeButton: true, maxWidth: '300px', className: 'label-inspector' }).setLngLat(e.lngLat).setHTML(labelInfoHtml(rows)).addTo(map);
    }, OWN_POPUP_WAIT_MS);
  });
}

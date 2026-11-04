import type { Map as MapLibreMap, ExpressionSpecification } from 'maplibre-gl';

/** Overture Maps publishes each monthly release as public PMTiles (CORS *, HTTP range) at no cost to readers. */
export const OVERTURE_TILES_BUCKET = 'https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com';
export const OVERTURE_FALLBACK_RELEASE = '2026-10-21.0';
export const OVERTURE_DOCS_URL = 'https://docs.overturemaps.org/examples/overture-tiles/';
export const OVERTURE_BUILDINGS_SOURCE = 'ovt-buildings';
export const GA_BBOX: [number, number, number, number] = [-85.61, 30.35, -80.84, 35.0];
/** Overture building tiles carry every footprint and its `height` only in their z14 tiles; lower zooms are thinned. */
export const OVERTURE_FULL_ZOOM = 14;
export const BUILDINGS_2D_MIN_ZOOM = 10;
/** Assumed storey height when a building records floors but no height. */
export const FLOOR_HEIGHT_M = 3.2;
export const DEFAULT_HEIGHT_M = 5;

/** Newest `tiles/<release>/` prefix in an S3 ListObjectsV2 response, or null. */
export function latestRelease(listXml: string): string | null {
  const releases = [...listXml.matchAll(/<Prefix>tiles\/(\d{4}-\d{2}-\d{2}\.\d+)\/<\/Prefix>/g)].map((m) => m[1]);
  if (!releases.length) return null;
  return releases.sort((a, b) => {
    const [da, na] = a.split(/\.(?=\d+$)/);
    const [db, nb] = b.split(/\.(?=\d+$)/);
    return da === db ? Number(na) - Number(nb) : da < db ? -1 : 1;
  })[releases.length - 1];
}

export const buildingsUrl = (release: string) => `pmtiles://${OVERTURE_TILES_BUCKET}/tiles/${release}/buildings.pmtiles`;

/** Height used for extrusion, in priority order: LiDAR-measured (feature-state), recorded height, floors × 3.2 m, 5 m. */
export const HEIGHT_EXPRESSION: ExpressionSpecification = [
  'coalesce',
  ['feature-state', 'lidarHeight'],
  ['get', 'height'],
  ['case', ['has', 'num_floors'], ['*', ['to-number', ['get', 'num_floors'], 0], FLOOR_HEIGHT_M], DEFAULT_HEIGHT_M],
];

/** Colour: NAIP roof pixels (feature-state), else Overture `roof_color`, else a height ramp. */
export const COLOR_EXPRESSION: ExpressionSpecification = [
  'case',
  ['!=', ['typeof', ['feature-state', 'roofColor']], 'null'],
  ['to-color', ['feature-state', 'roofColor'], '#cbd5e1'],
  ['has', 'roof_color'],
  ['to-color', ['get', 'roof_color'], '#cbd5e1'],
  ['has', 'facade_color'],
  ['to-color', ['get', 'facade_color'], '#cbd5e1'],
  ['has', 'facade_material'],
  ['match', ['get', 'facade_material'], 'brick', '#a0624a', 'glass', '#8fa7b8', 'metal', '#9aa3ab', 'stone', '#c2b8a3', 'wood', '#a68a64', 'concrete', '#bdb8ae', 'plaster', '#d8d0c0', '#c9c4ba'],
  ['match', ['get', 'subtype'], 'residential', '#d6cbb8', 'commercial', '#c4c6c8', 'industrial', '#b4b0a8', 'education', '#cdbfa8', 'medical', '#d9dcdf', 'religious', '#d2c6b2', 'civic', '#c9c2b4', 'transportation', '#b9bcbf', 'agricultural', '#b9a88c', '#c9c4ba'],
];

/** Overture `building_part` heights: recorded height, else floors × 3.2 m above the part's own base. */
export const PART_BASE_EXPRESSION: ExpressionSpecification = [
  'coalesce',
  ['get', 'min_height'],
  ['case', ['has', 'min_floor'], ['*', ['to-number', ['get', 'min_floor'], 0], FLOOR_HEIGHT_M], 0],
];
export const PART_HEIGHT_EXPRESSION: ExpressionSpecification = [
  'coalesce',
  ['get', 'height'],
  ['case', ['has', 'num_floors'], ['*', ['to-number', ['get', 'num_floors'], 0], FLOOR_HEIGHT_M], ['+', ['to-number', PART_BASE_EXPRESSION, 0], DEFAULT_HEIGHT_M]],
];
export const PART_COLOR_EXPRESSION: ExpressionSpecification = [
  'case',
  ['has', 'facade_color'],
  ['to-color', ['get', 'facade_color'], '#e2e8f0'],
  ['has', 'roof_color'],
  ['to-color', ['get', 'roof_color'], '#e2e8f0'],
  ['interpolate', ['linear'], ['to-number', PART_HEIGHT_EXPRESSION, DEFAULT_HEIGHT_M], 0, '#e2e8f0', 40, '#bfdbfe', 150, '#60a5fa'],
];
/** Outlines of buildings that Overture splits into parts stay drawn, see-through, so no footprint disappears. */
export const SHELL_OPACITY = 0.3;
/** Every 3D building layer, for code that dims buildings while LiDAR points draw. */
export const BUILDING_3D_LAYERS = ['buildings-3d', 'buildings-3d-shell', 'buildings-parts-3d'] as const;

export interface OvertureState {
  release: string;
  status: 'loading' | 'ok' | 'fallback' | 'error';
  error?: string;
}

const protocolInstalled = new WeakSet<object>();

async function installProtocol(maplibre: typeof import('maplibre-gl')): Promise<void> {
  if (protocolInstalled.has(maplibre)) return;
  const { Protocol } = await import('pmtiles');
  maplibre.addProtocol('pmtiles', new Protocol().tile);
  protocolInstalled.add(maplibre);
}

async function discoverRelease(): Promise<{ release: string; discovered: boolean }> {
  try {
    const r = await fetch(`${OVERTURE_TILES_BUCKET}/?list-type=2&prefix=tiles/&delimiter=/`);
    const rel = r.ok ? latestRelease(await r.text()) : null;
    if (rel) return { release: rel, discovered: true };
  } catch {
    /* fall through */
  }
  return { release: OVERTURE_FALLBACK_RELEASE, discovered: false };
}

/**
 * Statewide Overture buildings (OSM first, then Microsoft/Google ML footprints): 2D outlines from z10,
 * complete 3D extrusions from z14. Keeps the `buildings-3d` layer id the LiDAR layer dims while points draw.
 */
export async function addOvertureBuildings(
  map: MapLibreMap,
  maplibre: typeof import('maplibre-gl'),
  onState?: (s: OvertureState) => void,
): Promise<void> {
  onState?.({ release: OVERTURE_FALLBACK_RELEASE, status: 'loading' });
  await installProtocol(maplibre);
  const { release, discovered } = await discoverRelease();
  if (!map.getStyle()) return;
  if (!map.getSource(OVERTURE_BUILDINGS_SOURCE)) {
    map.addSource(OVERTURE_BUILDINGS_SOURCE, {
      type: 'vector',
      url: buildingsUrl(release),
      promoteId: 'id',
      bounds: GA_BBOX,
      attribution: `3D buildings: <a href="${OVERTURE_DOCS_URL}" target="_blank" rel="noopener">Overture Maps ${release}</a> (ODbL) — © OpenStreetMap contributors, Microsoft &amp; Google ML footprints`,
    });
  }
  const before = map.getLayer('ga-fill') ? 'ga-fill' : undefined;
  if (!map.getLayer('buildings-2d')) {
    map.addLayer(
      {
        id: 'buildings-2d',
        type: 'fill',
        source: OVERTURE_BUILDINGS_SOURCE,
        'source-layer': 'building',
        minzoom: BUILDINGS_2D_MIN_ZOOM,
        maxzoom: OVERTURE_FULL_ZOOM,
        paint: { 'fill-color': '#f8fafc', 'fill-opacity': ['interpolate', ['linear'], ['zoom'], 10, 0.75, 13.5, 0.9], 'fill-outline-color': '#38bdf8' },
      },
      before,
    );
  }
  const underground: ExpressionSpecification = ['!=', ['get', 'is_underground'], true];
  const hasParts: ExpressionSpecification = ['==', ['get', 'has_parts'], true];
  const extrusion = (opacity: number) => ({
    'fill-extrusion-color': COLOR_EXPRESSION,
    'fill-extrusion-height': HEIGHT_EXPRESSION,
    'fill-extrusion-base': ['coalesce', ['get', 'min_height'], 0] as ExpressionSpecification,
    'fill-extrusion-opacity': opacity,
    'fill-extrusion-vertical-gradient': true,
  });
  if (!map.getLayer('buildings-3d')) {
    map.addLayer(
      { id: 'buildings-3d', type: 'fill-extrusion', source: OVERTURE_BUILDINGS_SOURCE, 'source-layer': 'building', minzoom: OVERTURE_FULL_ZOOM, filter: ['all', underground, ['!', hasParts]], paint: extrusion(0.9) },
      before,
    );
  }
  if (!map.getLayer('buildings-3d-shell')) {
    map.addLayer(
      { id: 'buildings-3d-shell', type: 'fill-extrusion', source: OVERTURE_BUILDINGS_SOURCE, 'source-layer': 'building', minzoom: OVERTURE_FULL_ZOOM, filter: ['all', underground, hasParts], paint: extrusion(SHELL_OPACITY) },
      before,
    );
  }
  if (!map.getLayer('buildings-parts-3d')) {
    map.addLayer(
      {
        id: 'buildings-parts-3d',
        type: 'fill-extrusion',
        source: OVERTURE_BUILDINGS_SOURCE,
        'source-layer': 'building_part',
        minzoom: OVERTURE_FULL_ZOOM,
        filter: underground,
        paint: {
          'fill-extrusion-color': PART_COLOR_EXPRESSION,
          'fill-extrusion-height': PART_HEIGHT_EXPRESSION,
          'fill-extrusion-base': PART_BASE_EXPRESSION,
          'fill-extrusion-opacity': 0.95,
          'fill-extrusion-vertical-gradient': true,
        },
      },
      before,
    );
  }
  map.on('error', (ev) => {
    const e = ev as unknown as { sourceId?: string; error?: Error };
    if (e.sourceId === OVERTURE_BUILDINGS_SOURCE) onState?.({ release, status: 'error', error: e.error?.message });
  });
  onState?.({ release, status: discovered ? 'ok' : 'fallback' });
}

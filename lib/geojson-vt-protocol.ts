// lib/geojson-vt-protocol.ts
import * as maplibregl from 'maplibre-gl';
import geojsonvt from 'geojson-vt';
import { fromGeojsonVt } from '@maplibre/vt-pbf';

export const LARGE_VECTOR_FEATURE_THRESHOLD = 50_000;

// Cache map of client-side vector tile indexes by sourceId
const tileIndexes = new Map<string, any>();

function parseTileUrl(url: string): { sourceId: string; z: number; x: number; y: number } {
  // Expected url format: gjvt://{sourceId}/{z}/{x}/{y}
  const clean = url.replace('gjvt://', '');
  const parts = clean.split('/');
  return {
    sourceId: parts[0],
    z: parseInt(parts[1], 10),
    x: parseInt(parts[2], 10),
    y: parseInt(parts[3], 10),
  };
}

let protocolRegistered = false;

export function ensureGeoJSONVTProtocolRegistered(): void {
  if (protocolRegistered || typeof window === 'undefined') return;

  try {
    (maplibregl as any).addProtocol('gjvt', (params: any, abortController: any) => {
      return new Promise((resolve) => {
        const { sourceId, z, x, y } = parseTileUrl(params.url);
        const tileIndex = tileIndexes.get(sourceId);

        if (!tileIndex) {
          resolve({ data: new Uint8Array(0).buffer });
          return;
        }

        const tile = tileIndex.getTile(z, x, y);
        if (!tile) {
          resolve({ data: new Uint8Array(0).buffer });
          return;
        }

        // Encode the GeoJSON-VT sliced tile into standard Mapbox Vector Tile (PBF) format
        const pbf = fromGeojsonVt({ [sourceId]: tile });
        resolve({ data: pbf.buffer || pbf });
      });
    });
    protocolRegistered = true;
  } catch (err) {
    console.warn('[gjvt-protocol] Protocol already registered or failed:', err);
  }
}

export function shouldUseTiledRendering(featureCount: number): boolean {
  return featureCount > LARGE_VECTOR_FEATURE_THRESHOLD;
}

export function registerGeoJSONVTSource(
  map: maplibregl.Map,
  sourceId: string,
  geojson: any,
  options?: {
    maxZoom?: number;
    tolerance?: number;
    extent?: number;
    buffer?: number;
    indexMaxZoom?: number;
    indexMaxPoints?: number;
  }
): void {
  ensureGeoJSONVTProtocolRegistered();

  const vtFn = typeof (geojsonvt as any).default === 'function' ? (geojsonvt as any).default : (geojsonvt as any);
  const tileIndex = vtFn(geojson, {
    maxZoom: options?.maxZoom ?? 18,
    tolerance: options?.tolerance ?? 3,
    extent: options?.extent ?? 4096,
    buffer: options?.buffer ?? 64,
    indexMaxZoom: options?.indexMaxZoom ?? 5,
    indexMaxPoints: options?.indexMaxPoints ?? 100_000,
  });

  tileIndexes.set(sourceId, tileIndex);

  // If source already exists, update tile index
  if (map.getSource(sourceId)) {
    return;
  }

  map.addSource(sourceId, {
    type: 'vector',
    tiles: [`gjvt://${sourceId}/{z}/{x}/{y}`],
    minzoom: 0,
    maxzoom: 18,
  } as any);
}

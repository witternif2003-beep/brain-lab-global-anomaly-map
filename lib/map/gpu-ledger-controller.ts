import type { Map as MapLibreMap } from 'maplibre-gl';
import { gaDeckCanvas, setGaDeckPixelRatio } from '../ga-deck-overlay';
import { gaTrafficCanvas } from '../traffic-overlay';
import { reportGaFeed } from '../ga-live-status';
import { gpuSafeMode } from './crash-guard';
import { NO_SHED, PRESSURE_ON, ledgerState, nextShed, type LedgerState, type ShedLevels } from './gpu-ledger';
import { setTileTexturePool } from './tile-texture-pool';
import { isTouchDevice, TOUCH_MAX_PIXEL_RATIO } from './touch-gpu-budget';
import { drawingBufferBytes, LIDAR_BYTES_PER_POINT, vramTargetBytes } from './vram-budget';
import { canvasBytes, vramMeterInstalled, vramSnapshot } from './vram-meter';

const MB = 1024 * 1024;
const TICK_MS = 2_000;
/** Spare tiles each map source keeps while the map slice is shedding (MapLibre's TileManager._maxTileCacheSize). */
export const SHED_TILE_CACHE = 12;

export interface GpuLedgerStats {
  state: LedgerState | null;
  shed: ShedLevels;
  /** Peaks and shed transitions since the RUM probe last read them (components/RenderMetricsProbe.tsx resets them). */
  peakRatio: number;
  telemetryPeakRatio: number;
  shedEvents: number;
}

interface TileManagerInternals { _maxTileCacheSize: number | null }
type MapInternals = { _maxTileCacheSize?: number | null; style?: { tileManagers?: Record<string, TileManagerInternals> } };

function setTileCache(map: MapLibreMap, size: number | null): void {
  const m = map as unknown as MapInternals;
  if ('_maxTileCacheSize' in m) m._maxTileCacheSize = size;
  for (const tm of Object.values(m.style?.tileManagers ?? {})) tm._maxTileCacheSize = size;
}

/** Measures the ledger every 2 s and sheds or restores detail per slice; returns a stop function. */
export function startGpuLedger(map: MapLibreMap, mapPixelRatio: () => number): () => void {
  const stats: GpuLedgerStats = { state: null, shed: NO_SHED, peakRatio: 0, telemetryPeakRatio: 0, shedEvents: 0 };
  window.__gaLedger = stats;
  const baseTileCache = (map as unknown as MapInternals)._maxTileCacheSize ?? null;
  let basePool: number | null = null;

  const applyTelemetry = (on: boolean, pressure: boolean) =>
    setGaDeckPixelRatio(map, on ? Math.min(window.devicePixelRatio || 1, pressure ? 1 : TOUCH_MAX_PIXEL_RATIO) : true);
  const applyMap = (on: boolean, pressure: boolean) => {
    if (on) {
      setTileCache(map, typeof baseTileCache === 'number' ? Math.min(baseTileCache, SHED_TILE_CACHE) : SHED_TILE_CACHE);
      const prev = setTileTexturePool(map, 0);
      if (basePool === null) basePool = prev;
      map.setPixelRatio(Math.min(mapPixelRatio(), pressure ? 1 : TOUCH_MAX_PIXEL_RATIO));
    } else {
      setTileCache(map, baseTileCache);
      if (basePool !== null) setTileTexturePool(map, basePool);
      basePool = null;
      map.setPixelRatio(mapPixelRatio());
    }
  };

  let lastPressure = false;
  const tick = () => {
    if (!vramMeterInstalled()) return;
    const touch = isTouchDevice();
    const target = vramTargetBytes(touch, gpuSafeMode());
    const mapCanvas = map.getCanvas();
    const deck = gaDeckCanvas(map);
    const traffic = gaTrafficCanvas(map);
    const trafficBuffer = traffic ? drawingBufferBytes(traffic.width, traffic.height, 1) : 0;
    const total = vramSnapshot().bytes + drawingBufferBytes(mapCanvas.width, mapCanvas.height, touch ? 1 : 4) + (deck ? drawingBufferBytes(deck.width, deck.height, 1) : 0) + trafficBuffer;
    const telemetry = (deck ? canvasBytes(deck) + drawingBufferBytes(deck.width, deck.height, 1) : 0) + (traffic ? canvasBytes(traffic) + trafficBuffer : 0);
    const points = (window as unknown as { __gaLidar?: { pointsDrawn?: number } }).__gaLidar?.pointsDrawn ?? 0;
    const lidar = Math.min(total - telemetry, points * LIDAR_BYTES_PER_POINT);
    const state = ledgerState({ telemetry, lidar, map: total - telemetry - lidar }, target, stats.state?.pressure ?? false);
    const shed = nextShed(stats.shed, state);
    if (shed.telemetry !== stats.shed.telemetry || (shed.telemetry && state.pressure !== lastPressure)) applyTelemetry(shed.telemetry, state.pressure);
    if (shed.map !== stats.shed.map || (shed.map && state.pressure !== lastPressure)) applyMap(shed.map, state.pressure);
    stats.shedEvents += Number(shed.telemetry && !stats.shed.telemetry) + Number(shed.map && !stats.shed.map);
    stats.peakRatio = Math.max(stats.peakRatio, state.ratio);
    stats.telemetryPeakRatio = Math.max(stats.telemetryPeakRatio, state.slices.telemetry > 0 ? telemetry / state.slices.telemetry : 0);
    stats.state = state;
    stats.shed = shed;
    lastPressure = state.pressure;
    const mb = (b: number) => Math.round(b / MB);
    reportGaFeed(map, {
      id: 'gpu-ledger',
      label: 'GPU memory shares (measured)',
      color: state.pressure ? '#f43f5e' : shed.telemetry || shed.map ? '#f59e0b' : '#22d3ee',
      count: mb(state.totalBytes),
      detail: `MB used of ${mb(target)} MB app target · telemetry ${mb(telemetry)}/${mb(state.slices.telemetry)} reserved · map+terrain ${mb(state.usage.map)}/${mb(state.slices.map)} · LiDAR ${mb(lidar)}/${mb(state.slices.lidar)} · ${mb(state.slices.reserve)} kept free${state.pressure ? ` · over ${Math.round(PRESSURE_ON * 100)}%: LiDAR paused, detail reduced` : shed.telemetry || shed.map ? ' · reduced detail on the slice over its share' : ''} · app-set budget measured from WebGL allocations, not a hardware VRAM reading`,
      updatedAt: new Date().toISOString(),
      sourceUrl: 'https://registry.khronos.org/webgl/specs/latest/1.0/',
    });
  };
  const timer = window.setInterval(tick, TICK_MS);
  return () => {
    window.clearInterval(timer);
    if (window.__gaLedger === stats) window.__gaLedger = undefined;
  };
}

/** Whether total use is at or above the pressure threshold (LiDAR stops loading new points). */
export const gpuLedgerPressure = (): boolean => window.__gaLedger?.state?.pressure ?? false;

declare global {
  interface Window { __gaLedger?: GpuLedgerStats }
}

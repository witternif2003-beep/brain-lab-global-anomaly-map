import type { EkfMeasurement } from './ekf';

export interface AircraftPredictor {
  readonly mode: 'worker' | 'straight';
  ingest(batch: EkfMeasurement[]): void;
  /** Ask for positions at epoch ms `t`; `onUpdate` fires when they arrive. Returns false when no worker is running. */
  predict(t: number): boolean;
  get(id: string): [number, number] | undefined;
  dispose(): void;
}

const STRAIGHT: AircraftPredictor = { mode: 'straight', ingest() {}, predict: () => false, get: () => undefined, dispose() {} };

/** Runs the CTRV EKF in a Web Worker; if the worker can't start or errors, callers fall back to straight-line dead reckoning. */
export function createAircraftPredictor(onUpdate: () => void): AircraftPredictor {
  if (typeof Worker === 'undefined') return STRAIGHT;
  let worker: Worker;
  try {
    worker = new Worker(new URL('./ekf.worker.ts', import.meta.url), { type: 'module' });
  } catch {
    return STRAIGHT;
  }
  let positions: Record<string, [number, number]> = {};
  let failed = false;
  let inFlight = false;
  worker.onmessage = (e: MessageEvent<{ type: string; positions: Record<string, [number, number]> }>) => {
    if (e.data?.type !== 'predicted') return;
    inFlight = false;
    positions = e.data.positions;
    onUpdate();
  };
  worker.onerror = () => {
    failed = true;
    positions = {};
    worker.terminate();
  };
  return {
    get mode() {
      return failed ? 'straight' : 'worker';
    },
    ingest(batch) {
      if (!failed) worker.postMessage({ type: 'ingest', batch });
    },
    predict(t) {
      if (failed) return false;
      if (!inFlight) {
        inFlight = true;
        worker.postMessage({ type: 'predict', t });
      }
      return true;
    },
    get: (id) => (failed ? undefined : positions[id]),
    dispose() {
      failed = true;
      worker.terminate();
    },
  };
}

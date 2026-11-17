import { EkfTracker, type EkfMeasurement } from './ekf';

type In = { type: 'ingest'; batch: EkfMeasurement[] } | { type: 'predict'; t: number };

const tracker = new EkfTracker();
const port = self as unknown as { postMessage(data: unknown): void; onmessage: ((e: MessageEvent<In>) => void) | null };

port.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === 'ingest') tracker.ingest(msg.batch);
  else if (msg.type === 'predict') port.postMessage({ type: 'predicted', t: msg.t, positions: tracker.predict(msg.t) });
};

import { create } from "zustand";

export type Telemetry = { fps: number; particles: number; frameMs: number };
export type Quality = "high" | "medium" | "low" | "static";

interface AmbientState {
  quality: Quality;
  telemetry: Telemetry;
  setQuality: (q: Quality) => void;
  setTelemetry: (t: Telemetry) => void;
}

export const useAmbientStore = create<AmbientState>((set) => ({
  quality: "high",
  telemetry: { fps: 60, particles: 120, frameMs: 16 },
  setQuality: (quality) => set({ quality }),
  setTelemetry: (telemetry) => set({ telemetry }),
}));

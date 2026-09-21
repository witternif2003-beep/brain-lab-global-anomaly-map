/**
 * WGPULens Privacy Defense & Safe Adapter Telemetry Gateway
 * arXiv 2026 / Brave v1.93 Fingerprinting Defense
 */

export interface SafeGPUCapabilities {
  hasWebGPU: boolean;
  maxComputeWorkgroupSize: number;
  supportsTimestampQuery: boolean;
  privacySanitized: boolean;
}

export async function getSafeAdapter(): Promise<GPUAdapter | null> {
  if (typeof navigator === "undefined" || !("gpu" in navigator)) {
    return null;
  }

  try {
    const adapter = await (navigator as unknown as { gpu: { requestAdapter: () => Promise<GPUAdapter | null> } }).gpu.requestAdapter();
    if (!adapter) return null;
    return adapter;
  } catch {
    return null;
  }
}

export async function detectWebGPUFeatures(): Promise<SafeGPUCapabilities> {
  const adapter = await getSafeAdapter();
  if (!adapter) {
    return {
      hasWebGPU: false,
      maxComputeWorkgroupSize: 0,
      supportsTimestampQuery: false,
      privacySanitized: true,
    };
  }

  try {
    const device = await adapter.requestDevice();
    const limits = device.limits;
    const features = device.features;

    return {
      hasWebGPU: true,
      maxComputeWorkgroupSize: limits.maxComputeWorkgroupSizeX || 256,
      supportsTimestampQuery: features.has("timestamp-query"),
      privacySanitized: true, // No adapter.info exposed
    };
  } catch {
    return {
      hasWebGPU: false,
      maxComputeWorkgroupSize: 0,
      supportsTimestampQuery: false,
      privacySanitized: true,
    };
  }
}

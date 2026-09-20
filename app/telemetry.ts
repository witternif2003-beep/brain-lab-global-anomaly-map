import { onCLS, onINP, onLCP, onFCP, onTTFB } from "web-vitals";

export function initWebVitals() {
  if (typeof window === "undefined") return;
  const log = (m: any) => {
    // 2026 Core Web Vitals telemetry reporting
    if (process.env.NODE_ENV !== "production") {
      console.log(`[vitals] ${m.name} = ${m.value.toFixed(1)}ms (${m.rating})`);
    }
  };
  try {
    onCLS(log);
    onINP(log);
    onLCP(log);
    onFCP(log);
    onTTFB(log);
  } catch (e) {
    // Graceful fallback if unsupported
  }
}

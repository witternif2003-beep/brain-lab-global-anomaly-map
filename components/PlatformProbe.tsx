"use client";
import { useEffect } from "react";

/**
 * PlatformProbe — Detects iOS / iPadOS Safari & Desktop-mode User Agents
 * Appends `data-platform="ios"` to the documentElement to trigger responsive
 * font-scale shifts, safe area insets, and prevent 980px layout viewport traps.
 */
export function PlatformProbe() {
  useEffect(() => {
    if (typeof window === "undefined" || !window.navigator) return;

    const ua = window.navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1);

    if (isIOS) {
      document.documentElement.dataset.platform = "ios";
    }
  }, []);

  return null;
}

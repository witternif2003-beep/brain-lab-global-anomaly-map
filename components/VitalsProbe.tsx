"use client";
import { useEffect } from "react";
import { initWebVitals } from "../app/telemetry";

export default function VitalsProbe() {
  useEffect(() => {
    initWebVitals();
  }, []);
  return null;
}

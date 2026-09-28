"use client";
import { useEffect, useState } from "react";

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false
});

export default function LiveTimestamp({ tz = "ET" }: { tz?: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date()); // first tick immediately after mount
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <span suppressHydrationWarning>—:—:— {tz}</span>;

  return <span suppressHydrationWarning>{fmt.format(now)} {tz}</span>;
}

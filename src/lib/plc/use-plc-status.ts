"use client";

/**
 * use-plc-status.ts
 * Polls GET /api/plc/status every few seconds.
 * Place in: src/lib/plc/use-plc-status.ts
 */

import * as React from "react";

export type PlcStatus = "running" | "stopped" | "disconnected" | "unknown";

const POLL_MS = 3000;

export function usePlcStatus(): PlcStatus {
  const [status, setStatus] = React.useState<PlcStatus>("unknown");

  React.useEffect(() => {
    let alive = true;

    const poll = async () => {
      try {
        const res = await fetch("/api/plc/status", { cache: "no-store" });
        const data = (await res.json()) as { plc?: PlcStatus };
        if (alive) setStatus(data.plc ?? "disconnected");
      } catch {
        // Bridge server itself unreachable — treat the same as disconnected.
        if (alive) setStatus("disconnected");
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return status;
}

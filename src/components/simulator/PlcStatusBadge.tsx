"use client";

/**
 * PlcStatusBadge.tsx
 * Small connection indicator for the simulator header.
 * Place in: src/components/simulator/PlcStatusBadge.tsx
 *
 * Usage in SimulatorShell:
 *   const plcStatus = usePlcStatus();
 *   <PlcStatusBadge status={plcStatus} />
 *   // and gate actions: disabled={plcStatus !== "running"}
 */

import * as React from "react";
import { usePlcStatus, type PlcStatus } from "@/lib/plc/use-plc-status";

const LABELS: Record<PlcStatus, { text: string; dot: string; cls: string }> = {
  running: {
    text: "Server connected",
    dot: "bg-green-500",
    cls: "border-green-600/40 text-green-700",
  },
  stopped: {
    text: "PLC in STOP mode",
    dot: "bg-yellow-500",
    cls: "border-yellow-600/40 text-yellow-700",
  },
  disconnected: {
    text: "Server disconnected",
    dot: "bg-red-500",
    cls: "border-red-600/40 text-red-700",
  },
  unknown: {
    text: "Checking…",
    dot: "bg-gray-400",
    cls: "border-gray-400/40 text-gray-600",
  },
};

export function PlcStatusBadge({ status }: { status?: PlcStatus }) {
  const polled = usePlcStatus();
  const s = status ?? polled;
  const { text, dot, cls } = LABELS[s];

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs font-medium ${cls}`}
      role="status"
      aria-live="polite"
    >
      <span className="relative flex h-2 w-2">
        {s === "running" && (
          <span
            className={`absolute inline-flex h-full w-full animate-ping rounded-full ${dot} opacity-60`}
          />
        )}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
      </span>
      {text}
    </span>
  );
}

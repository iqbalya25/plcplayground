"use client";

import * as React from "react";

interface PhaseReading {
  v: number;
  i: number;
  p: number;
}

export interface PowerMeterState {
  phases: { a: PhaseReading; b: PhaseReading; c: PhaseReading };
  vab: number;
  vbc: number;
  vca: number;
  pTotal: number;
  qTotal: number;
  sTotal: number;
  pfTotal: number;
  frequency: number;
  energyTotal: number;
  motors: Record<string, boolean>;
}

const POLL_MS = 1000;

export function usePowerMeterState() {
  const [state, setState] = React.useState<PowerMeterState | null>(null);
  const [connected, setConnected] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/powermeter/state");
        if (!res.ok) throw new Error("bad status");
        const data = (await res.json()) as PowerMeterState;
        if (!cancelled) {
          setState(data);
          setConnected(true);
        }
      } catch {
        if (!cancelled) setConnected(false);
      }
    };
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const setMotor = React.useCallback(async (id: string, running: boolean) => {
    await fetch(`/api/powermeter/motor/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ running }),
    });
  }, []);

  return { state, connected, setMotor };
}

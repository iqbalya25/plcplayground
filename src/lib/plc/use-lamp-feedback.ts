"use client";

import * as React from "react";
import { fetchLamps } from "./plc-api";

const POLL_MS = 300;

type Lamps = Readonly<Record<string, boolean>>;
const NONE: Lamps = {};

export interface LampFeedback {
  lamps: Lamps;
  /** Backend's own power flag. null = unknown (disabled or bridge unreachable). */
  backendPoweredOn: boolean | null;
}
const IDLE: LampFeedback = { lamps: NONE, backendPoweredOn: null };

function same(a: LampFeedback, b: LampFeedback): boolean {
  if (a.backendPoweredOn !== b.backendPoweredOn) return false;
  const ka = Object.keys(a.lamps);
  const kb = Object.keys(b.lamps);
  return ka.length === kb.length && ka.every((k) => a.lamps[k] === b.lamps[k]);
}

/** Real FX5U output state (Y0, Y1, Y4, Y5) plus the backend's power flag. */
export function useLampFeedback(enabled: boolean): LampFeedback {
  const [fb, setFb] = React.useState<LampFeedback>(IDLE);

  React.useEffect(() => {
    if (!enabled) {
      setFb(IDLE);
      return;
    }
    let alive = true;
    let busy = false;

    const poll = async () => {
      if (busy) return;
      busy = true;
      try {
        const data = await fetchLamps();
        const next: LampFeedback = {
          lamps: data.lamps ?? NONE,
          backendPoweredOn: data.poweredOn,
        };
        if (alive) setFb((prev) => (same(prev, next) ? prev : next));
      } catch {
        if (alive) setFb(IDLE);
      } finally {
        busy = false;
      }
    };

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [enabled]);

  return fb;
}

"use client";

import * as React from "react";
import { fetchLamps } from "./plc-api";

const POLL_MS = 300;

type Lamps = Readonly<Record<string, boolean>>;
const NONE: Lamps = {};

function same(a: Lamps, b: Lamps): boolean {
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => a[k] === b[k]);
}

/** Real FX5U output state (Y0, Y1, Y4, Y5 -> true/false) via the backend. */
export function useLampFeedback(enabled: boolean): Lamps {
  const [lamps, setLamps] = React.useState<Lamps>(NONE);

  React.useEffect(() => {
    if (!enabled) {
      setLamps(NONE);
      return;
    }
    let alive = true;
    let busy = false;

    const poll = async () => {
      if (busy) return;
      busy = true;
      try {
        const data = await fetchLamps();
        const next = data.lamps ?? NONE;
        // Keep the old object when nothing changed, so the canvas
        // does not re-render three times a second for nothing.
        if (alive) setLamps((prev) => (same(prev, next) ? prev : next));
      } catch {
        if (alive) setLamps(NONE);
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

  return lamps;
}
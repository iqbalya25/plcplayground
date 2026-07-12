import type { TerminalId, Wire } from "../types";

/**
 * Electrical net of a terminal. Jumper terminal blocks are internally
 * common, so every dot on a block resolves to the same net.
 */
export function net(t: TerminalId): string {
  if (t.startsWith("TB24.")) return "TB24";
  if (t.startsWith("TB0.")) return "TB0";
  return t;
}

export const pairKey = (a: string, b: string): string => [a, b].sort().join("|");

/** Map of "netA|netB" -> wires connecting those nets. */
export function buildNetMap(wires: readonly Wire[]): Map<string, Wire[]> {
  const m = new Map<string, Wire[]>();
  for (const w of wires) {
    const k = pairKey(net(w.from), net(w.to));
    const list = m.get(k);
    if (list) list.push(w);
    else m.set(k, [w]);
  }
  return m;
}

export const NICE_NET_NAMES: Record<string, string> = {
  TB24: "+24V block",
  TB0: "0V block",
};

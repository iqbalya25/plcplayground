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

/** Map of "netA|netB" -> wires connecting those nets (direct wires only). */
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

/* ------------------------------------------------------------------ */
/*  Connected components (union-find)                                  */
/*                                                                     */
/*  Models TRUE electrical connectivity: two terminals are connected   */
/*  if any chain of wires joins them — directly, via a terminal        */
/*  block, or daisy-chained through another device's screw terminal.   */
/*                                                                     */
/*  Deliberately does NOT connect through devices themselves:          */
/*  a push-button contact (13→14) or a lamp element (X1→X2) is a       */
/*  switch/load, not a conductor, so nets never propagate through it.  */
/*  (Terminal blocks DO conduct internally — handled by net().)        */
/* ------------------------------------------------------------------ */

export class Components {
  private parent = new Map<string, string>();

  constructor(wires: readonly Wire[]) {
    for (const w of wires) this.union(net(w.from), net(w.to));
  }

  private find(x: string): string {
    let root = this.parent.get(x) ?? x;
    while (root !== (this.parent.get(root) ?? root)) {
      root = this.parent.get(root) ?? root;
    }
    // path compression
    let cur = x;
    while (cur !== root) {
      const next = this.parent.get(cur) ?? cur;
      this.parent.set(cur, root);
      cur = next;
    }
    return root;
  }

  private union(a: string, b: string): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent.set(ra, rb);
  }

  /** True if the two terminals share an electrical path (any chain of wires). */
  connected(a: TerminalId, b: TerminalId): boolean {
    return this.find(net(a)) === this.find(net(b));
  }
}

export function buildComponents(wires: readonly Wire[]): Components {
  return new Components(wires);
}

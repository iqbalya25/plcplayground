import { net, buildComponents } from "./net";
import type { DangerHit, TerminalId, Wire } from "../types";

const AC_TERMS = new Set([
  "MCB.L1_IN",
  "MCB.L2_IN",
  "MCB.L1_OUT",
  "MCB.L2_OUT",
  "PSU.L_IN",
  "PSU.N_IN",
  "PLC.L",
  "PLC.N",
]);

const is24 = (n: string) => n === "TB24" || n === "PSU.24VDC";
const is0 = (n: string) => n === "TB0" || n === "PSU.0VDC";

function isDCNet(n: string): boolean {
  return (
    is24(n) ||
    is0(n) ||
    /^PB\d\./.test(n) ||
    /^LAMP\d\./.test(n) ||
    /^PLC\.(S\/S|0V|24V|X\d+|COM\d|Y\d+)$/.test(n)
  );
}

export type DangerKey = "ac-dc-contact" | "short-24-0" | "short-l1-l2";

/** Instantly-flagged destructive faults. Returns a message KEY or null. */
export function dangerCheck(a: TerminalId, b: TerminalId): DangerKey | null {
  const na = net(a);
  const nb = net(b);
  const nets = [na, nb];
  if ((AC_TERMS.has(a) || AC_TERMS.has(b)) && nets.some(isDCNet))
    return "ac-dc-contact";
  if (nets.some(is24) && nets.some(is0)) return "short-24-0";
  if (nets.includes("MCB.L1_OUT") && nets.includes("MCB.L2_OUT"))
    return "short-l1-l2";
  return null;
}

export type PolarityKey =
  | "ss-needs-24v"
  | "com-needs-0v"
  | "x-input-no-24v"
  | "x-input-direct-0v"
  | "lamp-needs-24v"
  | "button-switch-0v"
  | "lamp-spare"
  | "same-net";

/** Educational corrections for wires that are wrong but not destructive. */
export function polarityCheck(
  a: TerminalId,
  b: TerminalId,
): PolarityKey | null {
  const na = net(a);
  const nb = net(b);
  const nets = [na, nb];
  const has = (t: string) => nets.includes(t);
  const match = (re: RegExp) => nets.some((t) => re.test(t));

  if ((has("TB0") || has("PSU.0VDC")) && has("PLC.S/S")) return "ss-needs-24v";
  if ((has("TB24") || has("PSU.24VDC")) && match(/^PLC\.COM\d$/))
    return "com-needs-0v";
  if ((has("TB24") || has("PSU.24VDC")) && match(/^PLC\.X\d+$/))
    return "x-input-no-24v";
  if ((has("TB0") || has("PSU.0VDC")) && match(/^PLC\.X\d+$/))
    return "x-input-direct-0v";
  if ((has("TB0") || has("PSU.0VDC")) && match(/^LAMP\d\./))
    return "lamp-needs-24v";
  if ((has("TB24") || has("PSU.24VDC")) && match(/^PB\d\./))
    return "button-switch-0v";
  if (match(/^LAMP\d\.SP\d$/)) return "lamp-spare";
  if (na === nb) return "same-net";
  return null;
}

const L_NODES = ["MCB.L1_IN", "MCB.L1_OUT", "PLC.L", "PSU.L_IN"];
const N_NODES = ["MCB.L2_IN", "MCB.L2_OUT", "PLC.N", "PSU.N_IN"];
const V24_NODES = ["PSU.24VDC", "TB24"];
const V0_NODES = ["PSU.0VDC", "TB0"];

/**
 * Faults that only exist once wires are chained, e.g. +24V and 0V both
 * landing on the same lamp or button terminal. Every wire sitting on the
 * faulty electrical net is reported.
 */
export function componentDangers(wires: readonly Wire[]): DangerHit[] {
  const conn = buildComponents(wires);
  const dcTerms = [
    ...new Set(wires.flatMap((w) => [net(w.from), net(w.to)])),
  ].filter(isDCNet);
  const hits: DangerHit[] = [];
  for (const w of wires) {
    const t = w.from;
    const on = (group: string[]) => group.some((g) => conn.connected(t, g));
    const hasL = on(L_NODES);
    const hasN = on(N_NODES);
    let key: DangerKey | null = null;
    if (hasL && hasN) key = "short-l1-l2";
    else if (on(V24_NODES) && on(V0_NODES)) key = "short-24-0";
    else if ((hasL || hasN) && dcTerms.some((d) => conn.connected(t, d)))
      key = "ac-dc-contact";
    if (key) hits.push({ wireId: w.id, messageKey: key });
  }
  return hits;
}

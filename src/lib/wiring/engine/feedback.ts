import { net } from "./net";
import type { TerminalId } from "../types";

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

/** Instantly-flagged destructive faults. Returns a message or null. */
export function dangerCheck(a: TerminalId, b: TerminalId): string | null {
  const na = net(a);
  const nb = net(b);
  const nets = [na, nb];
  if ((AC_TERMS.has(a) || AC_TERMS.has(b)) && nets.some(isDCNet)) {
    return "⚠ DANGER: 220VAC must never touch a 24VDC terminal. In a real panel this destroys the DC circuit instantly.";
  }
  if (nets.some(is24) && nets.some(is0)) {
    return "⚠ DANGER: +24V wired to 0V is a dead short across the power supply.";
  }
  if (nets.includes("MCB.L1_OUT") && nets.includes("MCB.L2_OUT")) {
    return "⚠ DANGER: L1 wired directly to L2 is a dead short — the MCB would trip immediately.";
  }
  return null;
}

/** Educational corrections for wires that are wrong but not destructive. */
export function polarityCheck(a: TerminalId, b: TerminalId): string | null {
  const na = net(a);
  const nb = net(b);
  const nets = [na, nb];
  const has = (t: string) => nets.includes(t);
  const match = (re: RegExp) => nets.some((t) => re.test(t));

  if ((has("TB0") || has("PSU.0VDC")) && has("PLC.S/S"))
    return "❌ S/S must receive 24VDC, not 0V. Feed it from the +24V block.";
  if ((has("TB24") || has("PSU.24VDC")) && match(/^PLC\.COM\d$/))
    return "❌ COM terminals must receive 0VDC, not 24V. The output common is the 0V side in this configuration.";
  if ((has("TB24") || has("PSU.24VDC")) && match(/^PLC\.X\d+$/))
    return "❌ X inputs must not be tied to 24V. Because S/S is at 24V, an input activates when switched to 0V through a button.";
  if ((has("TB0") || has("PSU.0VDC")) && match(/^PLC\.X\d+$/))
    return "❌ Do not wire an X input straight to 0V — it would be permanently ON. The 0V must pass through a push button contact.";
  if ((has("TB0") || has("PSU.0VDC")) && match(/^LAMP\d\./))
    return "❌ The lamp's other terminal must go to the +24V block, not 0V. The Y output switches the 0V side internally through COM.";
  if ((has("TB24") || has("PSU.24VDC")) && match(/^PB\d\./))
    return "❌ The button must switch 0V into the input, not 24V. Wire the button from the 0V block.";
  if (has("PSU.24VDC") && (has("PLC.S/S") || match(/^LAMP\d\./)))
    return "❌ Distribute 24V through the +24V terminal block — the power supply screw would get crowded with multiple wires.";
  if (has("PSU.0VDC") && (match(/^PB\d\./) || match(/^PLC\.COM\d$/)))
    return "❌ Distribute 0V through the 0V terminal block — the power supply screw would get crowded with multiple wires.";
  if (match(/^LAMP\d\.SP\d$/))
    return "❌ That lamp terminal is a spare — it is not connected internally. Use X1/X2.";
  if (na === nb)
    return "❌ Both ends of this wire are already the same electrical point — the jumper block connects its terminals internally.";
  return null;
}

/** Wrong-contact lessons, resolved per button type. */
export function contactLesson(buttonKey: string, contactType: "NO" | "NC", terminal: string): string | null {
  const isNoPair = terminal === "13" || terminal === "14";
  if (contactType === "NO" && !isNoPair)
    return `❌ ${buttonKey} is an NO button — use its NO contact (13/14). Terminals 21/22 are the NC contact.`;
  if (contactType === "NC" && isNoPair)
    return `❌ ${buttonKey} is an NC button — use its NC contact (21/22) so the circuit fails safe.`;
  return null;
}

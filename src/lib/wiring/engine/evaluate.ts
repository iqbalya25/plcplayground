import type { EvalResult, TaskResult, Wire } from "../types";
import { buildComponents, net } from "./net";
import { dangerCheck, componentDangers } from "./feedback";
import {
  BUTTON_KEYS,
  LAMP_KEYS,
  PANEL_COMPONENTS,
  REQUIRED_X,
  REQUIRED_Y,
  Y_COM_GROUPS,
} from "../config/panel";

/* ------------------------------------------------------------------ */
/*  Net-propagation evaluation                                         */
/*                                                                     */
/*  A task is satisfied when the target terminal is ELECTRICALLY on    */
/*  the right net — through any path the user likes: the terminal      */
/*  block, the PSU screw directly, or daisy-chained from another       */
/*  device's supply terminal. This mirrors how real panels are wired.  */
/* ------------------------------------------------------------------ */

const CONTACT_PAIRS: Record<"NO" | "NC", [string, string]> = {
  NO: ["3", "4"],
  NC: ["1", "2"],
};

function buttonContactType(key: string): "NO" | "NC" {
  const def = PANEL_COMPONENTS.find((c) => c.key === key);
  return def?.contactType ?? "NO";
}

function deviceOf(t: string): string {
  return t.split(".")[0];
}

export function evaluate(wires: readonly Wire[]): EvalResult {
  const conn = buildComponents(wires);
  const okWireIds = new Set<string>();
  const tasks: TaskResult[] = [];
  const assignments: Record<string, string> = {};

  const directDangers = wires.flatMap((w) => {
    const key = dangerCheck(w.from, w.to);
    return key ? [{ wireId: w.id, messageKey: key }] : [];
  });
  const flagged = new Set(directDangers.map((d) => d.wireId));
  const dangers = [
    ...directDangers,
    ...componentDangers(wires).filter((d) => !flagged.has(d.wireId)),
  ];

  /* ---------- source nets --------------------------------------- */
  // A terminal is "on" a net if it connects to the source OR to the
  // distribution block for that net. (The block itself must still be
  // fed from the PSU — that's its own checklist task — so completeness
  // always requires the full chain.)
  const on0V = (t: string) =>
    conn.connected(t, "PSU.0VDC") || conn.connected(t, "TB0");
  const on24V = (t: string) =>
    conn.connected(t, "PSU.24VDC") || conn.connected(t, "TB24");
  const onL = (t: string) => conn.connected(t, "MCB.L1_OUT");
  const onN = (t: string) => conn.connected(t, "MCB.L2_OUT");

  const netTask = (id: string, label: string, done: boolean): void => {
    tasks.push({ id, label, done });
  };

  /* ---------- fixed infrastructure (any path accepted) ----------- */
  netTask(
    "ac-plc-l",
    "PLC power — PLC L on the L line (from MCB L1 OUT)",
    onL("PLC.L"),
  );
  netTask(
    "ac-plc-n",
    "PLC power — PLC N on the N line (from MCB L2 OUT)",
    onN("PLC.N"),
  );
  netTask(
    "ac-psu-l",
    "Power supply input — PSU L on the L line",
    onL("PSU.L_IN"),
  );
  netTask(
    "ac-psu-n",
    "Power supply input — PSU N on the N line",
    onN("PSU.N_IN"),
  );
  netTask(
    "dist-24",
    "24V distribution — PSU +V → +24V block",
    conn.connected("PSU.24VDC", "TB24"),
  );
  netTask(
    "dist-0",
    "0V distribution — PSU −V → 0V block",
    conn.connected("PSU.0VDC", "TB0"),
  );
  netTask("ss", "Input common — S/S on the 24V net", on24V("PLC.S/S"));

  /* ---------- buttons: free X address, supply from anywhere on 0V - */
  /* ---------- buttons: fixed address per scenario, supply from 0V -- */
  /* ---------- buttons: fixed address per scenario, supply from 0V -- */
  const bypassedDevices = new Set<string>();

  for (const key of BUTTON_KEYS) {
    const type = buttonContactType(key);
    const pair = CONTACT_PAIRS[type];
    const [t1, t2] = pair.map((p) => `${key}.${p}`) as [string, string];
    const requiredAddr = REQUIRED_X[key];

    // Bypass: an external path joins both sides of the contact — the
    // button would be permanently "pressed". Never creditable.
    const bypassed = conn.connected(t1, t2);
    if (bypassed) bypassedDevices.add(key);

    const s1 = on0V(t1);
    const s2 = on0V(t2);
    const supplyDone = (s1 || s2) && !bypassed;

    // Signal side: the OTHER contact terminal must reach THIS button's
    // required X address (see REQUIRED_X) — not just any free one.
    let address: string | undefined;
    if (!bypassed) {
      const signalCandidates = s1 && !s2 ? [t2] : s2 && !s1 ? [t1] : [t1, t2];
      if (
        signalCandidates.some((st) => conn.connected(st, `PLC.${requiredAddr}`))
      ) {
        address = requiredAddr;
      }
    }
    const signalDone = Boolean(address);
    if (supplyDone && signalDone && address) {
      assignments[key] = address;
    }

    tasks.push({
      id: `${key}-supply`,
      label: `${key} supply — 0V (block, PSU, or jumper) → ${type} contact (${pair.join("/")})`,
      done: supplyDone,
    });
    tasks.push({
      id: `${key}-signal`,
      label: `${key} signal — ${type} contact → ${requiredAddr}`,
      done: signalDone,
      detail: address ? `→ ${address}` : undefined,
    });
  }

  /* ---------- lamps: free Y address, return to anywhere on 24V ---- */
  /* ---------- lamps: fixed address per scenario, return on 24V ---- */
  // Which COM groups this scenario needs is known upfront from REQUIRED_Y,
  // so the COM checklist items appear from the start instead of only
  // showing up once a lamp happens to get wired.
  const usedComGroups = new Set<string>();
  for (const addr of Object.values(REQUIRED_Y)) {
    const group = Object.entries(Y_COM_GROUPS).find(([, ys]) =>
      ys.includes(addr),
    )?.[0];
    if (group) usedComGroups.add(group);
  }

  for (const key of LAMP_KEYS) {
    const [t1, t2] = [`${key}.X1`, `${key}.X2`];
    const requiredAddr = REQUIRED_Y[key];

    const bypassed = conn.connected(t1, t2);
    if (bypassed) bypassedDevices.add(key);

    const s1 = on24V(t1);
    const s2 = on24V(t2);
    const returnDone = (s1 || s2) && !bypassed;

    let address: string | undefined;
    if (!bypassed) {
      const signalCandidates = s1 && !s2 ? [t2] : s2 && !s1 ? [t1] : [t1, t2];
      if (
        signalCandidates.some((st) => conn.connected(st, `PLC.${requiredAddr}`))
      ) {
        address = requiredAddr;
      }
    }
    const signalDone = Boolean(address);
    if (returnDone && signalDone && address) {
      assignments[key] = address;
    }

    tasks.push({
      id: `${key}-signal`,
      label: `${key} drive — ${requiredAddr} → lamp (X1/X2)`,
      done: signalDone,
      detail: address ? `→ ${address}` : undefined,
    });
    tasks.push({
      id: `${key}-return`,
      label: `${key} return — lamp → +24V (block, PSU, or jumper)`,
      done: returnDone,
    });
  }

  /* ---------- output commons: one task per COM group used --------- */
  for (const group of [...usedComGroups].sort()) {
    netTask(
      `com-${group}`,
      `Output common — 0V → ${group} (${Y_COM_GROUPS[group].join(", ")})`,
      on0V(`PLC.${group}`),
    );
  }

  /* ---------- green wires (carrier rule) --------------------------- */
  // A wire is credited when both of its ends are legitimate CARRIERS of
  // the same net AND that net is actually live from its source. This is
  // what lets a daisy-chain jumper (PB1.13 → PB2.13) turn green, while a
  // sneaky 0V → X0 wire stays uncredited (an X input never carries raw 0V).
  const supplyTermsOf = (key: string): string[] => {
    const def = PANEL_COMPONENTS.find((c) => c.key === key);
    if (def?.kind === "buttonImage") {
      return CONTACT_PAIRS[def.contactType ?? "NO"].map((p) => `${key}.${p}`);
    }
    if (def?.kind === "lampImage") return [`${key}.X1`, `${key}.X2`];
    return [];
  };

  const carrier0V = (t: string): boolean => {
    if (net(t) === "TB0" || t === "PSU.0VDC" || /^PLC\.COM\d+$/.test(t))
      return true;
    const dev = deviceOf(t);
    return (
      /^PB\d+$/.test(dev) &&
      !bypassedDevices.has(dev) &&
      supplyTermsOf(dev).includes(t)
    );
  };

  const carrier24V = (t: string) => {
    if (net(t) === "TB24" || t === "PSU.24VDC" || t === "PLC.S/S") return true;
    const dev = deviceOf(t);
    return (
      /^LAMP\d+$/.test(dev) &&
      !bypassedDevices.has(dev) &&
      supplyTermsOf(dev).includes(t)
    );
  };
  const carrierL = (t: string): boolean =>
    t === "MCB.L1_OUT" || t === "PSU.L_IN" || t === "PLC.L";
  const carrierN = (t: string): boolean =>
    t === "MCB.L2_OUT" || t === "PSU.N_IN" || t === "PLC.N";

  // Direct signal wires: assigned device contact/element <-> its PLC address.
  const signalPairs = new Set<string>();
  for (const [key, addr] of Object.entries(assignments)) {
    for (const st of supplyTermsOf(key)) {
      signalPairs.add([st, `PLC.${addr}`].sort().join("|"));
    }
  }

  for (const w of wires) {
    const a = w.from;
    const b = w.to;
    if (deviceOf(a) === deviceOf(b)) continue; // self-jumper never green

    const distribution =
      (carrier0V(a) && carrier0V(b) && on0V(a)) ||
      (carrier24V(a) && carrier24V(b) && on24V(a)) ||
      (carrierL(a) && carrierL(b) && onL(a)) ||
      (carrierN(a) && carrierN(b) && onN(a));

    const signal = signalPairs.has([a, b].sort().join("|"));

    if (distribution || signal) okWireIds.add(w.id);
  }

  const allDone = tasks.every((t) => t.done);
  const leftovers = wires.some((w) => !okWireIds.has(w.id));
  const complete =
    allDone && dangers.length === 0 && !leftovers && wires.length > 0;

  return { tasks, okWireIds, dangers, assignments, complete };
}

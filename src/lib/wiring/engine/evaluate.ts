import type { EvalResult, TaskResult, Wire } from "../types";
import { buildComponents, net } from "./net";
import { dangerCheck } from "./feedback";
import {
  BUTTON_KEYS,
  LAMP_KEYS,
  PANEL_COMPONENTS,
  X_INPUTS,
  Y_COM_GROUPS,
  Y_OUTPUTS,
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
  NO: ["13", "14"],
  NC: ["21", "22"],
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

  const dangers = wires.flatMap((w) => {
    const key = dangerCheck(w.from, w.to);
    return key ? [{ wireId: w.id, messageKey: key }] : [];
  });

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
  netTask("ss", "Input common — S/S on the 0V net", on0V("PLC.S/S"));

  /* ---------- buttons: free X address, supply from anywhere on 0V - */
  const claimedX = new Set<string>();
  const bypassedDevices = new Set<string>();

  for (const key of BUTTON_KEYS) {
    const type = buttonContactType(key);
    const pair = CONTACT_PAIRS[type];
    const [t1, t2] = pair.map((p) => `${key}.${p}`) as [string, string];

    // Bypass: an external path joins both sides of the contact — the
    // button would be permanently "pressed". Never creditable.
    const bypassed = conn.connected(t1, t2);
    if (bypassed) bypassedDevices.add(key);

    const s1 = on24V(t1);
    const s2 = on24V(t2);
    const supplyDone = (s1 || s2) && !bypassed;

    // Signal side: the OTHER contact terminal reaching any free X input.
    let address: string | undefined;
    if (!bypassed) {
      const signalCandidates = s1 && !s2 ? [t2] : s2 && !s1 ? [t1] : [t1, t2];
      outer: for (const st of signalCandidates) {
        for (const addr of X_INPUTS) {
          if (claimedX.has(addr)) continue;
          if (conn.connected(st, `PLC.${addr}`)) {
            address = addr;
            break outer;
          }
        }
      }
    }
    const signalDone = Boolean(address);
    if (supplyDone && signalDone && address) {
      claimedX.add(address);
      assignments[key] = address;
    }

    tasks.push({
      id: `${key}-supply`,
      label: `${key} supply — 24V (block, PSU, or jumper) → ${type} contact (${pair.join("/")})`,
      done: supplyDone,
    });
    tasks.push({
      id: `${key}-signal`,
      label: `${key} signal — ${type} contact → any free X input`,
      done: signalDone,
      detail: address ? `→ ${address}` : undefined,
    });
  }

  /* ---------- lamps: free Y address, return to anywhere on 24V ---- */
  const claimedY = new Set<string>();
  const usedComGroups = new Set<string>();

  for (const key of LAMP_KEYS) {
    const [t1, t2] = [`${key}.X1`, `${key}.X2`];

    const bypassed = conn.connected(t1, t2);
    if (bypassed) bypassedDevices.add(key);

    const s1 = on24V(t1);
    const s2 = on24V(t2);
    const returnDone = (s1 || s2) && !bypassed;

    let address: string | undefined;
    if (!bypassed) {
      const signalCandidates = s1 && !s2 ? [t2] : s2 && !s1 ? [t1] : [t1, t2];
      outer: for (const st of signalCandidates) {
        for (const addr of Y_OUTPUTS) {
          if (claimedY.has(addr)) continue;
          if (conn.connected(st, `PLC.${addr}`)) {
            address = addr;
            break outer;
          }
        }
      }
    }
    const signalDone = Boolean(address);
    if (returnDone && signalDone && address) {
      claimedY.add(address);
      assignments[key] = address;
      const group = Object.entries(Y_COM_GROUPS).find(([, ys]) =>
        ys.includes(address!),
      )?.[0];
      if (group) usedComGroups.add(group);
    }

    tasks.push({
      id: `${key}-signal`,
      label: `${key} drive — any free Y output → lamp (X1/X2)`,
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
  if (usedComGroups.size === 0) {
    tasks.push({
      id: "com-pending",
      label: "Output common — 0V → COM of the Y group you use",
      done: false,
    });
  } else {
    for (const group of [...usedComGroups].sort()) {
      netTask(
        `com-${group}`,
        `Output common — 0V → ${group} (${Y_COM_GROUPS[group].join(", ")})`,
        on0V(`PLC.${group}`),
      );
    }
  }

  /* ---------- green wires (carrier rule) --------------------------- */
  // A wire is credited when both of its ends are legitimate CARRIERS of
  // the same net AND that net is actually live from its source. This is
  // what lets a daisy-chain jumper (PB1.13 → PB2.13) turn green, while a
  // sneaky 0V → X0 wire stays uncredited (an X input never carries raw 0V).
  const supplyTermsOf = (key: string): string[] => {
    const def = PANEL_COMPONENTS.find((c) => c.key === key);
    if (def?.kind === "button") {
      return CONTACT_PAIRS[def.contactType ?? "NO"].map((p) => `${key}.${p}`);
    }
    if (def?.kind === "lamp") return [`${key}.X1`, `${key}.X2`];
    return [];
  };

  const carrier0V = (t: string): boolean => {
    return net(t) === "TB0" || t === "PSU.0VDC" || /^PLC\.COM\d+$/.test(t);
  };

  const carrier24V = (t: string) => {
    if (net(t) === "TB24" || t === "PSU.24VDC" || t === "PLC.S/S") return true;
    const dev = deviceOf(t);
    return (
      (/^LAMP\d+$/.test(dev) || /^PB\d+$/.test(dev)) &&
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

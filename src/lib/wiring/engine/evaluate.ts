import type { EvalResult, TaskResult, Wire } from "../types";
import { buildNetMap, net, pairKey } from "./net";
import { dangerCheck } from "./feedback";
import { BUTTON_KEYS, LAMP_KEYS, PANEL_COMPONENTS, X_INPUTS, Y_COM_GROUPS, Y_OUTPUTS } from "../config/panel";

interface PathHit {
  supplyWire?: Wire;
  signalWire?: Wire;
  /** Which contact terminal each wire touches (bypass detection). */
  supplyTerm?: string;
  signalTerm?: string;
  address?: string;
  full: boolean;
}

const CONTACT_PAIRS: Record<"NO" | "NC", [string, string]> = {
  NO: ["13", "14"],
  NC: ["21", "22"],
};

function buttonContactType(key: string): "NO" | "NC" {
  const def = PANEL_COMPONENTS.find((c) => c.key === key);
  return def?.contactType ?? "NO";
}

/**
 * Free-address matching for a 2-terminal contact device.
 * endNet ---[t1|t2]--- <any candidate address terminal>
 * Accepts either terminal orientation; refuses bypass (both wires on
 * the same contact terminal); each address may be claimed once.
 */
function matchDevicePath(
  netMap: Map<string, Wire[]>,
  devKey: string,
  pair: [string, string],
  endNet: string,
  candidates: readonly string[],
  claimed: Set<string>,
): PathHit {
  const [t1, t2] = pair.map((t) => `${devKey}.${t}`) as [string, string];
  const grab = (a: string, b: string): Wire | undefined => netMap.get(pairKey(a, b))?.[0];

  const supply1 = grab(endNet, t1);
  const supply2 = grab(endNet, t2);

  // Try full path in both orientations against every free candidate address.
  for (const addr of candidates) {
    if (claimed.has(addr)) continue;
    const plcTerm = `PLC.${addr}`;
    const sig1 = grab(plcTerm, t2); // supply on t1 -> signal on t2
    const sig2 = grab(plcTerm, t1); // supply on t2 -> signal on t1
    if (supply1 && sig1) {
      claimed.add(addr);
      return { supplyWire: supply1, signalWire: sig1, supplyTerm: t1, signalTerm: t2, address: addr, full: true };
    }
    if (supply2 && sig2) {
      claimed.add(addr);
      return { supplyWire: supply2, signalWire: sig2, supplyTerm: t2, signalTerm: t1, address: addr, full: true };
    }
  }

  // Partial credit: supply side alone, or signal side alone (no bypass).
  const supplyWire = supply1 ?? supply2;
  const supplyTerm = supply1 ? t1 : supply2 ? t2 : undefined;
  let signalWire: Wire | undefined;
  let signalTerm: string | undefined;
  let address: string | undefined;
  for (const addr of candidates) {
    if (claimed.has(addr)) continue;
    const plcTerm = `PLC.${addr}`;
    const w1 = grab(plcTerm, t1);
    const w2 = grab(plcTerm, t2);
    const w = w1 ?? w2;
    if (!w) continue;
    const term = w1 ? t1 : t2;
    if (supplyTerm && term === supplyTerm) continue; // bypass — not creditable
    signalWire = w;
    signalTerm = term;
    address = addr;
    break;
  }
  return { supplyWire, signalWire, supplyTerm, signalTerm, address, full: false };
}

export function evaluate(wires: readonly Wire[]): EvalResult {
  const netMap = buildNetMap(wires);
  const okWireIds = new Set<string>();
  const tasks: TaskResult[] = [];
  const assignments: Record<string, string> = {};

  const dangers = wires.flatMap((w) => {
    const msg = dangerCheck(w.from, w.to);
    return msg ? [{ wireId: w.id, message: msg }] : [];
  });

  const pairTask = (id: string, label: string, a: string, b: string): void => {
    const w = netMap.get(pairKey(a, b))?.[0];
    if (w) okWireIds.add(w.id);
    tasks.push({ id, label, done: Boolean(w) });
  };

  // --- fixed infrastructure ---
  pairTask("ac-plc-l", "PLC power — MCB L1 OUT → PLC L", "MCB.L1_OUT", "PLC.L");
  pairTask("ac-plc-n", "PLC power — MCB L2 OUT → PLC N", "MCB.L2_OUT", "PLC.N");
  pairTask("ac-psu-l", "Power supply input — MCB L1 OUT → PSU L", "MCB.L1_OUT", "PSU.L_IN");
  pairTask("ac-psu-n", "Power supply input — MCB L2 OUT → PSU N", "MCB.L2_OUT", "PSU.N_IN");
  pairTask("dist-24", "24V distribution — PSU +V → +24V block", "PSU.24VDC", "TB24");
  pairTask("dist-0", "0V distribution — PSU −V → 0V block", "PSU.0VDC", "TB0");
  pairTask("ss", "Input common — +24V block → S/S", "TB24", "PLC.S/S");

  // --- buttons: free X address ---
  const X_CANDIDATES = X_INPUTS;
  const claimedX = new Set<string>();
  for (const key of BUTTON_KEYS) {
    const type = buttonContactType(key);
    const pair = CONTACT_PAIRS[type];
    const hit = matchDevicePath(netMap, key, pair, "TB0", X_CANDIDATES, claimedX);
    if (hit.supplyWire) okWireIds.add(hit.supplyWire.id);
    if (hit.signalWire && (hit.full || hit.signalTerm !== hit.supplyTerm)) okWireIds.add(hit.signalWire.id);
    if (hit.full && hit.address) assignments[key] = hit.address;
    tasks.push({
      id: `${key}-supply`,
      label: `${key} supply — 0V block → ${type} contact (${pair.join("/")})`,
      done: Boolean(hit.supplyWire),
    });
    tasks.push({
      id: `${key}-signal`,
      label: `${key} signal — ${type} contact → any free X input`,
      done: Boolean(hit.signalWire),
      detail: hit.address ? `→ ${hit.address}` : undefined,
    });
  }

  // --- lamps: free Y address ---
  const Y_CANDIDATES = Y_OUTPUTS;
  const claimedY = new Set<string>();
  const usedComGroups = new Set<string>();
  for (const key of LAMP_KEYS) {
    const hit = matchDevicePath(netMap, key, ["X1", "X2"], "TB24", Y_CANDIDATES, claimedY);
    if (hit.supplyWire) okWireIds.add(hit.supplyWire.id);
    if (hit.signalWire && (hit.full || hit.signalTerm !== hit.supplyTerm)) okWireIds.add(hit.signalWire.id);
    if (hit.full && hit.address) {
      assignments[key] = hit.address;
      const group = Object.entries(Y_COM_GROUPS).find(([, ys]) => ys.includes(hit.address!))?.[0];
      if (group) usedComGroups.add(group);
    }
    tasks.push({
      id: `${key}-signal`,
      label: `${key} drive — any free Y output → lamp (X1/X2)`,
      done: Boolean(hit.signalWire),
      detail: hit.address ? `→ ${hit.address}` : undefined,
    });
    tasks.push({
      id: `${key}-return`,
      label: `${key} return — lamp → +24V block`,
      done: Boolean(hit.supplyWire),
    });
  }

  // --- output commons: one task per COM group actually used ---
  if (usedComGroups.size === 0) {
    tasks.push({
      id: "com-pending",
      label: "Output common — 0V block → COM of the Y group you use",
      done: false,
    });
  } else {
    for (const group of [...usedComGroups].sort()) {
      pairTask(
        `com-${group}`,
        `Output common — 0V block → ${group} (${Y_COM_GROUPS[group].join(", ")})`,
        "TB0",
        `PLC.${group}`,
      );
    }
  }

  const allDone = tasks.every((t) => t.done);
  const leftovers = wires.some((w) => !okWireIds.has(w.id));
  const complete = allDone && dangers.length === 0 && !leftovers && wires.length > 0;

  return { tasks, okWireIds, dangers, assignments, complete };
}


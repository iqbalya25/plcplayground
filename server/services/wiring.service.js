const plc = require("../modbus-client");

/* ---------- static panel pinout (mirrors src/lib/wiring/config/panel.ts) -
   Duplicated on purpose — hardware pin numbering, not evaluation logic. */
// const BUTTON_CONTACTS = {
//   PB1: ["3", "4"],
//   PB2: ["3", "4"],
//   PB3: ["3", "4"],
//   PB4: ["1", "2"],
// };
// const BUTTON_TYPES = { PB1: "NO", PB2: "NO", PB3: "NO", PB4: "NC" };

const BUTTON_CONTACTS = {
  PB1: ["3", "4"],
  PB2: ["3", "4"],
  PB3: ["1", "2"],
};
const BUTTON_TYPES = { PB1: "NO", PB2: "NO", PB3: "NC" };

/* ---------- L & N: single relay ------------------------------------------ */
const LN_REQUIREMENTS = [
  { a: "MCB.L1_OUT", b: "PLC.L" },
  { a: "MCB.L2_OUT", b: "PLC.N" },
];
const MAIN_POWER_COIL = 3072; // M0

const SS_COIL = 3122; // M50 — S/S wired to 24V
// const WIRING_COILS = { X0: 3073, X1: 3074, X6: 3075, X7: 3076 }; // M1-M4 — wiring correctness
// const PRESS_COILS = { X0: 3123, X1: 3124, X6: 3125, X7: 3126 }; // M51-M54 — simulated press

const WIRING_COILS = { X0: 3073, X1: 3074, X6: 3075 }; // M1-M3 — wiring correctness
const PRESS_COILS = { X0: 3123, X1: 3124, X6: 3125 }; // M51-M53 — simulated press

let poweredOn = false;

/** Jumper blocks are internally common — mirrors net() in src/lib/wiring/engine/net.ts. */
function net(t) {
  if (t.startsWith("TB24.")) return "TB24";
  if (t.startsWith("TB0.")) return "TB0";
  return t;
}

function buildConnectivity(wires) {
  const parent = new Map();
  function find(x) {
    if (!parent.has(x)) parent.set(x, x);
    let root = x;
    while (parent.get(root) !== root) root = parent.get(root);
    let cur = x;
    while (parent.get(cur) !== root) {
      const next = parent.get(cur);
      parent.set(cur, root);
      cur = next;
    }
    return root;
  }
  function union(a, b) {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  }
  for (const w of wires) union(net(w.from), net(w.to));
  return {
    connected(a, b) {
      const na = net(a);
      const nb = net(b);
      if (!parent.has(na) || !parent.has(nb)) return na === nb;
      return find(na) === find(nb);
    },
  };
}

function contactClosed(key, pressed) {
  const isPressed = pressed.includes(key);
  return BUTTON_TYPES[key] === "NO" ? isPressed : !isPressed;
}

/** Cari tombol mana (kalau ada) yang kontaknya nyambung ke X ini. */
function findAssignedButton(conn, xAddr) {
  const plcTerm = `PLC.${xAddr}`;
  for (const [key, [pinA, pinB]] of Object.entries(BUTTON_CONTACTS)) {
    const t1 = `${key}.${pinA}`;
    const t2 = `${key}.${pinB}`;
    if (conn.connected(t1, plcTerm)) return { key, supplyTerm: t2 };
    if (conn.connected(t2, plcTerm)) return { key, supplyTerm: t1 };
  }
  return null;
}

function isWiringReady(conn, xAddr) {
  const assigned = findAssignedButton(conn, xAddr);
  if (!assigned) return false;
  const on0 = (t) => conn.connected(t, "PSU.0VDC") || conn.connected(t, "TB0");
  return on0(assigned.supplyTerm);
}

function isSimPressed(conn, xAddr, pressed) {
  const assigned = findAssignedButton(conn, xAddr);
  if (!assigned) return false;
  return contactClosed(assigned.key, pressed);
}

function wiresToCoils(wires, pressed = []) {
  const conn = buildConnectivity(wires);
  const desired = {};

  desired[MAIN_POWER_COIL] = LN_REQUIREMENTS.every(({ a, b }) =>
    conn.connected(a, b),
  );
  desired[SS_COIL] =
    conn.connected("PLC.S/S", "PSU.24VDC") || conn.connected("PLC.S/S", "TB24");

  for (const [xAddr, coil] of Object.entries(WIRING_COILS)) {
    desired[coil] = isWiringReady(conn, xAddr);
  }
  for (const [xAddr, coil] of Object.entries(PRESS_COILS)) {
    desired[coil] = isSimPressed(conn, xAddr, pressed);
  }

  return desired;
}

async function syncWiring(wires, pressed = []) {
  if (!poweredOn) return { ok: true, poweredOn: false, ...plc.getStatus() };
  const desired = wiresToCoils(wires, pressed);
  await plc.applyState(desired);
  return { ok: true, poweredOn: true, applied: desired, ...plc.getStatus() };
}

async function powerOn(wires, hasDanger, pressed = []) {
  if (hasDanger) {
    const err = new Error(
      "Cannot power on — dangerous wiring detected (short circuit / cross-voltage).",
    );
    err.status = 409;
    throw err;
  }
  poweredOn = true;
  const desired = wiresToCoils(wires, pressed);
  await plc.applyState(desired);
  return { ok: true, poweredOn, applied: desired, ...plc.getStatus() };
}

async function powerOff() {
  poweredOn = false;
  await plc.resetAll();
  return { ok: true, poweredOn, ...plc.getStatus() };
}

async function resetAll() {
  poweredOn = false;
  await plc.resetAll();
  return { ok: true, poweredOn, ...plc.getStatus() };
}

function getStatus() {
  return { poweredOn, ...plc.getStatus() };
}

function getLamps() {
  return { poweredOn, lamps: plc.getLamps() };
}

module.exports = {
  syncWiring,
  powerOn,
  powerOff,
  resetAll,
  getStatus,
  getLamps,
};

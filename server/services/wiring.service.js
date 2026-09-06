const plc = require("../modbus-client");

/* ---------- static panel pinout (mirrors src/lib/wiring/config/panel.ts) -
   Duplicated on purpose — hardware pin numbering, not evaluation logic. */
const BUTTON_CONTACTS = {
  PB1: ["13", "14"],
  PB2: ["13", "14"],
  PB3: ["13", "14"],
  PB4: ["21", "22"],
};

const BUTTON_TYPES = { PB1: "NO", PB2: "NO", PB3: "NO", PB4: "NC" };

/* ---------- L & N: single relay ------------------------------------------ */
const LN_REQUIREMENTS = [
  { a: "MCB.L1_OUT", b: "PLC.L" },
  { a: "MCB.L2_OUT", b: "PLC.N" },
];
const MAIN_POWER_COIL = 3072;

/* ---------- input-common + per-input monitor coils ----------------------- */
const SS_COIL = 3122; // M0 — S/S wired to 0V
const WIRING_COILS = { X0: 3073, X1: 3074 };

const PRESS_COILS = { X0: 3123, X1: 3124 };

let poweredOn = false;

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
  for (const w of wires) union(w.from, w.to);
  return {
    connected(a, b) {
      if (!parent.has(a) || !parent.has(b)) return a === b;
      return find(a) === find(b);
    },
  };
}

function isInputReady(conn, xAddr) {
  const plcTerm = `PLC.${xAddr}`;
  const on24 = (t) =>
    conn.connected(t, "PSU.24VDC") || conn.connected(t, "TB24");

  for (const [key, [pinA, pinB]] of Object.entries(BUTTON_CONTACTS)) {
    const t1 = `${key}.${pinA}`;
    const t2 = `${key}.${pinB}`;
    if (conn.connected(t1, plcTerm) && on24(t2)) return true;
    if (conn.connected(t2, plcTerm) && on24(t1)) return true;
  }
  return false;
}

function wiresToCoils(wires) {
  const conn = buildConnectivity(wires);
  const desired = {};

  desired[MAIN_POWER_COIL] = LN_REQUIREMENTS.every(({ a, b }) =>
    conn.connected(a, b),
  );

  desired[SS_COIL] =
    conn.connected("PLC.S/S", "PSU.0VDC") || conn.connected("PLC.S/S", "TB0");

  for (const [xAddr, coil] of Object.entries(INPUT_COILS)) {
    desired[coil] = isInputReady(conn, xAddr);
  }

  return desired;
}

async function syncWiring(wires) {
  if (!poweredOn) return { ok: true, poweredOn: false, ...plc.getStatus() };
  const desired = wiresToCoils(wires);
  await plc.applyState(desired);
  return { ok: true, poweredOn: true, applied: desired, ...plc.getStatus() };
}

async function powerOn(wires, hasDanger) {
  if (hasDanger) {
    const err = new Error(
      "Cannot power on — dangerous wiring detected (short circuit / cross-voltage).",
    );
    err.status = 409;
    throw err;
  }
  poweredOn = true;
  const desired = wiresToCoils(wires);
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
  const on24 = (t) =>
    conn.connected(t, "PSU.24VDC") || conn.connected(t, "TB24");
  return on24(assigned.supplyTerm);
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
    conn.connected("PLC.S/S", "PSU.0VDC") || conn.connected("PLC.S/S", "TB0");

  for (const [xAddr, coil] of Object.entries(WIRING_COILS)) {
    desired[coil] = isWiringReady(conn, xAddr);
  }
  for (const [xAddr, coil] of Object.entries(PRESS_COILS)) {
    desired[coil] = isSimPressed(conn, xAddr, pressed);
  }

  return desired;
}

module.exports = { syncWiring, powerOn, powerOff, resetAll, getStatus };

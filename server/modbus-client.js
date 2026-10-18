/**
 * modbus-client.js
 * ------------------------------------------------------------
 * Owns everything PLC-related:
 *  - persistent Modbus TCP connection to the Haiwell PLC
 *  - serialized write queue (one Modbus transaction at a time)
 *  - memorized coil state (backend = single source of truth)
 *  - SM0 heartbeat (run flag) -> "running" | "stopped" | "disconnected"
 *  - auto-reconnect with baseline re-assert (all coils OFF -> desired state)
 *
 * Nothing else in the app talks Modbus. Import { applyState, resetAll,
 * getStatus, start } from this module.
 * ------------------------------------------------------------
 */

const ModbusRTU = require("modbus-serial");

// ---------- configuration ----------------------------------------------------

const PLC_IP = process.env.PLC_IP || "192.168.0.111";
const PLC_PORT = Number(process.env.PLC_PORT || 502);

const SM0_ADDRESS = 16896; // 0x4200 — PLC run flag (always ON while running)
const HEARTBEAT_MS = 1000; // SM0 probe + coil read-back interval
const RECONNECT_MS = 3000; // wait between reconnect attempts
const MODBUS_TIMEOUT_MS = 2000;

// Every playground coil the backend is allowed to touch.
// Add new relay coils here as scenarios grow.
// const PLAYGROUND_COILS = [
//   3072,
//   3122,
//   3073,
//   3074,
//   3075,
//   3076, // M1–M4   wiring correctness (X0, X1, X6, X7)
//   3123,
//   3124,
//   3125,
//   3126, // M51–M54 simulated press    (X0, X1, X6, X7)
// ];

const PLAYGROUND_COILS = [
  3072,
  3122,
  3073,
  3074,
  3075, // M1–M3   wiring correctness (X0, X1, X6)
  3123,
  3124,
  3125, // M51–M53 simulated press    (X0, X1, X6)
];

// ---------- lamp feedback: FX5U Y output -> Haiwell input (FC02) --------------
// Keys are FX5U output addresses; values are Haiwell discrete-input addresses.
// const LAMP_INPUTS = { Y0: 0, Y1: 1, Y4: 2, Y5: 3 };
const LAMP_INPUTS = { Y0: 0, Y1: 1, Y2: 2 };
const LAMP_POLL_MS = 300;
const LAMP_FIRST = Math.min(...Object.values(LAMP_INPUTS));
const LAMP_COUNT = Math.max(...Object.values(LAMP_INPUTS)) - LAMP_FIRST + 1;
const COIL_FIRST = Math.min(...PLAYGROUND_COILS);
const COIL_COUNT = Math.max(...PLAYGROUND_COILS) - COIL_FIRST + 1;

// ---------- internal state ---------------------------------------------------

const client = new ModbusRTU();

/** "disconnected" | "stopped" | "running" */
let plcStatus = "disconnected";

/** Memorized coil state — the single source of truth. */
const lastState = Object.fromEntries(PLAYGROUND_COILS.map((a) => [a, false]));

/** Desired state survives disconnects so we can re-assert after recovery. */
const desiredState = Object.fromEntries(
  PLAYGROUND_COILS.map((a) => [a, false]),
);

let reconnecting = false;
let heartbeatTimer = null;

let heartbeatBusy = false;
let lampTimer = null;
let lampPollBusy = false;
let lampPollFailing = false;
const lampState = Object.fromEntries(
  Object.keys(LAMP_INPUTS).map((y) => [y, false]),
);

// ---------- write queue ------------------------------------------------------
// Modbus TCP on compact PLCs behaves best with one transaction in flight.
// Every operation (write or heartbeat read) goes through this queue.

let queueTail = Promise.resolve();

function enqueue(operation) {
  const run = queueTail.then(operation, operation);
  // Keep the chain alive even if an operation rejects.
  queueTail = run.catch(() => {});
  return run;
}

// ---------- connection lifecycle ---------------------------------------------

async function connect() {
  try {
    if (client.isOpen) client.close(() => {});
  } catch {
    /* ignore — socket may already be dead */
  }
  await client.connectTCP(PLC_IP, { port: PLC_PORT });
  client.setTimeout(MODBUS_TIMEOUT_MS);
  console.log(`[plc] TCP connected to ${PLC_IP}:${PLC_PORT}`);
}

function markDisconnected(reason) {
  if (plcStatus !== "disconnected") {
    console.warn(`[plc] marked DISCONNECTED (${reason})`);
  }
  plcStatus = "disconnected";
  scheduleReconnect();
}

function scheduleReconnect() {
  if (reconnecting) return;
  reconnecting = true;

  const attempt = async () => {
    try {
      await connect();
      // Recovery handshake: force a known baseline, then re-assert
      // whatever the frontend last asked for. This heals any divergence
      // caused by PLC power-cycles or manual pokes while we were away.
      await enqueue(() => writeAll(false));
      await enqueue(() => writeDesired());
      reconnecting = false;
      console.log("[plc] reconnected — state re-asserted");
    } catch (err) {
      console.warn(`[plc] reconnect failed (${err.message}), retrying…`);
      setTimeout(attempt, RECONNECT_MS);
    }
  };

  setTimeout(attempt, RECONNECT_MS);
}

// ---------- raw coil operations (only called inside the queue) ---------------

async function writeCoilConfirmed(address, value) {
  // modbus-serial throws on timeout / Modbus exception; the FC05 response
  // echoes address+value, so a resolved promise === confirmed write.
  await client.writeCoil(address, value);
  lastState[address] = value;
}

async function writeAll(value) {
  for (const address of PLAYGROUND_COILS) {
    await writeCoilConfirmed(address, value);
  }
}

async function writeDesired(force = false) {
  for (const address of PLAYGROUND_COILS) {
    if (force || lastState[address] !== desiredState[address]) {
      await writeCoilConfirmed(address, desiredState[address]);
    }
  }
}

/** Read the real relay state back and heal anything that drifted from desiredState. */
async function verifyCoils() {
  const res = await client.readCoils(COIL_FIRST, COIL_COUNT); // FC01
  const drifted = [];
  for (const address of PLAYGROUND_COILS) {
    const actual = Boolean(res.data[address - COIL_FIRST]);
    lastState[address] = actual; // memory follows reality, not the other way round
    if (actual !== desiredState[address]) drifted.push(address);
  }
  if (drifted.length > 0) {
    console.warn(
      `[plc] drift on ${drifted.length} coil(s) (${drifted.join(", ")}) — re-asserting`,
    );
    for (const address of drifted) {
      await writeCoilConfirmed(address, desiredState[address]);
    }
  }
}

// ---------- public API --------------------------------------------------------

/**
 * Apply a desired coil map, e.g. { 3072: true, 3073: false }.
 * Diffs against memorized state and writes only what changed.
 * Throws if the PLC is unreachable (caller returns 503 to frontend).
 */
async function applyState(desired) {
  // Record intent first — even if the write fails, reconnect will re-assert it.
  for (const [address, value] of Object.entries(desired)) {
    if (address in desiredState) desiredState[address] = Boolean(value);
  }

  if (plcStatus === "disconnected") {
    throw new Error("PLC disconnected — state saved, will apply on reconnect");
  }

  try {
    await enqueue(() => writeDesired());
  } catch (err) {
    markDisconnected(`write failed: ${err.message}`);
    throw err;
  }
}

/** Reset button: everything OFF, start from the beginning. */
async function resetAll() {
  for (const address of PLAYGROUND_COILS) desiredState[address] = false;

  if (plcStatus === "disconnected") {
    throw new Error("PLC disconnected — reset saved, will apply on reconnect");
  }

  try {
    await enqueue(() => writeAll(false));
  } catch (err) {
    markDisconnected(`reset failed: ${err.message}`);
    throw err;
  }
}

function getStatus() {
  return {
    plc: plcStatus, // "running" | "stopped" | "disconnected"
    coils: { ...lastState }, // confirmed-on-PLC state (handy for debugging)
  };
}

// ---------- heartbeat ----------------------------------------------------------

async function heartbeat() {
  if (reconnecting || heartbeatBusy) return; // reconnect owns the socket; never stack ticks
  heartbeatBusy = true;

  try {
    const res = await enqueue(() => client.readCoils(SM0_ADDRESS, 1)); // FC01
    const running = Boolean(res.data[0]);
    const previous = plcStatus;
    plcStatus = running ? "running" : "stopped";

    if (previous !== plcStatus) {
      console.log(`[plc] status: ${previous} -> ${plcStatus}`);
    }
    if (plcStatus === "running") {
      if (previous === "stopped") {
        // Back in RUN (e.g. after a program download wiped the relays):
        // memory can't be trusted, so force every coil instead of diffing.
        await enqueue(() => writeDesired(true));
      } else {
        // Normal tick: read the relays back and heal any drift.
        await enqueue(() => verifyCoils());
      }
    }
  } catch (err) {
    markDisconnected(`heartbeat failed: ${err.message}`);
  } finally {
    heartbeatBusy = false;
  }
}

// ---------- lamp feedback poll (FC02) -------------------------------------------

function clearLamps() {
  for (const y of Object.keys(lampState)) lampState[y] = false;
}

async function pollLamps() {
  if (plcStatus !== "running") {
    clearLamps();
    return;
  }
  if (lampPollBusy || reconnecting) return; // never stack polls

  lampPollBusy = true;
  try {
    const res = await enqueue(() =>
      client.readDiscreteInputs(LAMP_FIRST, LAMP_COUNT),
    ); // FC02
    for (const [y, address] of Object.entries(LAMP_INPUTS)) {
      lampState[y] = Boolean(res.data[address - LAMP_FIRST]);
    }
    lampPollFailing = false;
  } catch (err) {
    clearLamps(); // heartbeat() owns disconnect detection
    if (!lampPollFailing) {
      console.warn(`[plc] lamp poll failed: ${err.message}`);
    }
    lampPollFailing = true;
  } finally {
    lampPollBusy = false;
  }
}

function getLamps() {
  return { ...lampState };
}

// ---------- startup -------------------------------------------------------------

async function start() {
  scheduleReconnect(); // initial connect uses the same recovery path
  heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
  lampTimer = setInterval(pollLamps, LAMP_POLL_MS);
}

async function stop() {
  clearInterval(heartbeatTimer);
  clearInterval(lampTimer);
  try {
    // Leave the hardware safe on shutdown.
    await enqueue(() => writeAll(false));
  } catch {
    /* best effort */
  }
  try {
    client.close(() => {});
  } catch {
    /* ignore */
  }
}

module.exports = {
  start,
  stop,
  applyState,
  resetAll,
  getStatus,
  getLamps,
  PLAYGROUND_COILS,
};

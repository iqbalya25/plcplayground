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
const HEARTBEAT_MS = 5000; // SM0 probe interval
const RECONNECT_MS = 3000; // wait between reconnect attempts
const MODBUS_TIMEOUT_MS = 2000;

// Every playground coil the backend is allowed to touch.
// Add new relay coils here as scenarios grow.
const PLAYGROUND_COILS = [3072, 3122, 3073, 3074, 3123, 3124];

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

async function writeDesired() {
  for (const address of PLAYGROUND_COILS) {
    if (lastState[address] !== desiredState[address]) {
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
  if (reconnecting) return; // reconnect loop owns the socket right now

  try {
    const res = await enqueue(() => client.readCoils(SM0_ADDRESS, 1)); // FC01
    const running = Boolean(res.data[0]);
    const previous = plcStatus;
    plcStatus = running ? "running" : "stopped";

    if (previous !== plcStatus) {
      console.log(`[plc] status: ${previous} -> ${plcStatus}`);
    }
    if (previous === "stopped" && plcStatus === "running") {
      // PLC came back to RUN — make sure physical outputs match memory.
      await enqueue(() => writeDesired());
    }
  } catch (err) {
    markDisconnected(`heartbeat failed: ${err.message}`);
  }
}

// ---------- startup -------------------------------------------------------------

async function start() {
  scheduleReconnect(); // initial connect uses the same recovery path
  heartbeatTimer = setInterval(heartbeat, HEARTBEAT_MS);
}

async function stop() {
  clearInterval(heartbeatTimer);
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
  PLAYGROUND_COILS,
};

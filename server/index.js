/**
 * index.js — PLC bridge server (Express)
 * ------------------------------------------------------------
 * Endpoints:
 *   POST /wiring  { wires: [{ from, to }, ...] }  -> maps wires to coils, applies diff
 *   POST /reset                                    -> all coils OFF
 *   GET  /status                                   -> { plc, coils }
 *
 * The frontend is trusted for this phase: whatever wire list arrives
 * is mapped 1:1 to coils. No answer key lives here yet.
 * ------------------------------------------------------------
 */

const express = require("express");
const plc = require("./modbus-client");

const PORT = Number(process.env.PORT || 4000);

// ---------- wire -> coil mapping ---------------------------------------------
// Each entry: which two terminals, in any direction, drive which coil.
// Add rows here as new relay-backed connections are introduced.

const WIRE_COIL_MAP = [
  { a: "MCB.L1_OUT", b: "PLC.L", coil: 3072 }, // 0x0C00
  { a: "MCB.L2_OUT", b: "PLC.N", coil: 3073 }, // 0x0C01
];

function wiresToCoils(wires) {
  const has = (a, b) =>
    wires.some(
      (w) =>
        (w.from === a && w.to === b) || (w.from === b && w.to === a),
    );

  const desired = {};
  for (const { a, b, coil } of WIRE_COIL_MAP) {
    desired[coil] = has(a, b);
  }
  return desired;
}

// ---------- HTTP server --------------------------------------------------------

const app = express();
app.use(express.json());

app.post("/wiring", async (req, res) => {
  const wires = req.body?.wires;
  if (!Array.isArray(wires)) {
    return res
      .status(400)
      .json({ error: "Body must be { wires: [{ from, to }, ...] }" });
  }
  for (const w of wires) {
    if (typeof w?.from !== "string" || typeof w?.to !== "string") {
      return res
        .status(400)
        .json({ error: "Each wire needs string 'from' and 'to'" });
    }
  }

  const desired = wiresToCoils(wires);

  try {
    await plc.applyState(desired);
    res.json({ ok: true, applied: desired, ...plc.getStatus() });
  } catch (err) {
    // Intent is saved; it will be re-asserted on reconnect.
    res.status(503).json({ ok: false, error: err.message, ...plc.getStatus() });
  }
});

app.post("/reset", async (_req, res) => {
  try {
    await plc.resetAll();
    res.json({ ok: true, ...plc.getStatus() });
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message, ...plc.getStatus() });
  }
});

app.get("/status", (_req, res) => {
  res.json(plc.getStatus());
});

// ---------- lifecycle -----------------------------------------------------------

app.listen(PORT, async () => {
  console.log(`[server] PLC bridge listening on http://localhost:${PORT}`);
  await plc.start();
});

// Leave relays OFF on Ctrl+C / docker stop.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    console.log(`[server] ${signal} — resetting coils and shutting down`);
    await plc.stop();
    process.exit(0);
  });
}

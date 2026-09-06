/**
 * index.js — app entrypoint.
 * Wires the Express app together and owns the process lifecycle only.
 * All HTTP handling lives in controllers/, all routing in routes/, all
 * business logic in services/. Nothing else gets added to this file.
 */

const express = require("express");
const plc = require("./modbus-client");
const wiringRoutes = require("./routes/wiring.routes");
const powerMeter = require("./services/powermeter.service");

const PORT = Number(process.env.PORT || 4000);

const app = express();
app.use(express.json());
app.use(wiringRoutes);
app.use("/api/powermeter", powerMeter.router);

app.listen(PORT, async () => {
  console.log(`[server] PLC bridge listening on http://localhost:${PORT}`);
  await plc.start();
  powerMeter.start();
});

// Leave relays OFF on Ctrl+C / docker stop.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    console.log(`[server] ${signal} — resetting coils and shutting down`);
    powerMeter.stop();
    await plc.stop();
    process.exit(0);
  });
}

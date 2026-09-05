const express = require("express");
const { PowerMeterEngine } = require("./powermeter/engine");
const { startPowerMeterModbusServer } = require("./powermeter/modbus-server");
const { createPowerMeterRouter } = require("./powermeter/routes");

const REST_PORT = 4001;

const engine = new PowerMeterEngine();
engine.start();
startPowerMeterModbusServer(engine);

const app = express();
app.use(express.json());
app.use("/api/powermeter", createPowerMeterRouter(engine));

app.listen(REST_PORT, () => {
  console.log(`[powermeter] REST API on http://localhost:${REST_PORT}`);
});

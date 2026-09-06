/**
 * powermeter.service.js
 * Owns the power meter simulator's lifecycle (engine + its own Modbus
 * TCP server). index.js just calls start()/stop().
 */

const { PowerMeterEngine } = require("../powermeter/engine");
const { startPowerMeterModbusServer } = require("../powermeter/modbus-server");
const { createPowerMeterRouter } = require("../powermeter/routes");

const engine = new PowerMeterEngine();
const router = createPowerMeterRouter(engine);
let modbusServer = null;

function start() {
  engine.start();
  try {
    modbusServer = startPowerMeterModbusServer(engine);
  } catch (err) {
    console.error(
      `[powermeter] failed to start Modbus server — is 192.168.0.50 bound to this NIC? (${err.message})`,
    );
  }
}

function stop() {
  engine.stop();
  if (modbusServer) modbusServer.close?.();
}

module.exports = { router, start, stop };
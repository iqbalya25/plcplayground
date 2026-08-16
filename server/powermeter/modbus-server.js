const { ServerTCP } = require("modbus-serial");
const {
  HOLDING_REGISTERS,
  HOLDING_REGISTER_COUNT,
  DISCRETE_INPUTS,
  COILS,
  POWERMETER_CONNECTION,
} = require("./register-map");

function floatToRegisters(value) {
  const buf = Buffer.alloc(4);
  buf.writeFloatBE(value, 0);
  return [buf.readUInt16BE(0), buf.readUInt16BE(2)];
}

function buildHoldingRegisters(engine) {
  const s = engine.getState();
  const regs = new Array(HOLDING_REGISTER_COUNT).fill(0);
  const write = (addr, value) => {
    const [hi, lo] = floatToRegisters(value);
    regs[addr] = hi;
    regs[addr + 1] = lo;
  };

  write(HOLDING_REGISTERS.VA.address, s.phases.a.v);
  write(HOLDING_REGISTERS.VB.address, s.phases.b.v);
  write(HOLDING_REGISTERS.VC.address, s.phases.c.v);
  write(HOLDING_REGISTERS.VAB.address, s.vab);
  write(HOLDING_REGISTERS.VBC.address, s.vbc);
  write(HOLDING_REGISTERS.VCA.address, s.vca);
  write(HOLDING_REGISTERS.IA.address, s.phases.a.i);
  write(HOLDING_REGISTERS.IB.address, s.phases.b.i);
  write(HOLDING_REGISTERS.IC.address, s.phases.c.i);
  write(HOLDING_REGISTERS.PA.address, s.phases.a.p);
  write(HOLDING_REGISTERS.PB.address, s.phases.b.p);
  write(HOLDING_REGISTERS.PC.address, s.phases.c.p);
  write(HOLDING_REGISTERS.P_TOTAL.address, s.pTotal);
  write(HOLDING_REGISTERS.Q_TOTAL.address, s.qTotal);
  write(HOLDING_REGISTERS.S_TOTAL.address, s.sTotal);
  write(HOLDING_REGISTERS.PF_TOTAL.address, s.pfTotal);
  write(HOLDING_REGISTERS.FREQUENCY.address, s.frequency);
  write(HOLDING_REGISTERS.ENERGY_TOTAL.address, s.energyTotal);

  return regs;
}

function startPowerMeterModbusServer(engine) {
  const vector = {
    getHoldingRegister: (addr) => buildHoldingRegisters(engine)[addr] || 0,
    getDiscreteInput: (addr) => {
      const s = engine.getState();
      if (addr === DISCRETE_INPUTS.MOTOR1_RUNNING) return s.motors.motor1;
      if (addr === DISCRETE_INPUTS.MOTOR2_RUNNING) return s.motors.motor2;
      if (addr === DISCRETE_INPUTS.MOTOR3_RUNNING) return s.motors.motor3;
      return false;
    },
    getCoil: () => false,
    setCoil: (addr, value) => {
      if (addr === COILS.RESET_ENERGY && value) engine.resetEnergy();
    },
  };

  const server = new ServerTCP(vector, {
    host: POWERMETER_CONNECTION.host,
    port: POWERMETER_CONNECTION.port,
    unitID: POWERMETER_CONNECTION.unitId,
  });

  server.on("initialized", () => {
    console.log(
      `[powermeter] Modbus TCP server on ${POWERMETER_CONNECTION.host}:${POWERMETER_CONNECTION.port}`,
    );
  });
  server.on("socketError", (err) => {
    console.error("[powermeter] socket error:", (err && err.message) || err);
  });

  return server;
}

module.exports = { startPowerMeterModbusServer };

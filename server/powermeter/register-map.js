const HOLDING_REGISTERS = {
  VA: { address: 0, label: "Va (L-N)", unit: "V" },
  VB: { address: 2, label: "Vb (L-N)", unit: "V" },
  VC: { address: 4, label: "Vc (L-N)", unit: "V" },
  VAB: { address: 6, label: "Vab (L-L)", unit: "V" },
  VBC: { address: 8, label: "Vbc (L-L)", unit: "V" },
  VCA: { address: 10, label: "Vca (L-L)", unit: "V" },
  IA: { address: 12, label: "Ia", unit: "A" },
  IB: { address: 14, label: "Ib", unit: "A" },
  IC: { address: 16, label: "Ic", unit: "A" },
  PA: { address: 18, label: "Pa (active)", unit: "kW" },
  PB: { address: 20, label: "Pb (active)", unit: "kW" },
  PC: { address: 22, label: "Pc (active)", unit: "kW" },
  P_TOTAL: { address: 24, label: "Total Active Power", unit: "kW" },
  Q_TOTAL: { address: 26, label: "Total Reactive Power", unit: "kVAR" },
  S_TOTAL: { address: 28, label: "Total Apparent Power", unit: "kVA" },
  PF_TOTAL: { address: 30, label: "Power Factor (cosphi)", unit: "" },
  FREQUENCY: { address: 32, label: "Frequency", unit: "Hz" },
  ENERGY_TOTAL: { address: 34, label: "Energy Total", unit: "kWh" },
};

const HOLDING_REGISTER_COUNT = 36;

const DISCRETE_INPUTS = {
  MOTOR1_RUNNING: 0,
  MOTOR2_RUNNING: 1,
  MOTOR3_RUNNING: 2,
};

const COILS = {
  RESET_ENERGY: 0,
};

const MOTORS = [
  { id: "motor1", label: "Motor 1", ratedKw: 15, ratedPf: 0.83 },
  { id: "motor2", label: "Motor 2", ratedKw: 30, ratedPf: 0.85 },
  { id: "motor3", label: "Motor 3", ratedKw: 55, ratedPf: 0.87 },
];

const POWERMETER_CONNECTION = {
  host: "192.168.0.50",
  port: 502,
  unitId: 1,
};

module.exports = {
  HOLDING_REGISTERS,
  HOLDING_REGISTER_COUNT,
  DISCRETE_INPUTS,
  COILS,
  MOTORS,
  POWERMETER_CONNECTION,
};

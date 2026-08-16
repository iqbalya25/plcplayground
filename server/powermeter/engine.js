const { MOTORS } = require("./register-map");

const NOMINAL_VLN = 220;
const NOMINAL_VLL = 380;
const NOMINAL_HZ = 50;
const IDLE_KW = 0.5;
const TICK_MS = 1000;

function jitter(base, pct) {
  return base * (1 + (Math.random() * 2 - 1) * pct);
}

class PowerMeterEngine {
  constructor() {
    this.motorState = { motor1: false, motor2: false, motor3: false };
    this.energyKwh = 0;
    this.timer = null;
    this.state = { ...this._computeSnapshot(), energyTotal: 0 };
  }

  start() {
    this.timer = setInterval(() => this._tick(), TICK_MS);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
  }

  setMotor(id, running) {
    if (id in this.motorState) this.motorState[id] = Boolean(running);
  }

  resetEnergy() {
    this.energyKwh = 0;
  }

  getState() {
    return this.state;
  }

  _tick() {
    const snapshot = this._computeSnapshot();
    this.energyKwh += snapshot.pTotal * (TICK_MS / 3600000);
    this.state = { ...snapshot, energyTotal: this.energyKwh };
  }

  _computeSnapshot() {
    const vll = jitter(NOMINAL_VLL, 0.005);
    const vln = jitter(NOMINAL_VLN, 0.005);
    const freq = jitter(NOMINAL_HZ, 0.001);

    const activeMotors = MOTORS.filter((m) => this.motorState[m.id]);
    const totalKw = activeMotors.reduce((s, m) => s + m.ratedKw, 0) + IDLE_KW;
    const totalKva =
      activeMotors.reduce((s, m) => s + m.ratedKw / m.ratedPf, 0) + IDLE_KW;
    const pfTotal = totalKva > 0 ? totalKw / totalKva : 1;
    const qTotal = Math.sqrt(
      Math.max(totalKva * totalKva - totalKw * totalKw, 0),
    );

    const current = (pKw) => (pKw * 1000) / (vln * Math.max(pfTotal, 0.01));

    const phase = () => {
      const p = jitter(totalKw / 3, 0.03);
      return { v: jitter(vln, 0.005), i: current(p), p };
    };

    const a = phase();
    const b = phase();
    const c = phase();

    return {
      phases: { a, b, c },
      vab: jitter(vll, 0.005),
      vbc: jitter(vll, 0.005),
      vca: jitter(vll, 0.005),
      pTotal: a.p + b.p + c.p,
      qTotal,
      sTotal: totalKva,
      pfTotal,
      frequency: freq,
      energyTotal: 0,
      motors: { ...this.motorState },
    };
  }
}

module.exports = { PowerMeterEngine };

const express = require("express");
const { MOTORS } = require("./register-map");

function createPowerMeterRouter(engine) {
  const router = express.Router();

  router.get("/state", (req, res) => {
    res.json(engine.getState());
  });

  router.post("/motor/:id", (req, res) => {
    const { id } = req.params;
    const { running } = req.body || {};
    if (!MOTORS.some((m) => m.id === id)) {
      res.status(404).json({ error: "unknown motor id" });
      return;
    }
    engine.setMotor(id, Boolean(running));
    res.json({ ok: true });
  });

  router.post("/reset-energy", (req, res) => {
    engine.resetEnergy();
    res.json({ ok: true });
  });

  return router;
}

module.exports = { createPowerMeterRouter };

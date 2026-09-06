/**
 * wiring.controller.js
 * Translates HTTP <-> wiring.service. No business logic here.
 */

const service = require("../services/wiring.service");

function validateWires(wires) {
  if (!Array.isArray(wires)) return "Body must include wires[] (array)";
  for (const w of wires) {
    if (typeof w?.from !== "string" || typeof w?.to !== "string") {
      return "Each wire needs string 'from' and 'to'";
    }
  }
  return null;
}

exports.postWiring = async (req, res) => {
  const error = validateWires(req.body?.wires);
  if (error) return res.status(400).json({ error });
  const pressed = Array.isArray(req.body?.pressed) ? req.body.pressed : [];
  try {
    res.json(await service.syncWiring(req.body.wires, pressed));
  } catch (err) {
    res
      .status(503)
      .json({ ok: false, error: err.message, ...service.getStatus() });
  }
};

exports.postPowerOn = async (req, res) => {
  const error = validateWires(req.body?.wires);
  if (error) return res.status(400).json({ error });
  const pressed = Array.isArray(req.body?.pressed) ? req.body.pressed : [];
  try {
    res.json(
      await service.powerOn(
        req.body.wires,
        Boolean(req.body?.hasDanger),
        pressed,
      ),
    );
  } catch (err) {
    res.status(err.status || 503).json({ ok: false, error: err.message });
  }
};

exports.postPowerOff = async (_req, res) => {
  try {
    res.json(await service.powerOff());
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
};

exports.postReset = async (_req, res) => {
  try {
    res.json(await service.resetAll());
  } catch (err) {
    res.status(503).json({ ok: false, error: err.message });
  }
};

exports.getStatus = (_req, res) => {
  res.json(service.getStatus());
};

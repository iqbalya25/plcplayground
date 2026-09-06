const express = require("express");
const controller = require("../controllers/wiring.controller");

const router = express.Router();

router.post("/wiring", controller.postWiring);
router.post("/power/on", controller.postPowerOn);
router.post("/power/off", controller.postPowerOff);
router.post("/reset", controller.postReset);
router.get("/status", controller.getStatus);

module.exports = router;
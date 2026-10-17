const express = require("express");
const controller = require("../controllers/camera.controller");

const router = express.Router();

router.get("/camera/stream", controller.getStream);
router.get("/camera/status", controller.getStatus);

module.exports = router;
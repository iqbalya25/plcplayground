const camera = require("../services/camera.service");

exports.getStream = (req, res) => {
  camera.attach(req, res);
};

exports.getStatus = (_req, res) => {
  res.json(camera.getStatus());
};
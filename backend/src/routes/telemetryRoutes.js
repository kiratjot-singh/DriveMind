const express = require("express");
const { createTelemetry } = require("../controllers/telemetryController");
const verifyVehicle = require("../middleware/vehicleAuthMiddleware");
const { validateTelemetry } = require("../middleware/validationMiddleware");

const router = express.Router();

router.post("/", verifyVehicle, validateTelemetry, createTelemetry);

module.exports = router;
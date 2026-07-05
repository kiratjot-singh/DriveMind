const Joi = require("joi");

const telemetrySchema = Joi.object({
  vehicleId: Joi.string().required(),
  roadSegmentId: Joi.string().required(),
  speed: Joi.number().min(0).max(250).required(),
  acceleration: Joi.number().min(-15).max(10).required(),
  brakePressure: Joi.number().min(0).max(1).required(),
  steeringAngle: Joi.number().min(-180).max(180).required(),
  laneOffset: Joi.number().min(-5).max(5).required(),
  distanceToFrontVehicle: Joi.number().min(0).max(500).required(),
  weather: Joi.string().valid("clear", "rain", "fog", "snow", "storm", "unknown").default("unknown")
});

const validateTelemetry = (req, res, next) => {
  const { error } = telemetrySchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: "Validation Error",
      error: error.details.map((d) => d.message).join(", ")
    });
  }
  next();
};

module.exports = {
  validateTelemetry
};

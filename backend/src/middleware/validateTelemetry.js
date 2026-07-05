/**
 * Validates telemetry payload fields.
 * Returns 400 with field-level errors for invalid input.
 * Prevents NaN/undefined from reaching the risk engine.
 */
const validateTelemetry = (req, res, next) => {
  const errors = [];
  const {
    vehicleId,
    roadSegmentId,
    speed,
    acceleration,
    brakePressure,
    steeringAngle,
    laneOffset,
    distanceToFrontVehicle,
    weather,
  } = req.body;

  // Required string fields
  if (!vehicleId || typeof vehicleId !== "string") {
    errors.push({ field: "vehicleId", message: "Must be a non-empty string" });
  }
  if (!roadSegmentId || typeof roadSegmentId !== "string") {
    errors.push({ field: "roadSegmentId", message: "Must be a non-empty string" });
  }

  // Numeric fields with range validation
  const numericChecks = [
    { field: "speed", value: speed, min: 0, max: 300 },
    { field: "acceleration", value: acceleration, min: -10, max: 10 },
    { field: "brakePressure", value: brakePressure, min: 0, max: 1 },
    { field: "steeringAngle", value: steeringAngle, min: -90, max: 90 },
    { field: "laneOffset", value: laneOffset, min: -5, max: 5 },
    { field: "distanceToFrontVehicle", value: distanceToFrontVehicle, min: 0, max: 1000 },
  ];

  for (const check of numericChecks) {
    if (check.value === undefined || check.value === null) {
      errors.push({ field: check.field, message: "Required numeric field" });
    } else if (typeof check.value !== "number" || isNaN(check.value)) {
      errors.push({ field: check.field, message: "Must be a valid number" });
    } else if (check.value < check.min || check.value > check.max) {
      errors.push({
        field: check.field,
        message: `Must be between ${check.min} and ${check.max}`,
      });
    }
  }

  // Weather enum validation
  const validWeathers = ["clear", "rain", "fog", "snow", "storm", "unknown"];
  if (weather && !validWeathers.includes(weather)) {
    errors.push({
      field: "weather",
      message: `Must be one of: ${validWeathers.join(", ")}`,
    });
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors,
    });
  }

  next();
};

module.exports = validateTelemetry;
